/** Visit hub: workflow tracker in canonical order (ADR-023, ADR-050) with status in words, times and the next action. */
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { Alert } from 'react-native';
import { activeRecordingSegment, needsReconciliation, totalRecordedSec } from '../../../../domain/consultation';
import { evidenceOutdated } from '../../../../domain/evidence';
import { exportNote } from '../../../../domain/export';
import type { StageState } from '../../../../domain/types';
import { formatDateTime, formatDuration } from '../../../../domain/util';
import { unreviewedCount } from '../../../../domain/views';
import { Banner, Button, Card, Chip, DemoBadge, Loading, Row, Screen, Section, Stat, StepTracker, T, type Step } from '../../../../presentation/components';
import { showError, useApp, useVisit } from '../../../../presentation/AppContext';
import { askExport } from '../../../../presentation/exportUi';
import { NOTE_STATE_LABEL, STAGE_LABEL } from '../../../../presentation/labels';

const stateOf = (s: StageState): Step['state'] => (s === 'COMPLETED' ? 'done' : s === 'PARTIAL' || s === 'FAILED' ? 'warn' : s === 'SKIPPED' ? 'off' : s === 'IN_PROGRESS' ? 'current' : 'todo');

export default function VisitHub() {
  const { app } = useApp();
  const { patientId, visitId } = useLocalSearchParams<{ patientId: string; visitId: string }>();
  const { patient, visit, all, error, mutate } = useVisit(patientId, visitId);
  if (error) return <Screen><Banner tone="danger" message={error} /></Screen>;
  if (!patient || !visit || !all) return <Loading />;
  const base = `/visit/${patientId}/${visitId}`;
  const earlier = all.filter((x) => x.startedAt < visit.startedAt);
  const n = unreviewedCount(visit);
  const conflicts = visit.conflicts.filter((c) => c.status === 'OPEN').length;
  const ambient = visit.mode === 'AMBIENT';
  const consented = visit.consent?.state === 'CONFIRMED';
  const active = activeRecordingSegment(visit);
  const stale = needsReconciliation(visit);
  const evOld = evidenceOutdated(visit, patient);
  const at = (action: string) => [...visit.audit].reverse().find((a) => a.action === action)?.createdAt;

  const steps: Step[] = [
    ...(ambient
      ? [
          { key: 'consent', label: 'Consent', detail: visit.consent ? `${visit.consent.state.toLowerCase()} · ${formatDateTime(visit.consent.recordedAt)}` : 'not recorded', state: (consented ? 'done' : visit.consent ? 'warn' : 'current') as Step['state'], onPress: !visit.consent ? () => router.push(`${base}/consent`) : undefined },
          {
            key: 'rec',
            label: 'Consultation recording',
            detail: `${visit.recordingSegments.length} segment(s) · ${formatDuration(totalRecordedSec(visit))}${active ? ` · ${active.displayCode} ${active.status.toLowerCase()}` : ''}${visit.consultationState === 'FINALIZED' ? ` · finalized ${formatDateTime(visit.consultationFinalizedAt)}` : ' · consultation open'}`,
            state: (active ? 'current' : visit.consultationState === 'FINALIZED' ? 'done' : visit.recordingSegments.length ? 'warn' : 'todo') as Step['state'],
            onPress: consented ? () => router.push(`${base}/record`) : undefined,
          },
          {
            key: 'tr',
            label: 'Transcript and speaker roles',
            detail: `${STAGE_LABEL[visit.transcriptState]} · ${visit.segments.filter((s) => !s.excluded).length} utterance(s) · v${visit.transcriptVersion} · roles ${visit.speakerMappingState === 'COMPLETED' ? 'confirmed' : 'to confirm'}`,
            state: (visit.speakerMappingState === 'COMPLETED' ? 'done' : visit.segments.length ? 'current' : 'todo') as Step['state'],
            onPress: () => router.push(`${base}/transcript`),
          },
        ]
      : []),
    {
      key: 'facts',
      label: stale ? 'Reconcile complete visit' : 'Clinical facts',
      detail: stale ? 'new conversation or corrections since extraction' : `${ambient ? `${STAGE_LABEL[visit.clinicalExtractionState]} · ` : ''}${visit.facts.length} fact(s), ${n} to review${visit.lastReconciledAt ? ` · reconciled ${formatDateTime(visit.lastReconciledAt)}` : ''}`,
      state: stale ? 'warn' : n || conflicts ? 'warn' : visit.facts.length ? 'done' : 'todo',
      onPress: () => router.push(stale ? `${base}/transcript?reconcile=1` : `${base}/facts`),
    },
    { key: 'meds', label: 'Medications', detail: `${visit.facts.filter((f) => f.category === 'MEDICATION' && f.conceptKey !== 'ANY').length} mentioned`, state: 'todo', onPress: () => router.push(`${base}/medications`) },
    { key: 'ev', label: 'Evidence', detail: `${STAGE_LABEL[visit.evidenceState]} · ${visit.evidence.length} source record(s)${evOld ? ' · may be outdated' : ''}`, state: evOld ? 'warn' : stateOf(visit.evidenceState), onPress: () => router.push(`${base}/evidence`) },
    { key: 'report', label: 'Clinical report', detail: visit.reportVersions.length ? `version ${visit.reportVersions.length} · ${formatDateTime(visit.reportVersions[visit.reportVersions.length - 1].generatedAt)}` : 'not saved yet', state: visit.reportVersions.length ? (stale ? 'warn' : 'done') : 'todo', onPress: () => router.push(`${base}/report`) },
    { key: 'review', label: 'Clinical review', detail: visit.candidateState === 'SKIPPED' ? 'possibilities off or skipped' : `possibilities ${STAGE_LABEL[visit.candidateState]}`, state: 'todo', onPress: () => router.push(`${base}/review`) },
    { key: 'note', label: 'Note', detail: `${NOTE_STATE_LABEL[visit.noteState]}${visit.finalizedAt ? ` · ${formatDateTime(visit.finalizedAt)}` : ''}`, state: visit.noteState === 'FINALIZED' ? 'done' : visit.noteState === 'NONE' ? 'todo' : 'current', onPress: () => router.push(`${base}/note`) },
    ...(earlier.length ? [{ key: 'cmp', label: 'Compare with previous visit', detail: `previous: ${earlier[earlier.length - 1].visitCode}`, state: 'todo' as const, onPress: () => router.push(`${base}/compare`) }] : []),
  ];

  const del = () =>
    Alert.alert(`Delete visit ${visit.visitCode}?`, 'The transcript, facts, evidence and note of this visit are deleted from this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await app.store.deleteVisit(patientId, visitId);
            router.back();
          } catch (e) {
            showError(e);
          }
        },
      },
    ]);

  return (
    <Screen>
      <Stack.Screen options={{ title: `${patient.patientReference} · ${visit.visitCode}` }} />
      <Card strong>
        <T variant="h2">{patient.patientReference} · {visit.visitCode}</T>
        <T muted>Started {formatDateTime(visit.startedAt)} · {ambient ? `recorded ${formatDuration(totalRecordedSec(visit))}` : 'manual visit'}{at('CONSULTATION_FINALIZED') ? ` · finalized ${formatDateTime(visit.consultationFinalizedAt)}` : ''}</T>
        <Row wrap>
          {patient.isDemo ? <DemoBadge /> : null}
          {n ? <Chip label={`${n} not yet reviewed`} tone="warning" icon="progress-question" /> : null}
          {conflicts ? <Chip label={`${conflicts} conflict(s) — review`} tone="danger" icon="alert-outline" /> : null}
          {stale ? <Chip label="reconcile needed" tone="warning" icon="source-merge" /> : null}
        </Row>
      </Card>
      {visit.consent?.state === 'WITHDRAWN' ? <Banner tone="warning" message="Consent was withdrawn during this visit. Recording stopped." /> : null}
      {stale ? <Banner tone="warning" title="New conversation added" message="Facts and the report were made before the latest conversation. Reconcile the complete visit to include it." action={<Button compact label="Reconcile complete visit" icon="source-merge" onPress={() => router.push(`${base}/transcript?reconcile=1`)} />} /> : null}

      <Row>
        <Stat value={visit.recordingSegments.length} label="segments" icon="microphone-outline" tone="primary" onPress={consented ? () => router.push(`${base}/record`) : undefined} />
        <Stat value={visit.facts.filter((f) => f.status === 'CONFIRMED').length} label="confirmed facts" icon="check-circle" tone="success" onPress={() => router.push(`${base}/facts`)} />
        <Stat value={visit.evidence.length} label="sources" icon="book-open-variant" tone="info" onPress={() => router.push(`${base}/evidence`)} />
      </Row>

      {ambient && consented ? (
        <Row>
          <Button kind="record" label={active ? 'Open recording' : visit.recordingSegments.length ? 'Add more conversation' : 'Start recording'} icon={active ? 'record-rec' : visit.recordingSegments.length ? 'microphone-plus' : 'microphone'} onPress={() => router.push(`${base}/record`)} style={{ flex: 1 }} />
          <Button label="Clinical report" icon="file-document-multiple-outline" onPress={() => router.push(`${base}/report`)} style={{ flex: 1 }} />
        </Row>
      ) : (
        <Button label="Clinical report" icon="file-document-multiple-outline" onPress={() => router.push(`${base}/report`)} />
      )}

      <Section title="Workflow">
        <Card>
          <StepTracker steps={steps} />
        </Card>
      </Section>

      <Section title="Actions">
        <Button kind="secondary" label="Open patient" icon="account-outline" onPress={() => router.push(`/patient/${patientId}`)} />
        <Button
          kind="secondary"
          label="Export note"
          icon="export-variant"
          disabled={!visit.noteVersions.length}
          onPress={() =>
            askExport(async () => {
              let doc = null as ReturnType<typeof exportNote> | null;
              await mutate((v) => {
                doc = exportNote(patient, v);
              });
              if (!doc) throw new Error('Nothing to export.');
              return doc;
            })
          }
        />
        <Button kind="danger" label="Delete visit" icon="delete-outline" onPress={del} />
      </Section>
    </Screen>
  );
}
