/**
 * Screen 9 — Transcript. Speaker mapping first (DOCTOR / PATIENT / OTHER / UNKNOWN); continue to extraction only
 * after the clinician confirms it (ADR-021). Segments can be corrected, relabeled and jumped to by timestamp.
 * The transcript is never discarded when AI fails.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { FlatList, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { correctSegment, parseTimestamp, segmentIndexAt } from '../../../../domain/transcript';
import type { SpeakerRole, TranscriptSegment } from '../../../../domain/types';
import { formatDuration } from '../../../../domain/util';
import { BottomBar, Banner, Button, Card, Chip, Empty, Field, Loading, Row, Segmented, T } from '../../../../presentation/components';
import { showError, useApp, useVisit } from '../../../../presentation/AppContext';
import { radius, space, useTheme } from '../../../../presentation/theme';

const ROLES: { value: SpeakerRole; label: string }[] = [
  { value: 'DOCTOR', label: 'Doctor' },
  { value: 'PATIENT', label: 'Patient' },
  { value: 'OTHER', label: 'Other' },
  { value: 'UNKNOWN', label: 'Unknown' },
];

function SegmentRow({ s, onSave }: { s: TranscriptSegment; onSave: (text: string, role: SpeakerRole) => Promise<void> }) {
  const { c } = useTheme();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(s.text);
  const [role, setRole] = useState<SpeakerRole>(s.speakerRole);
  return (
    <Card accessibilityLabel={`${s.displayCode}, ${s.speakerRole}, ${formatDuration(s.startTime)}: ${s.text}`}>
      <Row wrap>
        <Chip label={s.speakerRole} tone={s.speakerRole === 'DOCTOR' ? 'primary' : s.speakerRole === 'PATIENT' ? 'info' : 'neutral'} />
        <T variant="small" muted>{s.displayCode} · {formatDuration(s.startTime)}</T>
        {s.confidence === 'LOW' ? <Chip label="unclear — check" tone="warning" icon="ear-hearing-off" /> : null}
        {s.editedByClinician ? <Chip label="edited" tone="neutral" icon="pencil" /> : null}
      </Row>
      {editing ? (
        <>
          <TextInput accessibilityLabel={`Edit ${s.displayCode}`} value={text} onChangeText={setText} multiline style={{ minHeight: 80, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, padding: space.sm, color: c.text, backgroundColor: c.bg, fontSize: 15, textAlignVertical: 'top' }} />
          <Segmented label="Speaker for this segment" value={role} onChange={setRole} options={ROLES} />
          <Row>
            <Button kind="secondary" compact label="Cancel" onPress={() => { setText(s.text); setRole(s.speakerRole); setEditing(false); }} style={{ flex: 1 }} />
            <Button compact label="Save correction" onPress={() => void onSave(text, role).then(() => setEditing(false))} style={{ flex: 1 }} />
          </Row>
        </>
      ) : (
        <>
          <T selectable>{s.text}</T>
          <Button kind="ghost" compact label="Correct text or speaker" icon="pencil-outline" onPress={() => setEditing(true)} style={{ alignSelf: 'flex-start' }} />
        </>
      )}
    </Card>
  );
}

export default function Transcript() {
  const { c } = useTheme();
  const { app, settings } = useApp();
  const { patientId, visitId } = useLocalSearchParams<{ patientId: string; visitId: string }>();
  const { visit, all, error, mutate } = useVisit(patientId, visitId);
  const [mapping, setMapping] = useState<Record<string, SpeakerRole>>({});
  const [jump, setJump] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const listRef = useRef<FlatList<TranscriptSegment>>(null);

  if (error) return <View style={{ flex: 1, padding: space.lg }}><Banner tone="danger" message={error} /></View>;
  if (!visit || !all) return <Loading />;

  const speakers = Array.from(new Set(visit.segments.map((s) => s.speakerId)));
  const roleFor = (id: string) => mapping[id] ?? visit.segments.find((s) => s.speakerId === id)?.speakerRole ?? 'UNKNOWN';
  const confirmed = visit.speakerMappingState === 'COMPLETED';
  const extracted = visit.clinicalExtractionState !== 'NOT_STARTED' && visit.clinicalExtractionState !== 'SKIPPED';

  const confirmRoles = async () => {
    try {
      await mutate((v) => {
        const m: Record<string, SpeakerRole> = {};
        for (const id of speakers) m[id] = roleFor(id);
        if (confirmed && extracted) {
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
        const r = await app.visits.runExtraction(v, settings, ctx.all.filter((x) => x.visitId !== v.visitId));
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
        <Chip label={visit.transcriptSource === 'GEMINI_FINAL' ? 'Final transcript (cloud, speaker-separated)' : visit.transcriptSource === 'LIVE_DEVICE' ? 'Live on-device transcript' : visit.transcriptSource === 'MANUAL' ? 'Manual' : 'No transcript'} tone="info" icon="text-box-outline" />
        <Chip label={confirmed ? 'Speaker roles confirmed' : 'Speaker roles not confirmed'} tone={confirmed ? 'success' : 'warning'} icon={confirmed ? 'check-circle' : 'account-question-outline'} />
      </Row>
      {visit.transcriptState === 'PARTIAL' ? <Banner tone="warning" message="The final transcript could not be created. The live transcript is kept and used." /> : null}
      {visit.speakerAssignmentUncertain ? <Banner tone="warning" message="Speaker assignment is uncertain. Check each speaker below before continuing." /> : null}
      {msg ? <Banner tone="info" message={msg} /> : null}
      {visit.segments.length ? (
        <Card>
          <T variant="h3">Speaker roles</T>
          <T variant="small" muted>Provenance is assigned from these roles: Doctor → clinician-stated, Patient → patient-reported, Other/Unknown → transcript.</T>
          {speakers.map((id) => (
            <View key={id} style={{ gap: 4 }}>
              <T variant="small" style={{ fontWeight: '700' }}>
                {id.startsWith('Live-') ? `Live tag ${id.slice(5)}` : id.startsWith('manual-') ? `Relabeled segments (${id.slice(7).toLowerCase()})` : `Speaker ${id}`} · {visit.segments.filter((s) => s.speakerId === id).length} segment(s) · “{visit.segments.find((s) => s.speakerId === id)?.text.slice(0, 50)}…”
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
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['left', 'right', 'bottom']}>
      <FlatList
        ref={listRef}
        data={visit.segments}
        keyExtractor={(s) => s.segmentId}
        contentContainerStyle={{ padding: space.lg, gap: space.sm, paddingBottom: 140 }}
        ListHeaderComponent={header}
        onScrollToIndexFailed={(e) => listRef.current?.scrollToOffset({ offset: e.averageItemLength * e.index, animated: true })}
        ListEmptyComponent={<Empty icon="microphone-off" title="No speech captured" message="Nothing was transcribed. Continue with manual entry." action={<Button label="Enter facts manually" onPress={() => router.push(`/visit/${patientId}/${visitId}/facts`)} />} />}
        renderItem={({ item }) => (
          <SegmentRow
            s={item}
            onSave={async (text, role) => {
              try {
                let flagged = 0;
                await mutate((v) => {
                  flagged = correctSegment(v, item.segmentId, { text, role });
                });
                if (flagged) setMsg(`${flagged} fact(s) based on this segment were returned to review (source changed). Re-run extraction to update them.`);
              } catch (e) {
                showError(e);
              }
            }}
          />
        )}
      />
      <BottomBar gap={space.xs}>
        {!confirmed && visit.segments.length ? <T variant="small" muted>Confirm the speaker roles to continue.</T> : null}
        <Button label={extracted ? 'Re-run clinical fact extraction' : 'Continue to clinical fact extraction'} icon="text-search" disabled={!confirmed} busy={busy} onPress={() => void extract()} />
      </BottomBar>
    </SafeAreaView>
  );
}
