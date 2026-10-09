/**
 * Screen 11 — Clinical Review: FACTS · EVIDENCE · POSSIBILITIES TO REVIEW · NOTE in pipeline order (ADR-023).
 * Possibilities (R2) appear only when the default-off development flag is on (ADR-025, ADR-034); they are never
 * diagnoses, carry no probability or ranking, and never enter notes or exports.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { R2_SELECTABLE } from '../../../../application/container';
import { addManualFact, isCurrent } from '../../../../domain/facts';
import { renderFact } from '../../../../domain/note';
import type { ClinicalCandidate, ClinicalFact, Visit } from '../../../../domain/types';
import { unreviewedCount } from '../../../../domain/views';
import { Banner, Button, Card, Chip, Loading, Row, Screen, Section, T } from '../../../../presentation/components';
import { showError, useApp, useVisit } from '../../../../presentation/AppContext';
import { NOTE_STATE_LABEL, SOURCE_TYPE_LABEL, STAGE_LABEL } from '../../../../presentation/labels';
import { useTheme } from '../../../../presentation/theme';

function FactList({ ids, v, empty }: { ids: string[]; v: Visit; empty: string }) {
  const fs = ids.map((id) => v.facts.find((f) => f.factId === id)).filter((f): f is ClinicalFact => !!f);
  if (!fs.length) return <T variant="small" muted>{empty}</T>;
  return (
    <>
      {fs.map((f) => (
        <T key={f.factId} variant="small">• {renderFact(f)}</T>
      ))}
    </>
  );
}

function Possibility({ cand, v, onDismiss, onConfirm }: { cand: ClinicalCandidate; v: Visit; onDismiss: () => void; onConfirm: () => void }) {
  const { c } = useTheme();
  const [why, setWhy] = useState(false);
  const blocked = cand.outdated || !!cand.supersededByRunId;
  const sources = cand.evidenceIds.map((id) => v.evidence.find((e) => e.evidenceId === id)).filter(Boolean);
  return (
    <Card style={{ borderLeftWidth: 4, borderLeftColor: c.info }}>
      <T variant="small" style={{ fontWeight: '800', color: c.info }}>POSSIBILITY TO REVIEW</T>
      <T variant="h2">{cand.topic}</T>
      <Row wrap>
        <Chip label="AI inference — verify" tone="warning" icon="robot-outline" />
        {cand.outdated ? <Chip label="Outdated — facts changed since generation" tone="warning" icon="alert-outline" /> : null}
        {cand.supersededByRunId ? <Chip label="From an earlier run" tone="neutral" icon="history" /> : null}
        {cand.evidenceStateAtGeneration === 'PARTIAL' ? <Chip label="Evidence incomplete at generation" tone="warning" /> : null}
        {cand.status !== 'PROVISIONAL' ? <Chip label={cand.status === 'DISMISSED' ? 'Dismissed' : 'Confirmed as assessment by clinician'} tone={cand.status === 'DISMISSED' ? 'neutral' : 'success'} /> : null}
      </Row>
      <Button kind="ghost" compact label={why ? 'Hide details' : 'Why did this appear?'} onPress={() => setWhy(!why)} style={{ alignSelf: 'flex-start' }} />
      {why ? (
        <View style={{ gap: 6 }}>
          <T variant="small" style={{ fontWeight: '700' }}>WHY THIS APPEARED</T>
          <T variant="small">{cand.reason}</T>
          <T variant="small" style={{ fontWeight: '700' }}>SUPPORTING FACTS</T>
          <FactList ids={cand.supportingFactIds} v={v} empty="None" />
          <T variant="small" style={{ fontWeight: '700' }}>CONTRADICTING FACTS</T>
          <FactList ids={cand.contradictingFactIds} v={v} empty="None documented" />
          {cand.conflictFactIds.length ? (
            <>
              <T variant="small" style={{ fontWeight: '700', color: c.danger }}>CONFLICT — REVIEW</T>
              <FactList ids={cand.conflictFactIds} v={v} empty="" />
            </>
          ) : null}
          <T variant="small" style={{ fontWeight: '700' }}>MISSING INFORMATION</T>
          {cand.missingInformation.length ? cand.missingInformation.map((m, i) => <T key={i} variant="small">• {m}</T>) : <T variant="small" muted>None listed</T>}
          <T variant="small" style={{ fontWeight: '700' }}>SOURCES</T>
          {sources.map((e) => (
            <T key={e!.evidenceId} variant="small">• {SOURCE_TYPE_LABEL[e!.sourceType]} · {e!.provider} · {e!.identifierType} {e!.identifier} — {e!.title}</T>
          ))}
        </View>
      ) : null}
      {cand.status === 'PROVISIONAL' ? (
        <Row>
          <Button compact kind="ghost" label="Dismiss" onPress={onDismiss} style={{ flex: 1 }} />
          <Button compact kind="secondary" label="Confirm as assessment" disabled={blocked} onPress={onConfirm} style={{ flex: 1 }} />
        </Row>
      ) : null}
      {blocked && cand.status === 'PROVISIONAL' ? <T variant="small" muted>Confirm is disabled: {cand.outdated ? 'the facts changed since generation' : 'a newer run exists'}.</T> : null}
    </Card>
  );
}

export default function Review() {
  const { app, settings } = useApp();
  const { patientId, visitId } = useLocalSearchParams<{ patientId: string; visitId: string }>();
  const { visit, error, mutate } = useVisit(patientId, visitId);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  if (error) return <Screen><Banner tone="danger" message={error} /></Screen>;
  if (!visit) return <Loading />;
  const base = `/visit/${patientId}/${visitId}`;
  const flagOn = R2_SELECTABLE && settings.devPossibilitiesEnabled;
  const n = unreviewedCount(visit);
  const conflicts = visit.conflicts.filter((c) => c.status === 'OPEN').length;
  const staleEvidence = visit.evidence.some((e) => e.factsChangedSinceRetrieval);
  const cands = [...visit.candidates].sort((a, b) => a.topic.localeCompare(b.topic));

  const generate = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await mutate(async (v) => {
        const r = await app.visits.runCandidates(v, settings, R2_SELECTABLE);
        if (r.message) setMsg(r.message);
      });
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Section title="Facts">
        <Card onPress={() => router.push(`${base}/facts`)}>
          <T>{visit.facts.filter(isCurrent).length} current fact(s) · {n} not yet reviewed · {conflicts} open conflict(s)</T>
          <Row wrap>
            {n ? <Chip label={`${n} to review`} tone="warning" icon="progress-question" /> : <Chip label="All reviewed" tone="success" icon="check-circle" />}
            {conflicts ? <Chip label="Conflict — review" tone="danger" icon="alert-outline" /> : null}
          </Row>
        </Card>
      </Section>
      <Section title="Evidence">
        <Card onPress={() => router.push(`${base}/evidence`)}>
          <T>Evidence {STAGE_LABEL[visit.evidenceState]} · {visit.evidence.length} record(s)</T>
          {staleEvidence ? <Chip label="Based on facts that changed since retrieval" tone="warning" /> : null}
          {visit.evidenceState !== 'NOT_STARTED' && !visit.evidence.length ? <T variant="small" muted>NO VERIFIED EVIDENCE FOUND</T> : null}
        </Card>
      </Section>
      {flagOn ? (
        <Section title="Possibilities to review" subtitle="Development feature (R2, default off). Order has no meaning. Not diagnoses. Never added to notes or exports.">
          {visit.candidateState === 'SKIPPED' && visit.candidateSkipReason ? <Banner tone="info" message={visit.candidateSkipReason.startsWith('Possibilities not generated') ? visit.candidateSkipReason : `Possibilities not generated: ${visit.candidateSkipReason}`} /> : null}
          {msg ? <Banner tone="info" message={msg} /> : null}
          {staleEvidence ? <Banner tone="warning" message="Re-run evidence search first" action={<Button compact kind="secondary" label="Open evidence" onPress={() => router.push(`${base}/evidence`)} />} /> : null}
          <Button kind="secondary" label={cands.length ? 'Regenerate possibilities' : 'Generate possibilities from cited evidence'} icon="lightbulb-on-outline" busy={busy} onPress={() => void generate()} />
          {visit.candidateState === 'COMPLETED' && !cands.some((c) => !c.supersededByRunId) ? <T muted>No possibilities surfaced.</T> : null}
          {cands.map((cand) => (
            <Possibility
              key={cand.candidateId}
              cand={cand}
              v={visit}
              onDismiss={() =>
                void mutate((v) => {
                  const c = v.candidates.find((x) => x.candidateId === cand.candidateId)!;
                  c.status = 'DISMISSED';
                  c.clinicianDecisionAt = new Date().toISOString();
                }).catch(showError)
              }
              onConfirm={() =>
                void mutate((v) => {
                  const c = v.candidates.find((x) => x.candidateId === cand.candidateId)!;
                  c.status = 'CONFIRMED_BY_CLINICIAN';
                  c.clinicianDecisionAt = new Date().toISOString();
                  // explicit clinician action: an assessment entered by the clinician (the possibility itself never enters a note)
                  addManualFact(v, { category: 'ASSESSMENT', value: c.topic, informationState: 'POSITIVE' });
                }).catch(showError)
              }
            />
          ))}
        </Section>
      ) : null}
      <Section title="Note">
        <Card onPress={() => router.push(`${base}/note`)}>
          <T>{NOTE_STATE_LABEL[visit.noteState]}</T>
          <T variant="small" muted>Rendered from documented facts with their sources. Finalizing does not confirm facts.</T>
        </Card>
        <Button label={visit.noteVersions.length ? 'Open note' : 'Generate note draft'} icon="note-edit-outline" onPress={() => router.push(`${base}/note`)} />
      </Section>
    </Screen>
  );
}
