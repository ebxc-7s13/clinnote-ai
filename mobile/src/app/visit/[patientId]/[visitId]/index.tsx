/** Visit hub: pipeline stages in canonical order (ADR-023) with status in words and the next action. */
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { Alert, Pressable, View } from 'react-native';
import { exportNote } from '../../../../domain/export';
import type { StageState } from '../../../../domain/types';
import { formatDateTime, formatDuration } from '../../../../domain/util';
import { unreviewedCount } from '../../../../domain/views';
import { Banner, Button, Card, Chip, DemoBadge, Icon, Loading, Row, Screen, Section, T, type IconName } from '../../../../presentation/components';
import { showError, useApp, useVisit } from '../../../../presentation/AppContext';
import { askExport } from '../../../../presentation/exportUi';
import { NOTE_STATE_LABEL, STAGE_LABEL } from '../../../../presentation/labels';
import { space, useTheme } from '../../../../presentation/theme';

function StageRow({ icon, title, status, tone, onPress }: { icon: IconName; title: string; status: string; tone: 'done' | 'todo' | 'warn' | 'off'; onPress?: () => void }) {
  const { c } = useTheme();
  const color = tone === 'done' ? c.success : tone === 'warn' ? c.warning : c.textMuted;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}: ${status}`} disabled={!onPress} onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, opacity: pressed ? 0.7 : 1 })}>
      <Icon name={tone === 'done' ? 'check-circle' : tone === 'warn' ? 'alert-circle-outline' : icon} color={color} size={24} />
      <View style={{ flex: 1 }}>
        <T style={{ fontWeight: '600' }}>{title}</T>
        <T variant="small" muted>{status}</T>
      </View>
      {onPress ? <Icon name="chevron-right" /> : null}
    </Pressable>
  );
}

const toneOf = (s: StageState): 'done' | 'todo' | 'warn' | 'off' => (s === 'COMPLETED' ? 'done' : s === 'PARTIAL' || s === 'FAILED' ? 'warn' : s === 'SKIPPED' ? 'off' : 'todo');

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
  const recordingOpen = visit.recordingState === 'RECORDING' || visit.recordingState === 'PAUSED' || visit.recordingState === 'NOT_STARTED';

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
      <Card>
        <T variant="h2">{patient.patientReference} · {visit.visitCode}</T>
        <T muted>{formatDateTime(visit.startedAt)} · {ambient ? `recorded ${formatDuration(visit.recordingDurationSec)}` : 'manual visit'}</T>
        <Row wrap>
          {patient.isDemo ? <DemoBadge /> : null}
          {n ? <Chip label={`${n} not yet reviewed`} tone="warning" icon="progress-question" /> : null}
          {conflicts ? <Chip label={`${conflicts} conflict(s) — review`} tone="danger" icon="alert-outline" /> : null}
        </Row>
      </Card>
      {visit.consent?.state === 'WITHDRAWN' ? <Banner tone="warning" message="Consent was withdrawn during this visit. Recording stopped." /> : null}

      <Section title="Workflow">
        <Card>
          {ambient ? (
            <>
              <StageRow icon="shield-check-outline" title="Consent" status={visit.consent ? visit.consent.state.toLowerCase() : 'not recorded'} tone={visit.consent?.state === 'CONFIRMED' ? 'done' : 'todo'} onPress={!visit.consent ? () => router.push(`${base}/consent`) : undefined} />
              <StageRow icon="microphone-outline" title="Recording" status={visit.recordingState.toLowerCase().replace('_', ' ')} tone={visit.recordingState === 'STOPPED' ? 'done' : visit.recordingState === 'FAILED' ? 'warn' : 'todo'} onPress={visit.consent?.state === 'CONFIRMED' && recordingOpen ? () => router.push(`${base}/record`) : undefined} />
              <StageRow icon="text-box-outline" title="Transcript and speaker roles" status={`${STAGE_LABEL[visit.transcriptState]} · ${visit.segments.length} segment(s) · roles ${visit.speakerMappingState === 'COMPLETED' ? 'confirmed' : 'not confirmed'}`} tone={visit.speakerMappingState === 'COMPLETED' ? 'done' : toneOf(visit.transcriptState) === 'done' ? 'todo' : toneOf(visit.transcriptState)} onPress={() => router.push(`${base}/transcript`)} />
            </>
          ) : null}
          <StageRow icon="format-list-checks" title="Clinical facts" status={`${ambient ? STAGE_LABEL[visit.clinicalExtractionState] + ' · ' : ''}${visit.facts.length} fact(s), ${n} to review`} tone={n || conflicts ? 'warn' : visit.facts.length ? 'done' : 'todo'} onPress={() => router.push(`${base}/facts`)} />
          <StageRow icon="pill" title="Medications" status={`${visit.facts.filter((f) => f.category === 'MEDICATION' && f.conceptKey !== 'ANY').length} mentioned`} tone="todo" onPress={() => router.push(`${base}/medications`)} />
          <StageRow icon="book-open-variant" title="Evidence" status={`${STAGE_LABEL[visit.evidenceState]} · ${visit.evidence.length} source record(s)`} tone={toneOf(visit.evidenceState)} onPress={() => router.push(`${base}/evidence`)} />
          <StageRow icon="clipboard-check-outline" title="Clinical review" status={visit.candidateState === 'SKIPPED' ? 'possibilities off or skipped' : `possibilities ${STAGE_LABEL[visit.candidateState]}`} tone="todo" onPress={() => router.push(`${base}/review`)} />
          <StageRow icon="note-edit-outline" title="Note" status={NOTE_STATE_LABEL[visit.noteState]} tone={visit.noteState === 'FINALIZED' ? 'done' : visit.noteState === 'NONE' ? 'todo' : 'warn'} onPress={() => router.push(`${base}/note`)} />
          {earlier.length ? <StageRow icon="compare-horizontal" title="Compare with previous visit" status={`previous: ${earlier[earlier.length - 1].visitCode}`} tone="todo" onPress={() => router.push(`${base}/compare`)} /> : null}
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
