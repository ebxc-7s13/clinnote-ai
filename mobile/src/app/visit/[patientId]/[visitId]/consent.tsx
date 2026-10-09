/** Screen 7 — Consent. Explicit, not pre-checked; Decline → manual mode. */
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable } from 'react-native';
import { audit } from '../../../../domain/facts';
import { Banner, Button, Card, DemoBadge, Icon, Loading, Screen, Segmented, T } from '../../../../presentation/components';
import { showError, useApp, useVisit } from '../../../../presentation/AppContext';
import { CONSENT_TEXT } from '../../../../presentation/labels';
import { radius, space, useTheme } from '../../../../presentation/theme';

export default function Consent() {
  const { c } = useTheme();
  const { app } = useApp();
  const { patientId, visitId } = useLocalSearchParams<{ patientId: string; visitId: string }>();
  const { patient, visit, error, mutate } = useVisit(patientId, visitId);
  const [method, setMethod] = useState<'VERBAL_ATTESTED_BY_CLINICIAN' | 'WRITTEN_ATTESTED_BY_CLINICIAN'>('VERBAL_ATTESTED_BY_CLINICIAN');
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  if (error) return <Screen><Banner tone="danger" message={error} /></Screen>;
  if (!patient || !visit) return <Loading />;

  const confirm = async () => {
    setBusy(true);
    try {
      await mutate((v) => app.visits.recordConsent(v, method));
      router.replace(`/visit/${patientId}/${visitId}/record`);
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };
  const decline = async () => {
    try {
      await mutate((v) => {
        v.consent = { state: 'DECLINED', method, attestedByClinician: true, recordedAt: new Date().toISOString() };
        v.mode = 'MANUAL';
        v.transcriptState = 'SKIPPED';
        v.speakerMappingState = 'SKIPPED';
        v.clinicalExtractionState = 'SKIPPED';
        audit(v, 'CONSENT', v.visitId, 'CONSENT_DECLINED');
      });
      router.replace(`/visit/${patientId}/${visitId}/facts`);
    } catch (e) {
      showError(e);
    }
  };

  return (
    <Screen>
      <T variant="title">Recording consent</T>
      <T muted>{patient.patientReference} · {visit.visitCode}</T>
      {patient.isDemo ? <DemoBadge /> : null}
      <Card>
        <T>{CONSENT_TEXT}</T>
        <T variant="small" muted>
          What is recorded: the conversation audio and its transcript. Where it is processed: on this device and, with cloud processing on, by the configured transcription/AI service. Audio is temporary (deleted after the final transcript, at most 24 hours). No voiceprints are kept.
        </T>
      </Card>
      <T variant="small" muted>Consent method</T>
      <Segmented label="Consent method" value={method} onChange={setMethod} options={[{ value: 'VERBAL_ATTESTED_BY_CLINICIAN', label: 'Verbal' }, { value: 'WRITTEN_ATTESTED_BY_CLINICIAN', label: 'Written' }]} />
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={() => setChecked(!checked)} style={{ flexDirection: 'row', gap: space.md, alignItems: 'center', padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: checked ? c.primary : c.border, backgroundColor: c.surface, minHeight: 56 }}>
        <Icon name={checked ? 'checkbox-marked' : 'checkbox-blank-outline'} size={26} color={checked ? c.primary : c.textMuted} />
        <T style={{ flex: 1, fontWeight: '600' }}>I confirm appropriate consent was obtained.</T>
      </Pressable>
      <Button kind="record" label="Confirm and start recording" icon="microphone" disabled={!checked} busy={busy} onPress={() => void confirm()} />
      <Button kind="secondary" label="Consent declined — continue manually" icon="pencil-outline" onPress={() => void decline()} />
    </Screen>
  );
}
