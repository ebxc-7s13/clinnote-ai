/**
 * JSON-first clinical store (ADR-046). Canonical documents:
 *   data/settings.json.enc
 *   data/index.json.enc                                  (patient list for search; derived, rebuildable)
 *   data/patients/<P-xxxxxx>/patient.json.enc
 *   data/patients/<P-xxxxxx>/visits/<V-xxxxxx>.json.enc
 *   data/cache/evidence.json.enc                         (public evidence cache, on device only, ADR-028)
 * Every document is encrypted (AES-256-GCM) and written atomically (temp + replace). Writes are serialized.
 */
import { z } from 'zod';
import {
  AppSettings,
  Patient,
  PatientIndexEntry,
  SCHEMA_VERSION,
  Visit,
  type AppSettings as AppSettingsT,
  type Patient as PatientT,
  type PatientIndexEntry as PatientIndexEntryT,
  type Visit as VisitT,
} from '../../domain/types';
import { newId, nowIso, pad } from '../../domain/util';
import type { DocumentCipher } from './crypto';
import type { FileBackend } from './fileBackend';

export class StorageError extends Error {
  constructor(
    public readonly kind: 'READ_FAILED' | 'WRITE_FAILED' | 'CORRUPT' | 'NOT_FOUND',
    message: string,
  ) {
    super(message);
  }
}

export const DEFAULT_SETTINGS: AppSettingsT = {
  schemaVersion: SCHEMA_VERSION,
  cloudProcessingEnabled: false,
  defaultNoteType: 'SOAP',
  language: 'en-US',
  theme: 'SYSTEM',
  devPossibilitiesEnabled: false,
  nextPatientNumber: 1,
  nextVisitNumber: 1,
};

const ROOT = 'data';

export class ClinicalStore {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly fs: FileBackend,
    private readonly cipher: DocumentCipher,
  ) {}

  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async readDoc<T>(path: string, schema: z.ZodType<T>): Promise<T | null> {
    let raw: string | null;
    try {
      raw = await this.fs.readText(path);
    } catch {
      throw new StorageError('READ_FAILED', 'Could not read local data.');
    }
    if (raw == null) return null;
    let parsed: unknown;
    try {
      parsed = JSON.parse(this.cipher.decrypt(raw));
    } catch {
      throw new StorageError('CORRUPT', 'A local record could not be decrypted.');
    }
    const res = schema.safeParse(parsed);
    if (!res.success) throw new StorageError('CORRUPT', 'A local record failed validation.');
    return res.data;
  }

  private async writeDoc(path: string, doc: unknown): Promise<void> {
    try {
      await this.fs.writeTextAtomic(path, this.cipher.encrypt(JSON.stringify(doc)));
    } catch {
      throw new StorageError('WRITE_FAILED', 'Could not save local data. Your previous copy is unchanged.');
    }
  }

  // ---- settings
  async getSettings(): Promise<AppSettingsT> {
    return (await this.readDoc(`${ROOT}/settings.json.enc`, AppSettings)) ?? { ...DEFAULT_SETTINGS };
  }
  saveSettings(s: AppSettingsT): Promise<void> {
    return this.serial(() => this.writeDoc(`${ROOT}/settings.json.enc`, s));
  }
  private async takeNumber(kind: 'patient' | 'visit'): Promise<number> {
    const s = await this.getSettings();
    const n = kind === 'patient' ? s.nextPatientNumber : s.nextVisitNumber;
    if (kind === 'patient') s.nextPatientNumber = n + 1;
    else s.nextVisitNumber = n + 1;
    await this.writeDoc(`${ROOT}/settings.json.enc`, s);
    return n;
  }

  // ---- patients
  private pDir(ref: string) {
    return `${ROOT}/patients/${ref}`;
  }

  async listPatients(): Promise<PatientIndexEntryT[]> {
    const idx = await this.readDoc(`${ROOT}/index.json.enc`, z.array(PatientIndexEntry));
    return (idx ?? []).sort((a, b) => (b.lastVisitAt ?? b.updatedAt).localeCompare(a.lastVisitAt ?? a.updatedAt));
  }

  private async upsertIndex(p: PatientT, visits?: VisitT[]): Promise<void> {
    const idx = (await this.readDoc(`${ROOT}/index.json.enc`, z.array(PatientIndexEntry))) ?? [];
    const existing = idx.find((e) => e.patientId === p.patientId);
    const entry: PatientIndexEntryT = {
      patientId: p.patientId,
      patientReference: p.patientReference,
      name: p.name,
      age: p.age,
      sex: p.sex,
      isDemo: p.isDemo,
      visitCount: p.visitIds.length,
      lastVisitAt: visits ? visits.map((v) => v.startedAt).sort().pop() : existing?.lastVisitAt,
      updatedAt: p.updatedAt,
    };
    const next = idx.filter((e) => e.patientId !== p.patientId).concat(entry);
    await this.writeDoc(`${ROOT}/index.json.enc`, next);
  }

  createPatient(input: Pick<PatientT, 'name' | 'age' | 'sex' | 'dateOfBirth'> & { isDemo?: boolean }): Promise<PatientT> {
    return this.serial(async () => {
      const n = await this.takeNumber('patient');
      const ts = nowIso();
      const p: PatientT = Patient.parse({
        schemaVersion: SCHEMA_VERSION,
        patientId: newId(),
        patientReference: `P-${pad(n, 6)}`,
        name: input.name?.trim() || undefined,
        age: input.age,
        sex: input.sex,
        dateOfBirth: input.dateOfBirth || undefined,
        isDemo: input.isDemo ?? false,
        problems: [],
        visitIds: [],
        createdAt: ts,
        updatedAt: ts,
      });
      await this.writeDoc(`${this.pDir(p.patientReference)}/patient.json.enc`, p);
      await this.upsertIndex(p);
      return p;
    });
  }

  private async refFor(patientId: string): Promise<string> {
    const idx = await this.listPatients();
    const e = idx.find((x) => x.patientId === patientId);
    if (!e) throw new StorageError('NOT_FOUND', 'Patient not found.');
    return e.patientReference;
  }

  async getPatient(patientId: string): Promise<PatientT> {
    const ref = await this.refFor(patientId);
    const p = await this.readDoc(`${this.pDir(ref)}/patient.json.enc`, Patient);
    if (!p) throw new StorageError('NOT_FOUND', 'Patient not found.');
    return p;
  }

  savePatient(p: PatientT): Promise<void> {
    return this.serial(async () => {
      p.updatedAt = nowIso();
      await this.writeDoc(`${this.pDir(p.patientReference)}/patient.json.enc`, p);
      await this.upsertIndex(p);
    });
  }

  deletePatient(patientId: string): Promise<void> {
    return this.serial(async () => {
      const ref = await this.refFor(patientId);
      await this.fs.removeDir(this.pDir(ref));
      const idx = (await this.readDoc(`${ROOT}/index.json.enc`, z.array(PatientIndexEntry))) ?? [];
      await this.writeDoc(
        `${ROOT}/index.json.enc`,
        idx.filter((e) => e.patientId !== patientId),
      );
    });
  }

  // ---- visits
  async createVisit(patientId: string, mode: VisitT['mode']): Promise<VisitT> {
    const p = await this.getPatient(patientId);
    return this.serial(async () => {
      const n = await this.takeNumber('visit');
      const ts = nowIso();
      const v: VisitT = {
        schemaVersion: SCHEMA_VERSION,
        visitId: newId(),
        visitCode: `V-${pad(n, 6)}`,
        patientId,
        startedAt: ts,
        mode,
        isDemo: p.isDemo,
        recordingState: 'NOT_STARTED',
        recordingDurationSec: 0,
        transcriptState: 'NOT_STARTED',
        transcriptSource: 'NONE',
        speakerMappingState: 'NOT_STARTED',
        speakerAssignmentUncertain: false,
        clinicalExtractionState: 'NOT_STARTED',
        evidenceState: 'NOT_STARTED',
        candidateState: 'NOT_STARTED',
        noteState: 'NONE',
        segments: [],
        facts: [],
        conflicts: [],
        discarded: [],
        evidenceQueries: [],
        evidence: [],
        candidates: [],
        noteVersions: [],
        executions: [],
        audit: [{ eventId: newId(), entityType: 'VISIT', entityId: '', action: 'CREATED', actor: 'CLINICIAN', createdAt: ts }],
        pendingAudioUris: [],
        updatedAt: ts,
      };
      v.audit[0].entityId = v.visitId;
      await this.writeDoc(`${this.pDir(p.patientReference)}/visits/${v.visitCode}.json.enc`, v);
      p.visitIds.push(v.visitId);
      p.updatedAt = ts;
      await this.writeDoc(`${this.pDir(p.patientReference)}/patient.json.enc`, p);
      await this.upsertIndex(p, [v]);
      return v;
    });
  }

  async listVisits(patientId: string): Promise<VisitT[]> {
    const ref = await this.refFor(patientId);
    const names = await this.fs.list(`${this.pDir(ref)}/visits`);
    const out: VisitT[] = [];
    for (const name of names.filter((n) => n.endsWith('.json.enc'))) {
      const v = await this.readDoc(`${this.pDir(ref)}/visits/${name}`, Visit);
      if (v) out.push(v);
    }
    return out.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  }

  async getVisit(patientId: string, visitId: string): Promise<VisitT> {
    const v = (await this.listVisits(patientId)).find((x) => x.visitId === visitId);
    if (!v) throw new StorageError('NOT_FOUND', 'Visit not found.');
    return v;
  }

  saveVisit(v: VisitT): Promise<void> {
    return this.serial(async () => {
      const ref = await this.refFor(v.patientId);
      v.updatedAt = nowIso();
      const checked = Visit.parse(v);
      await this.writeDoc(`${this.pDir(ref)}/visits/${v.visitCode}.json.enc`, checked);
      const p = await this.readDoc(`${this.pDir(ref)}/patient.json.enc`, Patient);
      if (p) await this.upsertIndex(p, await this.listVisitsUnlocked(ref));
    });
  }

  private async listVisitsUnlocked(ref: string): Promise<VisitT[]> {
    const names = await this.fs.list(`${this.pDir(ref)}/visits`);
    const out: VisitT[] = [];
    for (const name of names.filter((n) => n.endsWith('.json.enc'))) {
      const v = await this.readDoc(`${this.pDir(ref)}/visits/${name}`, Visit);
      if (v) out.push(v);
    }
    return out;
  }

  deleteVisit(patientId: string, visitId: string): Promise<void> {
    return this.serial(async () => {
      const ref = await this.refFor(patientId);
      const visits = await this.listVisitsUnlocked(ref);
      const v = visits.find((x) => x.visitId === visitId);
      if (!v) return;
      await this.fs.remove(`${this.pDir(ref)}/visits/${v.visitCode}.json.enc`);
      const p = await this.readDoc(`${this.pDir(ref)}/patient.json.enc`, Patient);
      if (p) {
        p.visitIds = p.visitIds.filter((id) => id !== visitId);
        p.updatedAt = nowIso();
        await this.writeDoc(`${this.pDir(ref)}/patient.json.enc`, p);
        await this.upsertIndex(
          p,
          visits.filter((x) => x.visitId !== visitId),
        );
      }
    });
  }

  /** Unfinished ambient visits (recording interrupted or never processed), for crash recovery. */
  async findUnfinishedVisits(): Promise<VisitT[]> {
    const out: VisitT[] = [];
    for (const p of await this.listPatients()) {
      for (const v of await this.listVisits(p.patientId)) {
        if (v.recordingState === 'RECORDING' || v.recordingState === 'PAUSED') out.push(v);
      }
    }
    return out;
  }

  // ---- evidence cache (public provider data only)
  async readCache<T>(schema: z.ZodType<T>): Promise<T | null> {
    try {
      return await this.readDoc(`${ROOT}/cache/evidence.json.enc`, schema);
    } catch {
      return null;
    }
  }
  writeCache(doc: unknown): Promise<void> {
    return this.serial(() => this.writeDoc(`${ROOT}/cache/evidence.json.enc`, doc));
  }

  deleteAll(): Promise<void> {
    return this.serial(async () => {
      await this.fs.removeDir(ROOT);
    });
  }
}
