/**
 * Fact detail: value, the three independent attributes (state, provenance incl. origin/root origin, review status),
 * source segments with time, version history and conflicts. Actions are clinician-only: confirm, reject, restore,
 * edit (new CONFIRMED version; old kept), add to problem list, medication information.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { confirmFact, editFact, isCurrent, rejectFact, restoreFact } from '../../../../../domain/facts';
import { categoryLabel, renderFact } from '../../../../../domain/note';
import { addProblemFromFact, canAddToProblems } from '../../../../../domain/problems';
import type { ClinicalFact, FactCategory, InformationState } from '../../../../../domain/types';
import { formatDateTime, formatDuration } from '../../../../../domain/util';
import { Banner, Button, Card, Chip, Field, KeyValue, Loading, Row, Screen, Section, Segmented, T } from '../../../../../presentation/components';
import { showError, useApp, useVisit } from '../../../../../presentation/AppContext';
import { FactChips } from '../../../../../presentation/FactRow';
import { CLARIFICATION_LABEL, provenanceText, STATE_LABEL } from '../../../../../presentation/labels';

const ATTR_LABEL: Record<string, string> = {
  rawName: 'Medication (as said)', normalizedName: 'Normalized name', rxcui: 'RxCUI', dose: 'Dose (as stated)', route: 'Route', frequency: 'Frequency', duration: 'Duration', takingStatus: 'Status',
  substance: 'Substance', reaction: 'Reaction', onset: 'Onset', severity: 'Severity', location: 'Location', character: 'Character', timing: 'Timing', progression: 'Progression',
  vitalKind: 'Measurement', numericValue: 'Value', numericValue2: 'Second value', unit: 'Unit', testName: 'Test', investigationStatus: 'Investigation status', result: 'Result',
  dueDate: 'Due', interval: 'Interval', task: 'Task', followUpStatus: 'Follow-up status',
};

function EditForm({ f, onSave, onCancel }: { f: ClinicalFact; onSave: (c: { value: string; informationState: InformationState; attributes: ClinicalFact['attributes'] }) => void; onCancel: () => void }) {
  const [value, setValue] = useState(f.value);
  const [state, setState] = useState<InformationState>(f.informationState);
  const [dose, setDose] = useState(f.attributes.dose ?? '');
  const [freq, setFreq] = useState(f.attributes.frequency ?? '');
  const [route, setRoute] = useState(f.attributes.route ?? '');
  const [taking, setTaking] = useState(f.attributes.takingStatus ?? 'UNKNOWN');
  const [fu, setFu] = useState(f.attributes.followUpStatus ?? 'PENDING');
  return (
    <Card>
      <T variant="h3">Edit (creates a new confirmed version; the original is kept)</T>
      <Field label="Value" value={value} onChangeText={setValue} />
      <Segmented label="Information state" value={state} onChange={setState} options={[{ value: 'POSITIVE', label: 'Present' }, { value: 'NEGATIVE', label: 'Denied' }, { value: 'UNKNOWN', label: 'Unclear' }, { value: 'NOT_DISCUSSED', label: 'Not discussed' }]} />
      {f.category === 'MEDICATION' ? (
        <>
          <Field label="Dose (exactly as stated; leave empty if not stated)" value={dose} onChangeText={setDose} />
          <Field label="Frequency" value={freq} onChangeText={setFreq} />
          <Field label="Route" value={route} onChangeText={setRoute} />
          <Segmented label="Medication status" value={taking} onChange={setTaking} options={[{ value: 'CURRENT', label: 'Current' }, { value: 'PREVIOUS', label: 'Previous' }, { value: 'DISCONTINUED', label: 'Stopped' }, { value: 'UNKNOWN', label: 'Unknown' }]} />
        </>
      ) : null}
      {f.category === 'FOLLOW_UP' ? <Segmented label="Follow-up status" value={fu} onChange={setFu} options={[{ value: 'PENDING', label: 'Pending' }, { value: 'COMPLETED', label: 'Completed' }, { value: 'CANCELLED', label: 'Cancelled' }]} /> : null}
      <Row>
        <Button kind="ghost" compact label="Cancel" onPress={onCancel} style={{ flex: 1 }} />
        <Button
          compact
          label="Save as confirmed"
          disabled={!value.trim()}
          style={{ flex: 1 }}
          onPress={() =>
            onSave({
              value: value.trim(),
              informationState: state,
              attributes:
                f.category === 'MEDICATION'
                  ? { dose: dose.trim() || undefined, frequency: freq.trim() || undefined, route: route.trim() || undefined, takingStatus: taking }
                  : f.category === 'FOLLOW_UP'
                    ? { followUpStatus: fu }
                    : {},
            })
          }
        />
      </Row>
    </Card>
  );
}

export default function FactDetail() {
  const { app } = useApp();
  const { patientId, visitId, factId } = useLocalSearchParams<{ patientId: string; visitId: string; factId: string }>();
  const { patient, visit, all, error, mutate, reload } = useVisit(patientId, visitId);
  const [editing, setEditing] = useState(false);
  const [category, setCategory] = useState<FactCategory | null>(null);
  if (error) return <Screen><Banner tone="danger" message={error} /></Screen>;
  if (!patient || !visit || !all) return <Loading />;
  const f = visit.facts.find((x) => x.factId === factId);
  if (!f) return <Screen><Banner tone="warning" message="This fact no longer exists in this visit." /></Screen>;

  const act = (fn: Parameters<typeof mutate>[0]) => mutate(fn).catch((e) => showError(e));
  const segs = visit.segments.filter((s) => f.sourceSegmentIds.includes(s.segmentId));
  const chain: ClinicalFact[] = [];
  for (let cur = f.supersedesFactId ? visit.facts.find((x) => x.factId === f.supersedesFactId) : undefined; cur; cur = cur.supersedesFactId ? visit.facts.find((x) => x.factId === cur!.supersedesFactId) : undefined) chain.push(cur);
  const newer = f.supersededByFactId ? visit.facts.find((x) => x.factId === f.supersededByFactId) : undefined;
  const contextUnclear = f.needsClarification && f.clarificationReason === 'CONTEXT_UNCLEAR';
  const conflicts = visit.conflicts.filter((c) => c.factIds.includes(f.factId));

  return (
    <Screen>
      <T variant="small" muted>{categoryLabel(f.category).toUpperCase()}</T>
      <T variant="title">{f.value}</T>
      <T>{renderFact(f)}</T>
      <FactChips f={f} />
      {newer ? <Banner tone="info" message="A newer version of this fact exists." action={<Button compact kind="secondary" label="Open current version" onPress={() => router.replace(`/visit/${patientId}/${visitId}/fact/${newer.factId}`)} />} /> : null}

      <Section title="Attributes">
        <Card>
          <KeyValue k="Information state" v={`${f.informationState} (${STATE_LABEL[f.informationState]})`} />
          <KeyValue k="Provenance" v={`${f.provenance} — ${provenanceText(f)}`} />
          <KeyValue k="Origin" v={f.originProvenance} />
          <KeyValue k="Root origin" v={f.rootOriginProvenance} />
          <KeyValue k="Review status" v={f.status} />
          <KeyValue k="Derivation" v={f.derivationMethod.toLowerCase().replace(/_/g, ' ')} />
          <KeyValue k="Confidence" v={f.confidence.toLowerCase()} />
          <KeyValue k="Extractor" v={f.extractor === 'AI' ? `AI (${f.aiJobVersion ?? 'job'})` : f.extractor.toLowerCase()} />
          {f.needsClarification ? <KeyValue k="Clarification" v={CLARIFICATION_LABEL[f.clarificationReason ?? 'OTHER']} /> : null}
          {f.confirmedAt ? <KeyValue k="Confirmed" v={formatDateTime(f.confirmedAt)} /> : null}
          {Object.entries(f.attributes)
            .filter(([k, v]) => v !== undefined && v !== '' && ATTR_LABEL[k])
            .map(([k, v]) => (
              <KeyValue key={k} k={ATTR_LABEL[k]} v={Array.isArray(v) ? `${v.length} candidate(s)` : String(v)} />
            ))}
        </Card>
      </Section>

      <Section title="Source">
        {segs.length === 0 ? <T muted>{f.derivationMethod === 'MANUAL_ENTRY' ? 'Entered by clinician.' : 'No transcript segment.'}</T> : null}
        {segs.map((s) => (
          <Card key={s.segmentId} onPress={() => router.push(`/visit/${patientId}/${visitId}/transcript`)} accessibilityLabel={`Transcript ${s.displayCode}, ${s.speakerRole}, ${formatDuration(s.startTime)}`}>
            <Row>
              <Chip label={s.speakerRole} tone="info" />
              <T variant="small" muted>Transcript {s.displayCode} · {formatDuration(s.startTime)}</T>
            </Row>
            <T selectable>“{s.text}”</T>
          </Card>
        ))}
      </Section>

      {conflicts.length ? (
        <Section title="Conflicts">
          {conflicts.map((c) => (
            <Card key={c.conflictId}>
              <T>{c.conflictType.replace(/_/g, ' ').toLowerCase()} · {c.status.replace(/_/g, ' ').toLowerCase()}</T>
              {c.status === 'OPEN' ? <Button compact kind="secondary" label="Resolve in Clinical facts" onPress={() => router.push(`/visit/${patientId}/${visitId}/facts`)} /> : null}
            </Card>
          ))}
        </Section>
      ) : null}

      {chain.length ? (
        <Section title="Version history">
          {chain.map((h) => (
            <Card key={h.factId}>
              <T style={{ textDecorationLine: 'line-through' }}>{h.value} — {STATE_LABEL[h.informationState]}</T>
              <T variant="small" muted>{provenanceText(h)} · {formatDateTime(h.createdAt)}</T>
            </Card>
          ))}
        </Section>
      ) : null}

      {isCurrent(f) ? (
        <Section title="Clinician actions">
          {editing ? (
            <EditForm
              f={f}
              onCancel={() => setEditing(false)}
              onSave={(ch) =>
                void act((v) => {
                  const nf = editFact(v, f.factId, ch);
                  setEditing(false);
                  setTimeout(() => router.replace(`/visit/${patientId}/${visitId}/fact/${nf.factId}`), 0);
                })
              }
            />
          ) : (
            <>
              {f.status === 'PROVISIONAL' && contextUnclear ? (
                <Card>
                  <T>Choose how to file this statement before confirming:</T>
                  <Segmented label="File as" value={category ?? f.category} onChange={setCategory} options={[{ value: f.category, label: categoryLabel(f.category) }, { value: 'HISTORY_FAMILY', label: 'Family history' }, { value: 'OTHER', label: 'Other' }]} />
                </Card>
              ) : null}
              {f.status !== 'CONFIRMED' || f.needsClarification ? (
                <Button label={f.status === 'CONFIRMED' ? 'Re-confirm after review' : 'Confirm'} icon="check" disabled={contextUnclear && !category} onPress={() => void act((v) => void confirmFact(v, f.factId, contextUnclear && category ? { category } : undefined))} />
              ) : null}
              <Button kind="secondary" label="Edit" icon="pencil-outline" onPress={() => setEditing(true)} />
              {f.category === 'MEDICATION' && f.conceptKey !== 'ANY' ? <Button kind="secondary" label="Medication information" icon="pill" onPress={() => router.push(`/visit/${patientId}/${visitId}/medication/${f.factId}`)} /> : null}
              {canAddToProblems(f, patient) ? (
                <Button
                  kind="secondary"
                  label="Add to active problem list"
                  icon="playlist-plus"
                  onPress={async () => {
                    try {
                      addProblemFromFact(patient, f);
                      await app.store.savePatient(patient);
                      await reload();
                    } catch (e) {
                      showError(e);
                    }
                  }}
                />
              ) : null}
              {f.status !== 'REJECTED' ? <Button kind="ghost" label="Reject" icon="close" onPress={() => void act((v) => rejectFact(v, f.factId))} /> : null}
            </>
          )}
        </Section>
      ) : f.status === 'REJECTED' ? (
        <Button kind="secondary" label="Restore as provisional" icon="restore" onPress={() => void act((v) => restoreFact(v, f.factId))} />
      ) : null}
      <View style={{ height: 24 }} />
    </Screen>
  );
}
