/**
 * Screen 10 — Clinical Facts. Grouped by category; provenance, state, status, time and transcript segment on
 * every fact; open conflicts side by side with Resolve; source-changed items first; discarded items listed.
 * Only explicit clinician actions confirm, reject, edit or resolve.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Switch, View } from 'react-native';
import { needsReconciliation } from '../../../../domain/consultation';
import { LANGUAGES } from '../../../../domain/languages';
import { addManualFact, audit, confirmFact, isCurrent, isFlaggedIneligible, rejectFact, resolveConflict } from '../../../../domain/facts';
import { categoryLabel } from '../../../../domain/note';
import type { ClinicalFact, FactCategory, InformationState } from '../../../../domain/types';
import { formatDuration } from '../../../../domain/util';
import { Banner, Button, Card, Chip, Empty, Field, Loading, Row, Screen, Section, Segmented, T } from '../../../../presentation/components';
import { showError, useApp, useVisit } from '../../../../presentation/AppContext';
import { FactRow, sourceCodes } from '../../../../presentation/FactRow';
import { provenanceText, STATE_LABEL } from '../../../../presentation/labels';
import { useTheme } from '../../../../presentation/theme';

const GROUPS: { title: string; cats: FactCategory[] }[] = [
  { title: 'Patient details (stated)', cats: ['DEMOGRAPHIC'] },
  { title: 'Symptoms', cats: ['SYMPTOM'] },
  { title: 'History', cats: ['HISTORY_MEDICAL', 'HISTORY_SURGICAL', 'HISTORY_FAMILY', 'HISTORY_SOCIAL'] },
  { title: 'Medications', cats: ['MEDICATION'] },
  { title: 'Allergies', cats: ['ALLERGY'] },
  { title: 'Vitals', cats: ['VITAL_SIGN'] },
  { title: 'Examination', cats: ['EXAMINATION_FINDING'] },
  { title: 'Investigations', cats: ['INVESTIGATION'] },
  { title: 'Assessment', cats: ['ASSESSMENT'] },
  { title: 'Plan', cats: ['PLAN'] },
  { title: 'Follow-up', cats: ['FOLLOW_UP'] },
  { title: 'Other', cats: ['OTHER'] },
];

const MANUAL_CATS: { value: FactCategory; label: string }[] = [
  { value: 'SYMPTOM', label: 'Symptom' },
  { value: 'HISTORY_MEDICAL', label: 'History' },
  { value: 'MEDICATION', label: 'Medication' },
  { value: 'ALLERGY', label: 'Allergy' },
  { value: 'VITAL_SIGN', label: 'Vital' },
  { value: 'EXAMINATION_FINDING', label: 'Exam' },
  { value: 'INVESTIGATION', label: 'Investigation' },
  { value: 'ASSESSMENT', label: 'Assessment' },
  { value: 'PLAN', label: 'Plan' },
  { value: 'FOLLOW_UP', label: 'Follow-up' },
];

function ManualEntry({ onAdd }: { onAdd: (input: { category: FactCategory; value: string; informationState: InformationState; measured: boolean }) => Promise<void> }) {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<FactCategory>('SYMPTOM');
  const [value, setValue] = useState('');
  const [state, setState] = useState<InformationState>('POSITIVE');
  const [measured, setMeasured] = useState(false);
  if (!open) return <Button kind="secondary" label="Add fact manually" icon="plus" onPress={() => setOpen(true)} />;
  return (
    <Card>
      <T variant="h3">Manual entry (entered by clinician)</T>
      <Row wrap>
        {MANUAL_CATS.map((m) => (
          <Button key={m.value} compact kind={category === m.value ? 'primary' : 'secondary'} label={m.label} onPress={() => setCategory(m.value)} />
        ))}
      </Row>
      <Field label={`${categoryLabel(category)} — as stated`} value={value} onChangeText={setValue} placeholder={category === 'VITAL_SIGN' ? 'e.g. Weight 72 kg' : category === 'MEDICATION' ? 'e.g. metformin 500 mg twice daily' : ''} />
      <Segmented label="Information state" value={state} onChange={setState} options={[{ value: 'POSITIVE', label: 'Present' }, { value: 'NEGATIVE', label: 'Denied' }, { value: 'UNKNOWN', label: 'Unclear' }, { value: 'NOT_DISCUSSED', label: 'Not discussed' }]} />
      {category === 'VITAL_SIGN' ? (
        <Row style={{ justifyContent: 'space-between' }}>
          <T>Measured by me (MEASURED)</T>
          <Switch value={measured} onValueChange={setMeasured} trackColor={{ true: c.primary, false: c.border }} accessibilityLabel="Measured by me" />
        </Row>
      ) : null}
      <Row>
        <Button kind="ghost" compact label="Cancel" onPress={() => setOpen(false)} style={{ flex: 1 }} />
        <Button
          compact
          label="Add"
          disabled={!value.trim()}
          style={{ flex: 1 }}
          onPress={() =>
            void onAdd({ category, value, informationState: state, measured }).then(() => {
              setValue('');
              setOpen(false);
            })
          }
        />
      </Row>
    </Card>
  );
}

export default function Facts() {
  const { app, settings } = useApp();
  const { patientId, visitId } = useLocalSearchParams<{ patientId: string; visitId: string }>();
  const { patient, visit, all, error, mutate, reload } = useVisit(patientId, visitId);
  const [history, setHistory] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  if (error) return <Screen><Banner tone="danger" message={error} /></Screen>;
  if (!visit || !all || !patient) return <Loading />;

  const act = (fn: Parameters<typeof mutate>[0]) => mutate(fn).catch((e) => showError(e));
  const facts = visit.facts.filter((f) => history || isCurrent(f));
  const sourceChanged = visit.facts.filter((f) => isCurrent(f) && f.clarificationReason === 'SOURCE_CHANGED');
  const openConflicts = visit.conflicts.filter((c) => c.status === 'OPEN');
  const allFacts = all.flatMap((v) => (v.visitId === visit.visitId ? visit.facts : v.facts));
  const fById = (id: string) => allFacts.find((f) => f.factId === id);
  const extracting = visit.clinicalExtractionState === 'IN_PROGRESS';

  const rerun = async () => {
    setBusy(true);
    try {
      await mutate(async (v, ctx) => {
        const r = await app.visits.runExtraction(v, settings, ctx.all.filter((x) => x.visitId !== v.visitId), ctx.patient);
        setMsg(r.message ?? null);
      });
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  /** Explicit clinician choice: copy the stated value into the profile (audited). The profile is never changed otherwise. */
  const applyStatedValue = async (conflictId: string, f: ClinicalFact) => {
    const c = visit.conflicts.find((x) => x.conflictId === conflictId);
    if (!c?.profileField) return;
    try {
      const p = await app.store.getPatient(patientId);
      const said = f.attributes.demographicValue ?? f.value;
      if (c.profileField === 'age') p.age = f.attributes.numericValue;
      else if (c.profileField === 'preferredLanguage') p.preferredLanguage = LANGUAGES.find((l) => l.displayName.toLowerCase() === said.toLowerCase())?.languageCode ?? said;
      else if (c.profileField === 'name') p.name = said;
      else if (c.profileField === 'occupation') p.occupation = said;
      else return; // sex is never taken from speech
      await app.store.savePatient(p);
      await mutate((v, ctx) => {
        resolveConflict(v, conflictId, f.factId, ctx.all);
        audit(v, 'PATIENT', patientId, 'PROFILE_UPDATED_FROM_CONSULTATION', 'CLINICIAN', `${c.profileField}: ${c.profileValue} → ${said}`);
      });
      await reload();
    } catch (e) {
      showError(e);
    }
  };

  const row = (f: ClinicalFact) => (
    <FactRow
      key={f.factId}
      f={f}
      visit={visit}
      patientId={patientId}
      visitId={visitId}
      onConfirm={!isFlaggedIneligible(f) && !(f.clarificationReason === 'CONFLICT' && f.needsClarification) ? () => void act((v) => void confirmFact(v, f.factId)) : undefined}
      onReject={() => void act((v) => rejectFact(v, f.factId))}
    />
  );

  return (
    <Screen>
      {needsReconciliation(visit) ? <Banner tone="warning" title="Transcript changed since extraction" message="New conversation or corrections were added. Reconcile the complete visit to update these facts; confirmed facts are kept." action={<Button compact label="Reconcile complete visit" icon="source-merge" onPress={() => router.push(`/visit/${patientId}/${visitId}/transcript?reconcile=1`)} />} /> : null}
      {visit.clinicalExtractionState === 'PARTIAL' ? <Banner tone="warning" message="AI extraction was unavailable; rule-based results are shown. You can retry later or add facts manually." /> : null}
      {msg ? <Banner tone="info" message={msg} /> : null}
      {extracting ? <Banner tone="info" message="Extracting facts…" /> : null}
      <Row wrap>
        <Chip label={`${visit.facts.filter(isCurrent).length} current fact(s)`} tone="neutral" />
        <Chip label={`${visit.facts.filter((f) => isCurrent(f) && f.status === 'PROVISIONAL').length} provisional`} tone="warning" icon="progress-question" />
        <Chip label={`${visit.facts.filter((f) => isCurrent(f) && f.status === 'CONFIRMED').length} confirmed`} tone="success" icon="check-circle" />
      </Row>
      <Row>
        <Button kind="ghost" compact label={history ? 'Hide history' : 'Show history (rejected/superseded)'} onPress={() => setHistory(!history)} />
        {visit.segments.length && visit.speakerMappingState === 'COMPLETED' ? <Button kind="ghost" compact label="Re-run extraction" icon="refresh" busy={busy} onPress={() => void rerun()} /> : null}
      </Row>

      {sourceChanged.length ? (
        <Section title="Needs clarification — source changed" subtitle="The transcript or speaker was corrected after these were extracted.">
          {sourceChanged.map(row)}
        </Section>
      ) : null}

      {openConflicts.length ? (
        <Section title="Conflict — review" subtitle="Both statements are kept. Choose which is current, or mark as not a conflict.">
          {openConflicts.map((c) => {
            const fs = c.factIds.map(fById).filter((f): f is ClinicalFact => !!f);
            if (c.conflictType === 'PROFILE_MISMATCH') {
              const f = fs[0];
              return (
                <Card key={c.conflictId}>
                  <Chip label="differs from patient profile" tone="danger" icon="account-alert-outline" />
                  <T style={{ fontWeight: '600' }}>Profile ({c.profileField === 'preferredLanguage' ? 'language' : c.profileField}): {c.profileValue}</T>
                  {f ? <T style={{ fontWeight: '600' }}>Stated in consultation: “{f.value}” — {provenanceText(f)}</T> : null}
                  <T variant="small" muted>The profile was not changed. Choose which value to keep; both stay in the record.</T>
                  {f ? <Button compact kind="secondary" label="Use the stated value in the profile" onPress={() => void applyStatedValue(c.conflictId, f)} /> : null}
                  <Button compact kind="ghost" label="Keep the profile value" onPress={() => void act((v, ctx) => resolveConflict(v, c.conflictId, null, ctx.all))} />
                </Card>
              );
            }
            return (
              <Card key={c.conflictId}>
                <Chip label={c.conflictType.replace(/_/g, ' ').toLowerCase()} tone="danger" icon="alert-outline" />
                {fs.map((f) => (
                  <View key={f.factId} style={{ gap: 2 }}>
                    <T style={{ fontWeight: '600' }}>“{f.value}” — {STATE_LABEL[f.informationState]}</T>
                    <T variant="small" muted>
                      {provenanceText(f)}
                      {f.sourceStartTime !== undefined ? ` · ${formatDuration(f.sourceStartTime)}` : ''}
                      {sourceCodes(f, f.visitId === visit.visitId ? visit : all.find((x) => x.visitId === f.visitId)) ? ` · ${sourceCodes(f, f.visitId === visit.visitId ? visit : all.find((x) => x.visitId === f.visitId))}` : ''}
                      {f.visitId !== visit.visitId ? ' · earlier visit' : ''}
                    </T>
                    {f.visitId === visit.visitId ? <Button compact kind="secondary" label="Keep this as current" onPress={() => void act((v, ctx) => resolveConflict(v, c.conflictId, f.factId, ctx.all))} /> : null}
                  </View>
                ))}
                <Button compact kind="ghost" label="Not a conflict" onPress={() => void act((v, ctx) => resolveConflict(v, c.conflictId, null, ctx.all))} />
              </Card>
            );
          })}
        </Section>
      ) : null}

      {facts.length === 0 && !visit.discarded.length ? <Empty icon="playlist-plus" title="No facts extracted — add manually" message="Facts from the transcript appear here. You can always add facts yourself." /> : null}

      {GROUPS.map((g) => {
        const fs = facts.filter((f) => g.cats.includes(f.category) && f.clarificationReason !== 'SOURCE_CHANGED');
        if (!fs.length) return null;
        return (
          <Section key={g.title} title={g.title}>
            {fs.map(row)}
          </Section>
        );
      })}

      {visit.discarded.length ? (
        <Section title="Not extracted — check transcript" subtitle="These extraction items failed validation and were not used.">
          {visit.discarded.map((d) => (
            <Card key={d.itemId}>
              <T variant="small">{categoryLabel(d.category)} · reason {d.reasonCode.toLowerCase().replace(/_/g, ' ')}</T>
              <T variant="small" muted>Segments {visit.segments.filter((s) => d.segmentIds.includes(s.segmentId)).map((s) => s.displayCode).join(', ') || '—'}</T>
            </Card>
          ))}
        </Section>
      ) : null}

      <ManualEntry onAdd={(input) => act((v) => void addManualFact(v, input)).then(() => undefined)} />
      <Button label="Continue to evidence" icon="arrow-right" onPress={() => router.push(`/visit/${patientId}/${visitId}/evidence`)} />
      <Button kind="secondary" label="Clinical review" icon="clipboard-check-outline" onPress={() => router.push(`/visit/${patientId}/${visitId}/review`)} />
    </Screen>
  );
}
