/** Screen 6 — Start Visit. "Record conversation" is disabled with the reason when cloud processing is off (FR-28.2). */
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import type { PatientIndexEntry } from '../../domain/types';
import { audit } from '../../domain/facts';
import { Banner, Button, Card, DemoBadge, Empty, Field, Loading, Row, Screen, Section, Segmented, T } from '../../presentation/components';
import { showError, useApp } from '../../presentation/AppContext';
import { useTheme } from '../../presentation/theme';

export default function StartVisit() {
  const { c } = useTheme();
  const { app, settings } = useApp();
  const params = useLocalSearchParams<{ patientId?: string }>();
  const [patients, setPatients] = useState<PatientIndexEntry[] | null>(null);
  const [selected, setSelected] = useState<string | undefined>(params.patientId);
  const [mode, setMode] = useState<'AMBIENT' | 'MANUAL'>(settings.cloudProcessingEnabled ? 'AMBIENT' : 'MANUAL');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void app.store.listPatients().then(setPatients);
    }, [app]),
  );

  if (!patients) return <Loading />;
  const patient = patients.find((p) => p.patientId === selected);
  const list = patients.filter((p) => !q.trim() || `${p.patientReference} ${p.name ?? ''}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8);

  const start = async () => {
    if (!patient) return;
    setBusy(true);
    try {
      const v = await app.store.createVisit(patient.patientId, mode);
      if (mode === 'MANUAL') {
        v.transcriptState = 'SKIPPED';
        v.speakerMappingState = 'SKIPPED';
        v.clinicalExtractionState = 'SKIPPED';
        audit(v, 'VISIT', v.visitId, 'MANUAL_MODE');
        await app.store.saveVisit(v);
        router.replace(`/visit/${patient.patientId}/${v.visitId}/facts`);
      } else router.replace(`/visit/${patient.patientId}/${v.visitId}/consent`);
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Section title="Patient">
        {patient ? (
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <T variant="h2">{patient.patientReference}{patient.name ? ` · ${patient.name}` : ''}</T>
              {!params.patientId ? <Button kind="ghost" compact label="Change" onPress={() => setSelected(undefined)} /> : null}
            </Row>
            <T muted>{[patient.age !== undefined ? `${patient.age} y` : null, patient.sex?.toLowerCase(), `${patient.visitCount} previous visit(s)`].filter(Boolean).join(' · ')}</T>
            {patient.isDemo ? <DemoBadge /> : null}
          </Card>
        ) : (
          <>
            <Field label="Find patient" value={q} onChangeText={setQ} placeholder="Reference or name" autoCapitalize="none" />
            {list.length === 0 ? <Empty icon="account-plus-outline" title="No patient found" message="Create the patient first." /> : null}
            {list.map((p) => (
              <Card key={p.patientId} onPress={() => setSelected(p.patientId)} accessibilityLabel={`Select ${p.patientReference}`}>
                <T style={{ fontWeight: '700' }}>{p.patientReference}{p.name ? ` · ${p.name}` : ''}</T>
                <T variant="small" muted>{p.visitCount} visit(s)</T>
              </Card>
            ))}
            <Button kind="secondary" label="Create new patient" icon="account-plus" onPress={() => router.push('/patient/new?next=visit')} />
          </>
        )}
      </Section>
      <Section title="Mode">
        <Segmented
          label="Visit mode"
          value={mode}
          onChange={(m) => (m === 'AMBIENT' && !settings.cloudProcessingEnabled ? undefined : setMode(m))}
          options={[{ value: 'AMBIENT', label: 'Record conversation' }, { value: 'MANUAL', label: 'Manual only' }]}
        />
        {!settings.cloudProcessingEnabled ? <Banner tone="info" message="Record conversation is unavailable because cloud processing is off (speech recognition and AI may use cloud services). Turn it on in Settings, or continue in manual mode." /> : null}
        <T variant="small" muted style={{ color: c.textMuted }}>
          {mode === 'AMBIENT' ? 'Next: confirm patient consent, then record. Nothing is recorded before consent.' : 'Next: enter facts manually and write the note. Nothing leaves this device.'}
        </T>
      </Section>
      <Button label="Continue" icon="arrow-right" disabled={!patient} busy={busy} onPress={() => void start()} />
    </Screen>
  );
}
