import { useFocusEffect } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert } from 'react-native';
import { getContainer, type Container } from '../application/container';
import type { AppSettings, Patient, PatientIndexEntry, Visit } from '../domain/types';
import { StorageError } from '../infrastructure/storage/clinicalStore';

interface Ctx {
  app: Container;
  settings: AppSettings;
  updateSettings(patch: Partial<AppSettings>): Promise<void>;
  reloadSettings(): Promise<void>;
}

const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children, onReady, fallback }: { children: ReactNode; onReady?: () => void; fallback: (err: string | null) => ReactNode }) {
  const [app, setApp] = useState<Container | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getContainer()
      .then(async (c) => {
        const s = await c.store.getSettings();
        setApp(c);
        setSettings(s);
        setErr(null);
      })
      .catch((e) => setErr(e instanceof StorageError ? e.message : 'Secure storage is unavailable on this device. ClinNote cannot open patient data.'))
      .finally(() => onReady?.());
  }, [onReady]);

  const updateSettings = useCallback(
    async (patch: Partial<AppSettings>) => {
      if (!app || !settings) return;
      const next = { ...(await app.store.getSettings()), ...patch };
      await app.store.saveSettings(next);
      setSettings(next);
    },
    [app, settings],
  );
  const reloadSettings = useCallback(async () => {
    if (!app) return;
    setSettings(await app.store.getSettings());
  }, [app]);

  if (!app || !settings) return <>{fallback(err)}</>;
  return <AppCtx.Provider value={{ app, settings, updateSettings, reloadSettings }}>{children}</AppCtx.Provider>;
}

export function useApp(): Ctx {
  const c = useContext(AppCtx);
  if (!c) throw new Error('AppProvider missing');
  return c;
}

export function showError(e: unknown, fallback = 'Something went wrong. Your saved data is unchanged.') {
  Alert.alert('Not completed', e instanceof Error && e.message ? e.message : fallback);
}

/** Loads a patient, the visit and all of the patient's visits; `mutate` applies a change and saves it. */
export function useVisit(patientId: string, visitId: string) {
  const { app } = useApp();
  const [state, setState] = useState<{ patient: Patient; visit: Visit; all: Visit[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(state);
  useEffect(() => {
    latest.current = state;
  }, [state]);

  const load = useCallback(async () => {
    try {
      const patient = await app.store.getPatient(patientId);
      const all = await app.store.listVisits(patientId);
      const visit = all.find((v) => v.visitId === visitId);
      if (!visit) throw new StorageError('NOT_FOUND', 'Visit not found.');
      latest.current = { patient, visit, all };
      setState({ patient, visit, all });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the visit.');
    }
  }, [app, patientId, visitId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const mutate = useCallback(
    async (fn: (v: Visit, ctx: { patient: Patient; all: Visit[] }) => void | Promise<void>) => {
      const cur = latest.current;
      if (!cur) return;
      const v: Visit = JSON.parse(JSON.stringify(cur.visit));
      const all = cur.all.map((x) => (x.visitId === v.visitId ? v : x));
      await fn(v, { patient: cur.patient, all });
      await app.store.saveVisit(v);
      const next = { patient: cur.patient, visit: v, all };
      latest.current = next; // consecutive mutations in one handler see the saved version
      setState(next);
      return v;
    },
    [app],
  );

  return { ...state, error, reload: load, mutate };
}

export function usePatient(patientId: string) {
  const { app } = useApp();
  const [state, setState] = useState<{ patient: Patient; visits: Visit[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const patient = await app.store.getPatient(patientId);
      setState({ patient, visits: await app.store.listVisits(patientId) });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the patient.');
    }
  }, [app, patientId]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  return { ...state, error, reload: load };
}

/** All patients (index) and their visits, for Home, Visits, Follow-up and Search. Local only; works offline. */
export function useWorkspace() {
  const { app } = useApp();
  const [state, setState] = useState<{ patients: PatientIndexEntry[]; visitsByPatient: Record<string, Visit[]> } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const patients = await app.store.listPatients();
      const visitsByPatient: Record<string, Visit[]> = {};
      for (const p of patients) visitsByPatient[p.patientId] = await app.store.listVisits(p.patientId);
      setState({ patients, visitsByPatient });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read local data.');
    }
  }, [app]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  return { ...state, error, reload: load };
}
