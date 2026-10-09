/**
 * Clinical encounter report (ADR-051). Built by code from the complete reconciled visit; every row shows its
 * source and review status and opens the fact (edit, confirm, dismiss, view source). Tables are stacked cards so
 * nothing scrolls sideways on a phone. Saving a version or exporting never confirms anything. Possibilities (R2)
 * appear only when the development flag is on, and never in exports.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, View } from 'react-native';
import { R2_SELECTABLE } from '../../../../application/container';
import { needsReconciliation } from '../../../../domain/consultation';
import { evidenceOutdated } from '../../../../domain/evidence';
import { exportReport } from '../../../../domain/export';
import { confirmFact, isCurrent, markFactUncertain, rejectFact } from '../../../../domain/facts';
import { addReportVersion, buildClinicalReport, type ClinicalReport, type Completeness, type ReportRow } from '../../../../domain/report';
import { formatDateTime } from '../../../../domain/util';
import { Banner, Button, Card, Chip, DemoBadge, Expandable, KeyValue, Loading, Row, Screen, Stat, T, type ChipTone } from '../../../../presentation/components';
import { showError, useApp, useVisit } from '../../../../presentation/AppContext';
import { confirmExport } from '../../../../presentation/exportUi';
import { space, useTheme } from '../../../../presentation/theme';
import type { Visit } from '../../../../domain/types';

const COMPLETENESS_TONE: Record<Completeness, ChipTone> = { PRESENT: 'success', NOT_DISCUSSED: 'neutral', UNKNOWN: 'warning', CONFLICTED: 'danger', NOT_APPLICABLE: 'neutral' };

function FactCard({ row, extra, visit, base, act }: { row: ReportRow; extra?: string[]; visit: Visit; base: string; act: (fn: (v: Visit) => void) => void }) {
  const f = row.factId ? visit.facts.find((x) => x.factId === row.factId) : undefined;
  const provisional = !!f && isCurrent(f) && f.status === 'PROVISIONAL';
  const blocked = !!f && f.needsClarification && (f.clarificationReason === 'CONFLICT' || f.clarificationReason === 'SOURCE_CHANGED' || f.clarificationReason === 'CONTEXT_UNCLEAR');
  return (
    <Card onPress={f ? () => router.push(`${base}/fact/${f.factId}`) : undefined} accessibilityLabel={`${row.label}: ${row.value}. ${row.source}. ${row.status}${f ? '. Opens the fact' : ''}`} style={{ padding: space.md }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <T variant="small" muted style={{ flex: 1, fontWeight: '700' }}>{row.label.toUpperCase()}</T>
        {row.transcriptCodes.length ? <T variant="small" muted>{[...row.segmentCodes, ...row.transcriptCodes].join(' · ')}</T> : null}
      </Row>
      <T style={{ fontWeight: '600' }} selectable>{row.value}</T>
      {extra?.map((x) => <T key={x} variant="small">{x}</T>)}
      <Row wrap>
        <Chip label={row.source} tone="info" icon={/patient/i.test(row.source) ? 'account-voice' : /clinician-stated/i.test(row.source) ? 'stethoscope' : /AI/.test(row.source) ? 'robot-outline' : 'file-document-outline'} />
        <Chip label={row.status} tone={/Confirmed/.test(row.status) ? 'success' : /Conflict/.test(row.status) ? 'danger' : 'neutral'} icon={/Confirmed/.test(row.status) ? 'check-circle' : 'progress-question'} />
        {row.flags.map((fl) => <Chip key={fl} label={fl} tone={/Conflict/.test(fl) ? 'danger' : 'warning'} icon="alert-outline" />)}
      </Row>
      {f && isCurrent(f) ? (
        <Row wrap>
          {provisional && !blocked ? <Button compact kind="secondary" label="Confirm" icon="check" onPress={() => void act((v) => void confirmFact(v, f.factId))} /> : null}
          {!f.needsClarification ? <Button compact kind="ghost" label="Mark uncertain" icon="help-circle-outline" onPress={() => void act((v) => markFactUncertain(v, f.factId))} /> : null}
          {provisional ? <Button compact kind="ghost" label="Dismiss" icon="close" onPress={() => void act((v) => rejectFact(v, f.factId))} /> : null}
        </Row>
      ) : null}
    </Card>
  );
}

export default function ReportScreen() {
  const { c } = useTheme();
  const { app, settings } = useApp();
  const { patientId, visitId } = useLocalSearchParams<{ patientId: string; visitId: string }>();
  const { patient, visit, all, error, mutate } = useVisit(patientId, visitId);
  const [msg, setMsg] = useState<{ tone: 'info' | 'warning' | 'success'; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  if (error) return <Screen><Banner tone="danger" message={error} /></Screen>;
  if (!patient || !visit || !all) return <Loading label="Building report…" />;

  const showR2 = R2_SELECTABLE && settings.devPossibilitiesEnabled;
  const r: ClinicalReport = buildClinicalReport({ patient, visit, allVisits: all, possibilitiesShown: showR2 });
  const latest = visit.reportVersions[visit.reportVersions.length - 1];
  const stale = needsReconciliation(visit);
  const evOld = evidenceOutdated(visit, patient);
  const base = `/visit/${patientId}/${visitId}`;
  const neverExtracted = visit.clinicalExtractionState === 'NOT_STARTED' && visit.mode === 'AMBIENT';
  const act = (fn: (v: Visit) => void) => void mutate((v) => fn(v)).catch((e) => showError(e));

  const rows = (list: ReportRow[], empty: string) => (list.length ? list.map((x, i) => <FactCard visit={visit} base={base} act={act} key={x.factId ?? `${x.label}-${i}`} row={x} />) : <T muted>{empty}</T>);
  const sub = (title: string) => <T variant="small" style={{ fontWeight: '800', marginTop: space.xs }}>{title}</T>;
  const totalMeds = Object.values(r.medications).reduce((a, l) => a + l.length, 0);
  const openChanges = r.informationChanges.filter((x) => x.status === 'open');

  const saveVersion = async () => {
    setBusy('save');
    try {
      await mutate((v, ctx) => void addReportVersion(v, buildClinicalReport({ patient: ctx.patient, visit: v, allVisits: ctx.all, possibilitiesShown: showR2 })));
      setMsg({ tone: 'success', text: `Report version ${visit.reportVersions.length + 1} saved. Nothing was confirmed by saving.` });
    } catch (e) {
      showError(e);
    } finally {
      setBusy(null);
    }
  };

  const refreshEvidence = async () => {
    setBusy('evidence');
    try {
      await mutate(async (v, ctx) => {
        const out = await app.visits.runEvidence(v, ctx.patient, settings);
        setMsg({ tone: out.ok ? 'info' : 'warning', text: out.message ?? 'Evidence refreshed from public sources.' });
      });
    } catch (e) {
      showError(e);
    } finally {
      setBusy(null);
    }
  };

  const doExport = (format: 'PDF' | 'JSON' | 'TEXT') =>
    confirmExport(format, async () => {
      let doc = null as ReturnType<typeof exportReport> | null;
      await mutate((v, ctx) => {
        const rep = buildClinicalReport({ patient: ctx.patient, visit: v, allVisits: ctx.all, possibilitiesShown: false });
        const rv = addReportVersion(v, rep);
        doc = exportReport(ctx.patient, v, rep, rv.versionNumber);
      });
      if (!doc) throw new Error('Nothing to export.');
      return doc;
    });

  return (
    <Screen>
      <Card strong>
        <T variant="small" muted>CLINNOTE CLINICAL ENCOUNTER REPORT</T>
        <T variant="title">{patient.patientReference} · {visit.visitCode}</T>
        <T muted>{formatDateTime(visit.startedAt)} · {r.visit.segments.length} recording segment(s)</T>
        <Row wrap>
          {patient.isDemo ? <DemoBadge /> : null}
          <Chip label={latest ? `Saved v${latest.versionNumber} · ${formatDateTime(latest.generatedAt)}` : 'Not saved yet'} tone={latest ? 'neutral' : 'warning'} icon="content-save-outline" />
          <Chip label="DRAFT — clinician review required" tone="warning" icon="file-document-edit-outline" />
        </Row>
        <T variant="small" muted>{r.timeZoneNote}</T>
      </Card>

      {neverExtracted ? <Banner tone="info" title="Facts not extracted yet" message="Confirm speaker roles and extract facts from the transcript to fill the report." action={<Button compact kind="secondary" label="Open transcript" onPress={() => router.push(`${base}/transcript`)} />} /> : null}
      {stale ? <Banner tone="warning" title="New conversation since the facts were extracted" message="The report below does not yet include the latest transcript changes. Reconcile the complete visit to update it." action={<Button compact label="Reconcile visit" icon="source-merge" onPress={() => router.push(`${base}/transcript?reconcile=1`)} />} /> : null}
      {evOld ? <Banner tone="warning" title="Evidence may be outdated" message="The clinical concepts changed since the last evidence search." action={<Button compact kind="secondary" label="Refresh evidence" icon="refresh" busy={busy === 'evidence'} onPress={() => void refreshEvidence()} />} /> : null}
      {msg ? <Banner tone={msg.tone} message={msg.text} /> : null}

      <Row>
        <Stat value={r.review.confirmedFacts} label="confirmed" tone="success" icon="check-circle" />
        <Stat value={r.review.provisionalFacts} label="to review" tone="warning" icon="progress-question" onPress={() => router.push(`${base}/facts`)} />
        <Stat value={r.review.unresolvedConflicts} label="conflicts" tone={r.review.unresolvedConflicts ? 'danger' : 'neutral'} icon="alert-outline" onPress={() => router.push(`${base}/facts`)} />
      </Row>

      <Expandable title="Patient details" icon="account-outline" initiallyOpen badge={`${r.patient.filter((p) => p.value !== 'Not discussed' && p.value !== 'Not recorded').length}/${r.patient.length}`}>
        {r.patient.map((p) => (p.factId ? <FactCard visit={visit} base={base} act={act} key={p.label} row={p} /> : (
          <Card key={p.label} style={{ padding: space.md }}>
            <T variant="small" muted style={{ fontWeight: '700' }}>{p.label.toUpperCase()}</T>
            <T style={{ fontWeight: '600' }}>{p.value}</T>
            <T variant="small" muted>{p.source} · {p.status}</T>
          </Card>
        )))}
      </Expandable>

      <Expandable title="Visit details" icon="calendar-clock" badge={visit.consultationState === 'FINALIZED' ? 'finalized' : 'open'} tone={visit.consultationState === 'FINALIZED' ? 'success' : 'info'}>
        <Card>{r.visit.rows.map((x) => <KeyValue key={x.label} k={x.label} v={x.value} />)}</Card>
        {r.visit.segments.map((s) => (
          <Card key={s.code} style={{ padding: space.md }}>
            <T style={{ fontWeight: '700' }}>{s.code} · {s.status}</T>
            <T variant="small" muted>{formatDateTime(s.startedAt)}{s.endedAt ? ` – ${formatDateTime(s.endedAt)}` : ''} · {s.duration} · {s.language} · {s.utterances} utterance(s)</T>
          </Card>
        ))}
      </Expandable>

      <Expandable title="Clinical summary" icon="text-box-check-outline" initiallyOpen badge={`${r.consolidatedFacts.length} facts`}>
        {sub('Chief complaint')}
        {r.chiefComplaint ? <FactCard visit={visit} base={base} act={act} row={r.chiefComplaint} /> : <T muted>Not documented</T>}
        {sub('Consolidated facts (repeated statements counted once)')}
        {r.consolidatedFacts.length ? (
          <Card style={{ padding: space.md }}>
            {r.consolidatedFacts.map((f, i) => (
              <View key={i} style={{ gap: 2, paddingVertical: 4 }}>
                <T style={{ fontWeight: f.conflict ? '700' : '500', color: f.conflict ? c.danger : c.text }}>{f.conflict ? '⚠ ' : '• '}{f.value}</T>
                <T variant="small" muted>{f.state} · {f.sources.join(' + ')} · {f.status}{f.mentions > 1 ? ` · mentioned ${f.mentions}×` : ''} · {[...f.segmentCodes, ...f.transcriptCodes].join(', ')}</T>
              </View>
            ))}
          </Card>
        ) : <T muted>No facts extracted yet.</T>}
      </Expandable>

      <Expandable title="Symptoms (history of present illness)" icon="stethoscope" badge={`${r.presentIllness.length + r.negativeFindings.length}`}>
        {rows(r.presentIllness, 'No symptoms documented.')}
        {r.negativeFindings.length ? sub('Explicitly denied') : null}
        {r.negativeFindings.map((x) => <FactCard visit={visit} base={base} act={act} key={x.factId} row={x} />)}
      </Expandable>

      <Expandable title="History" icon="history" badge={`${r.history.confirmed.length + r.history.patientReported.length + r.history.clinicianStated.length + r.history.uncertain.length}`}>
        {sub('Confirmed')}{rows(r.history.confirmed, 'None')}
        {sub('Patient-reported')}{rows(r.history.patientReported, 'None')}
        {sub('Clinician-stated')}{rows(r.history.clinicianStated, 'None')}
        {sub('Uncertain')}{rows(r.history.uncertain, 'None')}
      </Expandable>

      <Expandable title="Medications" icon="pill" badge={`${totalMeds}`} subtitle="A mentioned medication is never treated as an active prescription.">
        {([['Current', r.medications.current], ['Previous', r.medications.previous], ['Reported stopped', r.medications.reportedStopped], ['Uncertain', r.medications.uncertain], ['On record, not discussed this visit', r.medications.fromRecordNotDiscussed]] as const).map(([t, list]) => (
          <View key={t} style={{ gap: space.sm }}>
            {sub(t)}
            {list.length ? list.map((m) => <FactCard visit={visit} base={base} act={act} key={m.factId} row={{ ...m, label: m.medication }} extra={[`Dose: ${m.dose} · Frequency: ${m.frequency} · Route: ${m.route}`, `Status: ${m.takingStatus}`]} />) : <T muted>None</T>}
          </View>
        ))}
        {sub('Proposed change (clinician wording)')}
        {rows(r.medications.proposedChange, 'None stated')}
      </Expandable>

      <Expandable title="Allergies" icon="alert-decagram-outline" badge={r.allergies.status === 'NOT_DISCUSSED' ? 'not discussed' : r.allergies.status.toLowerCase().replace(/_/g, ' ')} tone={r.allergies.status === 'ALLERGIES_RECORDED' ? 'danger' : r.allergies.status === 'UNCERTAIN' ? 'warning' : 'neutral'} initiallyOpen={r.allergies.status === 'ALLERGIES_RECORDED'}>
        <T style={{ fontWeight: '700' }}>{r.allergies.statusLine}</T>
        {r.allergies.rows.map((x) => <FactCard visit={visit} base={base} act={act} key={x.factId} row={x} />)}
      </Expandable>

      <Expandable title="Vital signs" icon="heart-pulse" badge={`${r.vitals.length}`}>
        {r.vitals.length ? r.vitals.map((x) => <FactCard visit={visit} base={base} act={act} key={x.factId} row={{ ...x, value: `${x.value} ${x.unit === 'not stated' ? '(unit not stated)' : x.unit}` }} />) : <T muted>No vital signs documented. None are shown that were not stated.</T>}
      </Expandable>

      <Expandable title="Examination" icon="human" badge={`${r.examination.positive.length + r.examination.negative.length}`}>
        {sub('Documented findings')}{rows(r.examination.positive, 'None documented')}
        {sub('Documented normal / negative')}{rows(r.examination.negative, 'None documented — no normal findings are assumed')}
      </Expandable>

      <Expandable title="Investigations" icon="test-tube" badge={`${Object.values(r.investigations).reduce((a, l) => a + l.length, 0)}`}>
        {([['Completed', r.investigations.completed], ['Pending', r.investigations.pending], ['Planned', r.investigations.planned], ['Status unknown', r.investigations.unknown]] as const).map(([t, list]) => (
          <View key={t} style={{ gap: space.sm }}>
            {sub(t)}
            {list.length ? list.map((i) => <FactCard visit={visit} base={base} act={act} key={i.factId} row={i} extra={[`Result: ${i.result} · Date: ${i.date} · Status: ${i.investigationStatus}`]} />) : <T muted>None</T>}
          </View>
        ))}
      </Expandable>

      <Expandable title="Clinical topics to review" icon="lightbulb-on-outline" badge={r.clinicalTopics.shown ? `${r.clinicalTopics.items.length}` : 'off'}>
        <T variant="small" muted>{r.clinicalTopics.note}</T>
        {r.clinicalTopics.items.map((t, i) => (
          <Card key={i}>
            <Chip label="POSSIBILITY TO REVIEW" tone="warning" icon="lightbulb-outline" />
            <T variant="h3">{t.topic}</T>
            <T variant="small">Why it surfaced: {t.reason}</T>
            {t.supporting.length ? <T variant="small">Supporting: {t.supporting.join('; ')}</T> : null}
            {t.contradicting.length ? <T variant="small">Contradicting: {t.contradicting.join('; ')}</T> : null}
            {t.missing.length ? <T variant="small">Missing information: {t.missing.join('; ')}</T> : null}
            {t.evidence.map((e) => <Button key={e.url} kind="ghost" compact icon="open-in-new" label={e.title} onPress={() => void Linking.openURL(e.url).catch(() => undefined)} />)}
          </Card>
        ))}
      </Expandable>

      <Expandable title="Medication information" icon="book-open-page-variant-outline" badge={r.medicationOptions.status === 'LABEL_INFORMATION_ONLY' ? 'label info' : 'insufficient'} tone={r.medicationOptions.status === 'LABEL_INFORMATION_ONLY' ? 'info' : 'neutral'} subtitle="U.S. regulatory label information · not a dosing recommendation">
        <Banner tone={r.medicationOptions.status === 'LABEL_INFORMATION_ONLY' ? 'info' : 'warning'} title={r.medicationOptions.status === 'LABEL_INFORMATION_ONLY' ? 'Medication options to review' : 'INSUFFICIENT VERIFIED EVIDENCE FOR MEDICATION OPTIONS'} message={r.medicationOptions.message} />
        {r.medicationOptions.gaps.map((g) => <Chip key={g} label={`Gap: ${g}`} tone="warning" icon="alert-outline" />)}
        {r.medicationEvidence.map((m) => (
          <Card key={m.medication}>
            <T variant="h3">{m.medication}{m.rxcui ? ` · RxCUI ${m.rxcui}` : ''}</T>
            {m.records.length === 0 ? <T muted>No verified label records retrieved. Open the medication to look it up.</T> : null}
            {m.records.map((x) => (
              <View key={x.identifier} style={{ gap: 4 }}>
                <T variant="small" style={{ fontWeight: '700' }}>{x.provider}: {x.title}</T>
                <T variant="small" muted>{x.identifier} · retrieved {formatDateTime(x.retrievedAt)}{x.publishedAt ? ` · updated ${x.publishedAt}` : ''}</T>
                {x.boxedWarning ? <T variant="small"><T variant="small" style={{ fontWeight: '800', color: c.danger }}>Boxed warning (quoted): </T>{x.boxedWarning}</T> : null}
                {x.indications ? <T variant="small"><T variant="small" style={{ fontWeight: '800' }}>Indications stated in the label: </T>{x.indications}</T> : null}
                {x.contraindications ? <T variant="small"><T variant="small" style={{ fontWeight: '800' }}>Contraindications (quoted): </T>{x.contraindications}</T> : null}
                {x.warnings ? <T variant="small"><T variant="small" style={{ fontWeight: '800' }}>Warnings (quoted): </T>{x.warnings}</T> : null}
                {x.interactions ? <T variant="small"><T variant="small" style={{ fontWeight: '800' }}>Drug interactions section (quoted): </T>{x.interactions}</T> : null}
                <Button kind="ghost" compact icon="open-in-new" label="Open source" onPress={() => void Linking.openURL(x.url).catch(() => undefined)} />
              </View>
            ))}
          </Card>
        ))}
        <Button kind="secondary" compact label="Open medication list" icon="pill" onPress={() => router.push(`${base}/medications`)} />
      </Expandable>

      <Expandable title="Assessment (clinician)" icon="clipboard-text-outline" badge={`${r.assessment.length}`}>
        {rows(r.assessment, 'No assessment stated by the clinician. AI possibilities are kept separate and are never an assessment.')}
      </Expandable>
      <Expandable title="Plan" icon="clipboard-list-outline" badge={`${r.plan.length}`}>{rows(r.plan, 'No plan stated')}</Expandable>
      <Expandable title="Follow-up" icon="calendar-check-outline" badge={`${r.followUp.length}`}>
        {r.followUp.length ? r.followUp.map((x) => <FactCard visit={visit} base={base} act={act} key={x.factId} row={x} extra={[`Due: ${x.due}`]} />) : <T muted>No follow-up stated</T>}
      </Expandable>

      <Expandable title="Longitudinal comparison" icon="compare-horizontal" badge={r.longitudinal.previous ? `${r.longitudinal.items.length} change(s)` : 'first visit'}>
        {r.longitudinal.previous ? <T variant="small" muted>Compared with {r.longitudinal.previous.visitCode} ({r.longitudinal.previous.date}). Computed from documented facts only.</T> : <T muted>No previous visit on record.</T>}
        {r.longitudinal.items.map((x, i) => (
          <Row key={i} wrap>
            <Chip label={x.kind} tone="info" />
            <T style={{ flex: 1 }}>{x.text}{x.provisional ? ' (provisional)' : ''}</T>
          </Row>
        ))}
      </Expandable>

      <Expandable title="Unresolved items" icon="alert-circle-outline" badge={`${openChanges.length + r.uncertainties.length}`} tone={openChanges.length ? 'danger' : r.uncertainties.length ? 'warning' : 'neutral'} initiallyOpen={openChanges.length > 0}>
        {r.informationChanges.length ? sub('Information that changed during the consultation') : null}
        {r.informationChanges.map((ch) => (
          <Card key={ch.conflictId} style={{ padding: space.md }}>
            <Row wrap>
              <T style={{ fontWeight: '800' }}>{ch.topic}</T>
              <Chip label={ch.type} tone="danger" />
              <Chip label={ch.status} tone={ch.status === 'open' ? 'warning' : 'success'} />
              {ch.explicitCorrection ? <Chip label="explicit correction" tone="info" icon="pencil-outline" /> : null}
            </Row>
            <T variant="small">{ch.summary}</T>
            {ch.chronology.map((x, i) => <T key={i} variant="small" muted>{i + 1}. “{x.value}” — {x.state} — {x.source}{x.where ? ` — ${x.where}` : ''}</T>)}
          </Card>
        ))}
        {r.uncertainties.length ? sub('Uncertain values') : null}
        {r.uncertainties.map((x, i) => <FactCard visit={visit} base={base} act={act} key={x.factId ?? `u${i}`} row={x} />)}
        {!r.informationChanges.length && !r.uncertainties.length ? <T muted>No unresolved items.</T> : null}
        <Button kind="secondary" compact label="Resolve in clinical facts" icon="format-list-checks" onPress={() => router.push(`${base}/facts`)} />
      </Expandable>

      <Expandable title="Source citations" icon="bookshelf" badge={`${r.evidenceSources.length}`}>
        {r.evidenceSources.length === 0 ? <T style={{ fontWeight: '700' }}>NO VERIFIED EVIDENCE FOUND{visit.evidenceState === 'NOT_STARTED' ? ' — no search run yet' : ''}</T> : null}
        {r.evidenceSources.map((e) => (
          <Card key={e.identifier} style={{ padding: space.md }}>
            <T variant="small" style={{ fontWeight: '700' }}>{e.title}</T>
            <T variant="small" muted>{e.source} · {e.sourceType} · {e.identifier}</T>
            <T variant="small" muted>Published/updated {e.publishedAt} · retrieved {e.retrievedAt}</T>
            <Button kind="ghost" compact icon="open-in-new" label="Open source" onPress={() => void Linking.openURL(e.url).catch(() => undefined)} />
          </Card>
        ))}
        <Button kind="secondary" compact label={visit.evidenceState === 'NOT_STARTED' ? 'Search evidence' : 'Refresh evidence'} icon="magnify" busy={busy === 'evidence'} onPress={() => void refreshEvidence()} />
      </Expandable>

      <Expandable title="Clinician confirmation" icon="check-decagram-outline" badge={`${r.completeness.filter((x) => x.status === 'PRESENT').length}/${r.completeness.length} present`} initiallyOpen>
        <T variant="small">{r.review.draftStatus}</T>
        <KeyValue k="Confirmed facts" v={r.review.confirmedFacts} />
        <KeyValue k="Provisional facts" v={r.review.provisionalFacts} />
        <KeyValue k="Clinician-edited" v={r.review.clinicianEditedFacts} />
        <KeyValue k="Open conflicts" v={r.review.unresolvedConflicts} />
        <KeyValue k="Uncertain values" v={r.review.uncertainValues} />
        <KeyValue k="Consultation" v={`${r.review.consultationState}${r.review.consultationFinalizedAt ? ` · ${formatDateTime(r.review.consultationFinalizedAt)}` : ''}`} />
        <KeyValue k="Note" v={`${r.review.noteState}${r.review.noteFinalizedAt ? ` · ${formatDateTime(r.review.noteFinalizedAt)}` : ''}`} />
        {sub('Completeness')}
        {r.completeness.map((x) => (
          <Row key={x.domain} style={{ justifyContent: 'space-between' }}>
            <T variant="small" style={{ flex: 1 }}>{x.domain}</T>
            <Chip label={x.status.replace(/_/g, ' ').toLowerCase()} tone={COMPLETENESS_TONE[x.status]} />
          </Row>
        ))}
        {sub('Report versions')}
        {visit.reportVersions.length === 0 ? <T muted>No saved version yet.</T> : null}
        {[...visit.reportVersions].reverse().map((v) => (
          <T key={v.versionId} variant="small" muted>v{v.versionNumber} · {formatDateTime(v.generatedAt)} · transcript v{v.transcriptVersion} · {v.confirmedFactCount}/{v.currentFactCount} confirmed · {v.clinicianEditedFactCount} edited · {v.unresolvedConflictCount} open conflict(s) · {v.extractionProviders.join(', ')}</T>
        ))}
      </Expandable>

      <Button label="Save report version" icon="content-save-outline" busy={busy === 'save'} onPress={() => void saveVersion()} />
      <Row>
        <Button kind="secondary" compact label="Export PDF" icon="file-pdf-box" onPress={() => doExport('PDF')} style={{ flex: 1 }} />
        <Button kind="secondary" compact label="Export JSON" icon="code-json" onPress={() => doExport('JSON')} style={{ flex: 1 }} />
        <Button kind="secondary" compact label="Export text" icon="file-document-outline" onPress={() => doExport('TEXT')} style={{ flex: 1 }} />
      </Row>
      <Row>
        <Button kind="secondary" compact label="Regenerate note" icon="note-edit-outline" onPress={() => router.push(`${base}/note`)} style={{ flex: 1 }} />
        <Button kind="secondary" compact label="View transcript" icon="text-box-outline" onPress={() => router.push(`${base}/transcript`)} style={{ flex: 1 }} />
      </Row>
    </Screen>
  );
}
