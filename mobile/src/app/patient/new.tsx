/** Create or edit a patient. Minimum data: name and date of birth are optional (PRIVACY minimization). */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text } from 'react-native';
import { LANGUAGES } from '../../domain/languages';
import type { Patient } from '../../domain/types';
import { Banner, Button, Card, Field, haptic, Row, Screen, Segmented, T } from '../../presentation/components';
import { useTheme } from '../../presentation/theme';
import { showError, useApp } from '../../presentation/AppContext';

type Sex = NonNullable<Patient['sex']>;

export default function PatientForm() {
  const { app } = useApp();
  const { patientId, next } = useLocalSearchParams<{ patientId?: string; next?: string }>();
  const [existing, setExisting] = useState<Patient | null>(null);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<Sex>('UNKNOWN');
  const [occupation, setOccupation] = useState('');
  const [language, setLanguage] = useState<string | undefined>(undefined);
  const { c } = useTheme();
  const [demo, setDemo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!patientId) return;
    void app.store.getPatient(patientId).then((p) => {
      setExisting(p);
      setName(p.name ?? '');
      setAge(p.age !== undefined ? String(p.age) : '');
      setSex(p.sex ?? 'UNKNOWN');
      setOccupation(p.occupation ?? '');
      setLanguage(p.preferredLanguage);
      setDemo(p.isDemo);
    });
  }, [app, patientId]);

  const save = async () => {
    const a = age.trim() ? Number(age.trim()) : undefined;
    if (a !== undefined && (!Number.isInteger(a) || a < 0 || a > 130)) {
      setErr('Age must be a whole number from 0 to 130.');
      return;
    }
    setBusy(true);
    try {
      if (existing) {
        await app.store.savePatient({ ...existing, name: name.trim() || undefined, age: a, sex, occupation: occupation.trim() || undefined, preferredLanguage: language });
        router.back();
      } else {
        const p = await app.store.createPatient({ name: name.trim() || undefined, age: a, sex, occupation: occupation.trim() || undefined, preferredLanguage: language, isDemo: demo });
        if (next === 'visit') router.replace(`/visit/start?patientId=${p.patientId}`);
        else router.replace(`/patient/${p.patientId}`);
      }
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <T variant="title">{existing ? `Edit ${existing.patientReference}` : 'New patient'}</T>
      <T muted>A reference such as P-000001 is assigned automatically. Record only what you need.</T>
      <Card>
        <Field label="Name (optional)" value={name} onChangeText={setName} autoCapitalize="words" hint="Stored only on this device. Never sent to any service." />
        <Field label="Age in years (optional)" value={age} onChangeText={setAge} keyboardType="number-pad" maxLength={3} />
        <T variant="small" muted>Sex</T>
        <Segmented label="Sex" value={sex} onChange={setSex} options={[{ value: 'FEMALE', label: 'Female' }, { value: 'MALE', label: 'Male' }, { value: 'OTHER', label: 'Other' }, { value: 'UNKNOWN', label: 'Not stated' }]} />
        <Field label="Occupation (optional)" value={occupation} onChangeText={setOccupation} hint="Only if relevant to care. Stored only on this device." />
        <T variant="small" muted>Preferred language (optional)</T>
        <Row wrap>
          {[{ code: undefined as string | undefined, name: 'Not stated' }, ...LANGUAGES.filter((l) => l.languageCode !== 'auto').map((l) => ({ code: l.languageCode as string | undefined, name: l.displayName }))].map((l) => {
            const on = l.code === language;
            return (
              <Pressable key={l.name} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={l.name} onPress={() => { haptic('select'); setLanguage(l.code); }} style={{ minHeight: 40, paddingHorizontal: 14, borderRadius: 999, justifyContent: 'center', backgroundColor: on ? c.primary : c.glassStrong, borderWidth: 1, borderColor: on ? c.primary : c.glassBorder }}>
                <Text style={{ color: on ? c.primaryText : c.text, fontWeight: '700' }}>{l.name}</Text>
              </Pressable>
            );
          })}
        </Row>
        {!existing ? (
          <>
            <T variant="small" muted>Data type</T>
            <Segmented label="Data type" value={demo ? 'DEMO' : 'REAL'} onChange={(v) => setDemo(v === 'DEMO')} options={[{ value: 'REAL', label: 'Patient' }, { value: 'DEMO', label: 'Synthetic demo' }]} />
          </>
        ) : null}
      </Card>
      {err ? <Banner tone="danger" message={err} /> : null}
      <Button label={existing ? 'Save changes' : 'Create patient'} icon="content-save-outline" busy={busy} onPress={() => void save()} />
    </Screen>
  );
}
