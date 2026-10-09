/**
 * Screen 9 — Transcript review (ADR-021, ADR-050). Utterances grouped by recording segment, each with speaker,
 * time, language, status and uncertainty. Tools: correct text/speaker, split, merge with next, mark uncertain,
 * exclude an accidental duplicate (confirmed; kept and restorable), add a typed utterance. Every change is a new
 * transcript version with the original kept in the revision history; facts citing a changed utterance return to
 * review. Speaker roles must be confirmed before facts are extracted or the visit is reconciled.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, FlatList, TextInput, View } from 'react-native';
import { canonicalTranscript, needsReconciliation } from '../../../../domain/consultation';
import { languageName } from '../../../../domain/languages';
import { addManualSegment, canMergeWithNext, correctSegment, excludeSegment, markSegmentUncertain, mergeWithNext, parseTimestamp, restoreSegment, segmentIndexAt, splitSegment } from '../../../../domain/transcript';
import type { SpeakerRole, TranscriptSegment, Visit } from '../../../../domain/types';
import { formatDateTime, formatDuration } from '../../../../domain/util';
import { BottomBar, Banner, Button, Card, Chip, Empty, Field, Loading, Row, ScreenSurface, Segmented, T } from '../../../../presentation/components';
import { showError, useApp, useVisit } from '../../../../presentation/AppContext';
import { radius, space, useTheme } from '../../../../presentation/theme';

const ROLES: { value: SpeakerRole; label: string }[] = [
  { value: 'DOCTOR', label: 'Doctor' },
  { value: 'PATIENT', label: 'Patient' },
  { value: 'OTHER', label: 'Other' },
  { value: 'UNKNOWN', label: 'Unknown' },
];

/** Split points at sentence ends, else at commas — never inside a word. */
function splitPoint(text: string): number | null {
  const m = /[.?!]\s+(?=\S)/.exec(text) ?? /,\s+(?=\S)/.exec(text);
  return m ? m.index + m[0].length : null;
}

const ORIGIN: Record<string, string> = { LIVE: 'live', PARTIAL_COMMIT: 'kept partial — check', FINAL: 'cloud final', MANUAL: 'typed by clinician', SPLIT: 'split', DEMO: 'synthetic script' };

type Act = (fn: (v: Visit) => number | void) => Promise<void>;

function SegmentRow({ s, v, act, isNew }: { s: TranscriptSegment; v: Visit; act: Act; isNew: boolean }) {
  const { c } = useTheme();
  const [editing, setEditing] = useState(false);
  const [tools, setTools] = useState(false);
  const [text, setText] = useState(s.text);
  const [role, setRole] = useState<SpeakerRole>(s.speakerRole);
  const sp = splitPoint(s.text);
  const repeatOf = s.possibleRepeatOf ? v.segments.find((x) => x.segmentId === s.possibleRepeatOf)?.displayCode : undefined;
  if (s.excluded)
    return (
      <Card style={{ opacity: 0.7 }} accessibilityLabel={`${s.displayCode} excluded`}>
        <Row wrap>
          <Chip label={s.excluded.reason === 'MERGED' ? `Merged into ${v.segments.find((x) => x.segmentId === s.excluded?.mergedIntoSegmentId)?.displayCode ?? 'another utterance'}` : `Excluded (${s.excluded.reason.toLowerCase()}) — kept as evidence`} tone="neutral" icon="eye-off-outline" />
          <T variant="small" muted>{s.displayCode}</T>
        </Row>
        <T variant="small" muted style={{ textDecorationLine: 'line-through' }}>{s.text}</T>
        {s.excluded.reason !== 'MERGED' ? <Button kind="ghost" compact label="Restore" icon="restore" onPress={() => void act((x) => restoreSegment(x, s.segmentId))} style={{ alignSelf: 'flex-start' }} /> : null}
      </Card>
    );
  return (
    <Card accessibilityLabel={`${s.displayCode}, ${s.speakerRole}, ${formatDuration(s.startTime)}: ${s.text}`} style={isNew ? { borderColor: c.success, borderWidth: 1.5 } : undefined}>
      <Row wrap>
        <Chip label={s.speakerRole} tone={s.speakerRole === 'DOCTOR' ? 'primary' : s.speakerRole === 'PATIENT' ? 'info' : 'neutral'} />
        <T variant="small" muted>{s.displayCode} · {formatDuration(s.startTime)} · {languageName(s.language ?? 'en-US')} · {ORIGIN[s.origin ?? 'LIVE'] ?? 'live'}</T>
        {isNew ? <Chip label="new" tone="success" icon="new-box" /> : null}
        {s.confidence === 'LOW' ? <Chip label="unclear — check" tone="warning" icon="ear-hearing-off" /> : null}
        {s.clinicianMarkedUncertain ? <Chip label="marked uncertain" tone="warning" icon="help-circle-outline" /> : null}
        {s.editedByClinician ? <Chip label="edited" tone="neutral" icon="pencil" /> : null}
        {repeatOf ? <Chip label={`possible repeat of ${repeatOf}`} tone="neutral" icon="repeat" /> : null}
      </Row>
      {editing ? (
        <>
          <TextInput accessibilityLabel={`Edit ${s.displayCode}`} value={text} onChangeText={setText} multiline style={{ minHeight: 80, borderWidth: 1, borderColor: c.glassBorder, borderRadius: radius.md, padding: space.sm, color: c.text, backgroundColor: c.glassStrong, fontSize: 15, textAlignVertical: 'top' }} />
          <Segmented label="Speaker for this segment" value={role} onChange={setRole} options={ROLES} />
          <Row>
            <Button kind="secondary" compact label="Cancel" onPress={() => { setText(s.text); setRole(s.speakerRole); setEditing(false); }} style={{ flex: 1 }} />
            <Button compact label="Save correction" onPress={() => void act((x) => correctSegment(x, s.segmentId, { text, role })).then(() => setEditing(false))} style={{ flex: 1 }} />
          </Row>
        </>
      ) : (
        <>
          <T selectable>{s.text}</T>
          <Row wrap>
            <Button kind="ghost" compact label="Correct text or speaker" icon="pencil-outline" onPress={() => setEditing(true)} />
            <Button kind="ghost" compact label={tools ? 'Fewer tools' : 'More tools'} icon={tools ? 'chevron-up' : 'dots-horizontal'} onPress={() => setTools(!tools)} />
          </Row>
          {tools ? (
            <Row wrap>
              {sp !== null ? <Button kind="secondary" compact label="Split" icon="call-split" onPress={() => void act((x) => void splitSegment(x, s.segmentId, sp))} /> : null}
              {canMergeWithNext(v, s.segmentId) ? <Button kind="secondary" compact label="Merge with next" icon="call-merge" onPress={() => void act((x) => mergeWithNext(x, s.segmentId))} /> : null}
              <Button kind="secondary" compact label={s.clinicianMarkedUncertain ? 'Clear uncertain' : 'Mark uncertain'} icon="help-circle-outline" onPress={() => void act((x) => markSegmentUncertain(x, s.segmentId, !s.clinicianMarkedUncertain))} />
              <Button
                kind="secondary"
                compact
                label="Exclude duplicate"
                icon="eye-off-outline"
                onPress={() =>
                  Alert.alert('Exclude this utterance?', 'It is left out of the consolidated transcript and the report. The text stays in the record and can be restored.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Exclude', style: 'destructive', onPress: () => void act((x) => excludeSegment(x, s.segmentId, 'DUPLICATE')) },
                  ])
                }
              />
            </Row>
          ) : null}
        </>
      )}
    </Card>
  );
}

function AddUtterance({ onAdd, segments }: { onAdd: (text: string, role: SpeakerRole, recSegId?: string) => Promise<void>; segments: Visit['recordingSegments'] }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [role, setRole] = useState<SpeakerRole>('DOCTOR');
  if (!open) return <Button kind="secondary" label="Add typed utterance" icon="keyboard-outline" onPress={() => setOpen(true)} />;
  const last = segments[segments.length - 1];
  return (
    <Card>
      <T variant="h3">Add what was said (typed by clinician){last ? ` · ${last.displayCode}` : ''}</T>
      <Field label="Words as spoken" value={text} onChangeText={setText} multiline />
      <Segmented label="Speaker" value={role} onChange={setRole} options={ROLES} />
      <Row>
        <Button kind="ghost" compact label="Cancel" onPress={() => setOpen(false)} style={{ flex: 1 }} />
        <Button compact label="Add" disabled={!text.trim()} style={{ flex: 1 }} onPress={() => void onAdd(text, role, last?.recordingSegmentId).then(() => { setText(''); setOpen(false); })} />
      </Row>
    </Card>
  );
}

export default function Transcript() {
  const { app, settings } = useApp();
  const { patientId, visitId, segment: newSegId, reconcile } = useLocalSearchParams<{ patientId: string; visitId: string; segment?: string; reconcile?: string }>();
  const { visit, all, error, mutate } = useVisit(patientId, visitId);
  const [mapping, setMapping] = useState<Record<string, SpeakerRole>>({});
  const [jump, setJump] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const listRef = useRef<FlatList<TranscriptSegment>>(null);

  if (error) return <View style={{ flex: 1, padding: space.lg }}><Banner tone="danger" message={error} /></View>;
  if (!visit || !all) return <Loading />;

  const live = visit.segments.filter((s) => !s.excluded);
  const speakers = Array.from(new Set(live.map((s) => s.speakerId)));
  const roleFor = (id: string) => mapping[id] ?? live.find((s) => s.speakerId === id)?.speakerRole ?? 'UNKNOWN';
  const confirmed = visit.speakerMappingState === 'COMPLETED';
  const extracted = visit.clinicalExtractionState !== 'NOT_STARTED' && visit.clinicalExtractionState !== 'SKIPPED';
  const stale = needsReconciliation(visit);
  const unconfirmedNew = live.filter((s) => !s.speakerRoleConfirmed).length;
  const recCode = new Map(visit.recordingSegments.map((r) => [r.recordingSegmentId, r]));

  const act: Act = async (fn) => {
    try {
      let flagged = 0;
      await mutate((v) => {
        flagged = fn(v) || 0;
      });
      if (flagged) setMsg(`${flagged} fact(s) based on this utterance returned to review (source changed). Reconcile the visit to update them.`);
    } catch (e) {
      showError(e);
    }
  };

  const confirmRoles = async () => {
    try {
      await mutate((v) => {
        const m: Record<string, SpeakerRole> = {};
        for (const id of speakers) m[id] = roleFor(id);
        if (extracted) {
          // after extraction a role change is a correction: affected facts return to review (SOURCE_CHANGED)
          for (const s of v.segments) if (m[s.speakerId] && m[s.speakerId] !== s.speakerRole) correctSegment(v, s.segmentId, { role: m[s.speakerId] }, { detach: false });
        }
        app.visits.confirmRoles(v, m);
      });
      setMapping({});
      setMsg('Speaker roles confirmed.');
    } catch (e) {
      showError(e);
    }
  };

  const extract = async () => {
    setBusy(true);
    setMsg(null);
    try {
      let out: string | undefined;
      await mutate(async (v, ctx) => {
        const r = await app.visits.runExtraction(v, settings, ctx.all.filter((x) => x.visitId !== v.visitId), ctx.patient);
        out = r.message;
      });
      if (out) setMsg(out);
      router.push(`/visit/${patientId}/${visitId}/facts`);
    } catch (e) {
      showError(e, 'Extraction could not run. The transcript is unchanged.');
    } finally {
      setBusy(false);
    }
  };

  const doJump = () => {
    const sec = parseTimestamp(jump);
    if (sec === null) return setMsg('Enter a time like 01:30.');
    const i = segmentIndexAt(visit, sec);
    if (i >= 0) listRef.current?.scrollToIndex({ index: i, animated: true, viewPosition: 0 });
  };

  const header = (
    <View style={{ gap: space.md, paddingBottom: space.sm }}>
      <Row wrap>
        <Chip label={visit.transcriptSource === 'GEMINI_FINAL' ? 'Includes cloud final pass (speaker-separated)' : visit.transcriptSource === 'LIVE_DEVICE' ? 'Live on-device transcript' : visit.transcriptSource === 'MANUAL' ? 'Manual' : 'No transcript'} tone="info" icon="text-box-outline" />
        <Chip label={confirmed ? 'Speaker roles confirmed' : 'Speaker roles not confirmed'} tone={confirmed ? 'success' : 'warning'} icon={confirmed ? 'check-circle' : 'account-question-outline'} />
        <Chip label={`Version ${visit.transcriptVersion} · ${canonicalTranscript(visit).length} utterance(s)`} tone="neutral" icon="history" />
      </Row>
      {reconcile || stale ? <Banner tone="warning" title="Reconcile the complete visit" message={stale ? 'The transcript changed after facts were extracted (new conversation or corrections). Confirm speaker roles, then reconcile: the whole consultation is re-read, earlier facts you confirmed are kept, and changes are listed as conflicts.' : 'Confirm the speaker roles, then reconcile to extract facts from every segment.'} /> : null}
      {visit.transcriptState === 'PARTIAL' ? <Banner tone="warning" message="The final transcript could not be created. The live transcript is kept and used." /> : null}
      {visit.speakerAssignmentUncertain ? <Banner tone="warning" message="Speaker assignment is uncertain. Check each speaker below before continuing." /> : null}
      {msg ? <Banner tone="info" message={msg} /> : null}
      <T variant="small" muted>Replay: not available — temporary audio is never kept after transcription (ADR-014). Correct wording from the conversation as you remember it; the original is kept in the history.</T>
      {live.length ? (
        <Card>
          <T variant="h3">Speaker roles</T>
          {unconfirmedNew ? <Chip label={`${unconfirmedNew} utterance(s) with unconfirmed speaker`} tone="warning" icon="account-question-outline" /> : null}
          <T variant="small" muted>Provenance is assigned from these roles: Doctor → clinician-stated, Patient → patient-reported, Other/Unknown → transcript.</T>
          {speakers.map((id) => (
            <View key={id} style={{ gap: 4 }}>
              <T variant="small" style={{ fontWeight: '700' }}>
                {id.startsWith('Live-') ? `Live tag ${id.slice(5)}` : id.startsWith('manual-') ? `Relabeled or typed (${id.slice(7).toLowerCase()})` : `Speaker ${id}`} · {live.filter((s) => s.speakerId === id).length} utterance(s) · “{live.find((s) => s.speakerId === id)?.text.slice(0, 50)}…”
              </T>
              <Segmented label={`Role for speaker ${id}`} value={roleFor(id)} onChange={(r) => setMapping({ ...mapping, [id]: r })} options={ROLES} />
            </View>
          ))}
          <Button kind={confirmed && !Object.keys(mapping).length ? 'secondary' : 'primary'} label={confirmed ? 'Re-confirm speaker roles' : 'Confirm speaker roles'} icon="account-check-outline" onPress={() => void confirmRoles()} />
        </Card>
      ) : null}
      {visit.segments.length > 3 ? (
        <Row>
          <View style={{ flex: 1 }}>
            <Field label="Jump to time" value={jump} onChangeText={setJump} placeholder="mm:ss" keyboardType="numbers-and-punctuation" />
          </View>
          <Button kind="secondary" compact label="Go" onPress={doJump} style={{ marginTop: 18 }} />
        </Row>
      ) : null}
    </View>
  );

  return (
    <ScreenSurface>
      <FlatList
        ref={listRef}
        data={visit.segments}
        keyExtractor={(s) => s.segmentId}
        contentContainerStyle={{ padding: space.lg, gap: space.sm, paddingBottom: 160 }}
        ListHeaderComponent={header}
        ListFooterComponent={
          <View style={{ marginTop: space.sm, gap: space.sm }}>
            <AddUtterance
              segments={visit.recordingSegments}
              onAdd={(text, role, recSegId) => act((v) => void addManualSegment(v, { text, role, recordingSegmentId: recSegId }))}
            />
            {visit.consent?.state === 'CONFIRMED' ? <Button kind="secondary" label="Record more conversation" icon="microphone-plus" onPress={() => router.push(`/visit/${patientId}/${visitId}/record`)} /> : null}
          </View>
        }
        onScrollToIndexFailed={(e) => listRef.current?.scrollToOffset({ offset: e.averageItemLength * e.index, animated: true })}
        ListEmptyComponent={<Empty icon="microphone-off" title="No speech captured" message="Nothing was transcribed. Add what was said, or continue with manual entry." action={<Button label="Enter facts manually" onPress={() => router.push(`/visit/${patientId}/${visitId}/facts`)} />} />}
        renderItem={({ item, index }) => {
          const rs = recCode.get(item.recordingSegmentId ?? '');
          const first = index === 0 || visit.segments[index - 1].recordingSegmentId !== item.recordingSegmentId;
          return (
            <View style={{ gap: space.sm }}>
              {first && rs ? (
                <Row style={{ marginTop: index ? space.md : 0 }} wrap>
                  <T variant="h3">{rs.displayCode}</T>
                  <T variant="small" muted>{formatDateTime(rs.startedAt)}{rs.endedAt ? ` – ${formatDateTime(rs.endedAt).slice(-5)}` : ''} · {languageName(rs.language)} · {rs.transcriptionStatus.toLowerCase()}</T>
                  {rs.recordingSegmentId === newSegId ? <Chip label="newly added" tone="success" /> : null}
                </Row>
              ) : null}
              <SegmentRow s={item} v={visit} act={act} isNew={!!newSegId && item.recordingSegmentId === newSegId} />
            </View>
          );
        }}
      />
      <BottomBar gap={space.xs}>
        {!confirmed && live.length ? <T variant="small" muted>Confirm the speaker roles to continue.</T> : null}
        <Button label={extracted ? 'Reconcile complete visit' : 'Continue to clinical fact extraction'} icon={extracted ? 'source-merge' : 'text-search'} disabled={!confirmed} busy={busy} onPress={() => void extract()} />
      </BottomBar>
    </ScreenSurface>
  );
}
