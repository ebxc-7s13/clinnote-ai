/**
 * Structured clinical encounter report (ADR-051). Built entirely by code from the visit's validated facts, the
 * manual patient profile, conflicts, evidence records and earlier visits — never from free model prose
 * (ADR-043). The JSON is the stored record; text/PDF are renderings of it. Missing information is reported as
 * missing; nothing is filled in to look complete. Possibilities (R2) appear only in-app and never in exports.
 */
import { canonicalTranscript, totalRecordedSec, visitLanguages } from './consultation';
import { profileValue } from './conflicts';
import { compareVisits, VITAL_LABEL } from './diff';
import { isCurrent, isEligible } from './facts';
import { languageName } from './languages';
import { MEDICATIONS } from './lexicon';
import { provenanceLabel, renderFact } from './note';
import type { ClinicalFact, FactCategory, Patient, ReportVersion, Visit } from './types';
import { allergyStatus, currentMedications, followUpDue } from './views';
import { formatDate, formatDateTime, formatDuration, newId, nowIso } from './util';

export const REPORT_GENERATOR = 'clinnote-report@1';
export const DEMO_LABEL = 'DEMO DATA — NOT A REAL PATIENT';

export type Completeness = 'PRESENT' | 'NOT_DISCUSSED' | 'UNKNOWN' | 'CONFLICTED' | 'NOT_APPLICABLE';

/** One reportable line with its provenance. `value` is code-rendered from fact fields. */
export interface ReportRow {
  label: string;
  value: string;
  source: string;
  status: string;
  factId?: string;
  transcriptCodes: string[];
  segmentCodes: string[];
  flags: string[];
}

export interface MedicationRow extends ReportRow {
  medication: string;
  dose: string;
  frequency: string;
  route: string;
  takingStatus: string;
}

export interface InvestigationRow extends ReportRow {
  test: string;
  result: string;
  unit: string;
  date: string;
  investigationStatus: string;
}

export interface ClinicalReport {
  schema: typeof REPORT_GENERATOR;
  generatedAt: string;
  transcriptVersion: number;
  demo: boolean;
  timeZoneNote: string;
  patient: ReportRow[];
  visit: { rows: { label: string; value: string }[]; segments: { code: string; startedAt: string; endedAt?: string; duration: string; language: string; utterances: number; status: string }[] };
  chiefComplaint: ReportRow | null;
  presentIllness: ReportRow[];
  negativeFindings: ReportRow[];
  history: { confirmed: ReportRow[]; patientReported: ReportRow[]; clinicianStated: ReportRow[]; uncertain: ReportRow[] };
  medications: { current: MedicationRow[]; previous: MedicationRow[]; reportedStopped: MedicationRow[]; proposedChange: ReportRow[]; uncertain: MedicationRow[]; fromRecordNotDiscussed: MedicationRow[] };
  allergies: { rows: ReportRow[]; status: 'ALLERGIES_RECORDED' | 'NO_KNOWN_ALLERGIES_DOCUMENTED' | 'ALLERGY_DENIED' | 'NOT_DISCUSSED' | 'UNCERTAIN'; statusLine: string };
  vitals: (ReportRow & { measurement: string; unit: string })[];
  examination: { positive: ReportRow[]; negative: ReportRow[]; status: Completeness };
  investigations: { completed: InvestigationRow[]; pending: InvestigationRow[]; planned: InvestigationRow[]; unknown: InvestigationRow[] };
  consolidatedFacts: { category: string; value: string; state: string; mentions: number; sources: string[]; status: string; transcriptCodes: string[]; segmentCodes: string[]; conflict: boolean }[];
  informationChanges: { conflictId: string; topic: string; type: string; status: string; explicitCorrection: boolean; summary: string; chronology: { value: string; state: string; source: string; where: string }[] }[];
  clinicalTopics: { shown: boolean; note: string; items: { topic: string; reason: string; supporting: string[]; contradicting: string[]; missing: string[]; evidence: { title: string; url: string; identifier: string }[] }[] };
  medicationEvidence: { medication: string; rxcui?: string; records: { provider: string; title: string; identifier: string; url: string; publishedAt?: string; retrievedAt: string; indications?: string; boxedWarning?: string; warnings?: string; contraindications?: string; interactions?: string }[] }[];
  medicationOptions: { status: 'INSUFFICIENT_VERIFIED_EVIDENCE' | 'LABEL_INFORMATION_ONLY'; message: string; gaps: string[] };
  assessment: ReportRow[];
  plan: ReportRow[];
  followUp: (ReportRow & { due: string })[];
  longitudinal: { previous?: { visitCode: string; date: string }; items: { kind: string; text: string; provisional: boolean }[] };
  evidenceSources: { source: string; sourceType: string; title: string; identifier: string; publishedAt: string; retrievedAt: string; url: string }[];
  uncertainties: ReportRow[];
  review: { draftStatus: string; noteState: string; clinicianEditedFacts: number; confirmedFacts: number; provisionalFacts: number; unresolvedConflicts: number; uncertainValues: number; consultationState: string; consultationFinalizedAt?: string; noteFinalizedAt?: string };
  completeness: { domain: string; status: Completeness; detail: string }[];
}

// ------------------------------------------------------------------ helpers

const STATE_TEXT: Record<string, string> = { POSITIVE: 'present', NEGATIVE: 'denied / absent', UNKNOWN: 'unclear', NOT_DISCUSSED: 'not discussed' };
const STATUS_TEXT: Record<string, string> = { PROVISIONAL: 'Provisional — not reviewed', CONFIRMED: 'Confirmed by clinician', REJECTED: 'Rejected', UNKNOWN: 'Unknown' };
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const strip = (s: string) => s.replace(/ \([^()]*(?:\([^()]*\)[^()]*)*\)$/, '');

function codes(v: Visit, f: ClinicalFact): { transcriptCodes: string[]; segmentCodes: string[] } {
  const segs = v.segments.filter((s) => f.sourceSegmentIds.includes(s.segmentId));
  const rec = new Map(v.recordingSegments.map((r) => [r.recordingSegmentId, r.displayCode]));
  return { transcriptCodes: segs.map((s) => s.displayCode), segmentCodes: Array.from(new Set(segs.map((s) => rec.get(s.recordingSegmentId ?? '') ?? '').filter(Boolean))) };
}

function flagsOf(v: Visit, f: ClinicalFact): string[] {
  const out: string[] = [];
  if (f.conflictIds.some((id) => v.conflicts.find((c) => c.conflictId === id && c.status === 'OPEN'))) out.push('Conflict — review');
  if (f.informationState === 'UNKNOWN') out.push('Uncertain');
  if (f.needsClarification && f.clarificationReason && f.clarificationReason !== 'CONFLICT') out.push(`Needs clarification (${f.clarificationReason.toLowerCase().replace(/_/g, ' ')})`);
  if (f.provenance === 'AI_EXTRACTED') out.push('AI inference — verify');
  return out;
}

function row(v: Visit, f: ClinicalFact, label?: string, value?: string): ReportRow {
  return { label: label ?? cap(f.normalizedValue ?? (f.conceptKey !== 'UNMAPPED' && !f.conceptKey.startsWith('demographic:') ? f.conceptKey : f.value)), value: value ?? strip(renderFact(f)), source: cap(provenanceLabel(f)), status: STATUS_TEXT[f.status], factId: f.factId, ...codes(v, f), flags: flagsOf(v, f) };
}

function medRow(v: Visit, f: ClinicalFact): MedicationRow {
  const a = f.attributes;
  return {
    ...row(v, f, a.rawName ?? f.value),
    medication: a.normalizedName ? `${a.rawName ?? f.value} (${a.normalizedName})` : a.rawName ?? f.value,
    dose: a.dose ?? 'not stated',
    frequency: a.frequency ?? 'not stated',
    route: a.route ?? 'not stated',
    takingStatus: f.informationState === 'UNKNOWN' ? 'uncertain' : (a.takingStatus ?? 'not stated').toLowerCase(),
  };
}

const medTerms = [...MEDICATIONS].sort((a, b) => b.length - a.length);
/** Medication names stated inside a clinician plan line ("Start amoxicillin 500 mg"). */
export function medicationsIn(text: string): string[] {
  const t = ` ${text.toLowerCase()} `;
  const found: string[] = [];
  for (const m of medTerms) if (t.includes(` ${m} `) && !found.some((x) => x.includes(m))) found.push(m);
  return found;
}

/** Facts current for display: eligible, plus open-conflict members (shown flagged), never rejected/superseded. */
const shown = (v: Visit, cats: FactCategory[]) => v.facts.filter((f) => isEligible(f) && cats.includes(f.category));

/**
 * When an open conflict has an explicit correction cue, the earlier statement is shown in the change history
 * only; the corrected one is shown in the section, marked pending confirmation. Without a cue both stay visible.
 */
function hiddenByExplicitCorrection(v: Visit): Set<string> {
  const out = new Set<string>();
  for (const c of v.conflicts) {
    if (c.status !== 'OPEN' || !c.explicitCorrection || !c.proposedCurrentFactId) continue;
    for (const id of c.factIds) if (id !== c.proposedCurrentFactId) out.add(id);
  }
  return out;
}

function demographic(v: Visit, kind: NonNullable<ClinicalFact['attributes']['demographicKind']>): ClinicalFact | undefined {
  const fs = shown(v, ['DEMOGRAPHIC']).filter((f) => f.attributes.demographicKind === kind && f.informationState === 'POSITIVE');
  return fs.sort((a, b) => (b.sourceStartTime ?? 0) - (a.sourceStartTime ?? 0))[0];
}

// ------------------------------------------------------------------ builder

export function buildClinicalReport(input: { patient: Patient; visit: Visit; allVisits: Visit[]; possibilitiesShown?: boolean }): ClinicalReport {
  const { patient, visit: v, allVisits } = input;
  const hidden = hiddenByExplicitCorrection(v);
  const openConflicts = v.conflicts.filter((c) => c.status === 'OPEN');
  const profileConflict = (field: string) => openConflicts.find((c) => c.conflictType === 'PROFILE_MISMATCH' && c.profileField === field);
  const visible = (cats: FactCategory[]) => shown(v, cats).filter((f) => !hidden.has(f.factId));

  // ---- A. patient
  const patientRows: ReportRow[] = [];
  const manual = (label: string, value: string | undefined): ReportRow => ({ label, value: value ?? 'Not recorded', source: value ? 'Patient profile (entered by clinician)' : '—', status: value ? 'Recorded' : 'Not recorded', transcriptCodes: [], segmentCodes: [], flags: [] });
  patientRows.push(manual('Patient reference', patient.patientReference));
  const detail = (label: string, field: 'name' | 'age' | 'occupation' | 'preferredLanguage', kind: NonNullable<ClinicalFact['attributes']['demographicKind']>, fmt: (x: string) => string = (x) => x) => {
    const rec = profileValue(patient, field);
    const said = demographic(v, kind);
    const conflict = profileConflict(field);
    if (conflict && said) {
      patientRows.push({ label, value: `${fmt(rec ?? '')} (profile) · ${fmt(said.attributes.demographicValue ?? said.value)} (stated in consultation)`, source: `Profile vs ${provenanceLabel(said)}`, status: 'Conflict — review (profile not changed)', factId: said.factId, ...codes(v, said), flags: ['Conflict — review'] });
    } else if (rec !== undefined) patientRows.push(manual(label, fmt(rec)));
    else if (said) patientRows.push(row(v, said, label, `${fmt(said.attributes.demographicValue ?? said.value)}${said.attributes.demographicQualifier === 'PREVIOUS' ? ' (previous)' : ''}`));
    else patientRows.push({ label, value: 'Not discussed', source: '—', status: 'Not recorded', transcriptCodes: [], segmentCodes: [], flags: [] });
  };
  detail('Name', 'name', 'NAME');
  detail('Age', 'age', 'AGE', (x) => (x ? `${x} years` : x));
  patientRows.push(manual('Date of birth', patient.dateOfBirth));
  patientRows.push(manual('Sex', patient.sex && patient.sex !== 'UNKNOWN' ? patient.sex.toLowerCase() : undefined));
  detail('Occupation', 'occupation', 'OCCUPATION');
  const edu = demographic(v, 'EDUCATION');
  if (edu) patientRows.push(row(v, edu, 'Education / class', edu.attributes.demographicValue ?? edu.value));
  detail('Language preference', 'preferredLanguage', 'LANGUAGE', (x) => languageName(x));

  // ---- B. visit
  const sortedVisits = [...allVisits].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const visitNo = sortedVisits.findIndex((x) => x.visitId === v.visitId) + 1;
  const end = v.consultationFinalizedAt ?? v.endedAt;
  const langs = visitLanguages(v);
  const latestNote = v.noteVersions[v.noteVersions.length - 1];
  const segments = v.recordingSegments.map((s) => ({
    code: s.displayCode,
    startedAt: s.startedAt,
    endedAt: s.endedAt,
    duration: formatDuration(s.durationSec),
    language: languageName(s.language),
    utterances: v.segments.filter((u) => u.recordingSegmentId === s.recordingSegmentId && !u.excluded).length,
    status: s.status.toLowerCase(),
  }));
  const visitRows = [
    { label: 'Visit', value: `${v.visitCode}${visitNo > 0 ? ` (visit ${visitNo} of ${sortedVisits.length})` : ''}` },
    { label: 'Visit date', value: formatDate(v.startedAt) },
    { label: 'Visit start', value: formatDateTime(v.startedAt) },
    { label: 'Visit end', value: end ? formatDateTime(end) : 'Not ended' },
    { label: 'Recorded duration', value: v.mode === 'AMBIENT' ? formatDuration(totalRecordedSec(v)) : 'Manual visit' },
    { label: 'Recording segments', value: v.recordingSegments.length ? v.recordingSegments.map((s) => `${s.displayCode} ${formatDateTime(s.startedAt).slice(-5)}–${s.endedAt ? formatDateTime(s.endedAt).slice(-5) : 'open'}`).join(', ') : 'None' },
    { label: 'Language(s)', value: langs.length ? langs.map(languageName).join(', ') : 'Not recorded' },
    { label: 'Transcript status', value: `${v.transcriptState.toLowerCase().replace('_', ' ')} · ${v.transcriptSource === 'GEMINI_FINAL' ? 'cloud final pass' : v.transcriptSource === 'LIVE_DEVICE' ? 'on-device live' : v.transcriptSource.toLowerCase()} · version ${v.transcriptVersion}${v.reconciledTranscriptVersion !== undefined && v.reconciledTranscriptVersion !== v.transcriptVersion ? ' (changed since facts were extracted — reconcile)' : ''}` },
    { label: 'Consultation', value: v.consultationState === 'FINALIZED' ? `Finalized ${formatDateTime(v.consultationFinalizedAt)}` : 'Open' },
    { label: 'Report status', value: `Draft version ${v.reportVersions.length + 1} — generated from documented facts; clinician review required` },
  ];

  // ---- C/D. presenting complaint and history of present illness
  const sx = visible(['SYMPTOM']);
  const positiveSx = sx.filter((f) => f.informationState === 'POSITIVE' || f.informationState === 'UNKNOWN');
  const ccFact = positiveSx.find((f) => f.informationState === 'POSITIVE' && f.sourceSpeakerRole === 'PATIENT') ?? positiveSx.find((f) => f.informationState === 'POSITIVE');
  const corrected = (f: ClinicalFact) => (v.conflicts.some((c) => c.status === 'OPEN' && c.explicitCorrection && c.proposedCurrentFactId === f.factId) ? ['Corrected during consultation — pending clinician confirmation'] : []);
  const hpi = positiveSx.map((f) => {
    const r = row(v, f);
    r.flags.push(...corrected(f));
    return r;
  });

  // ---- E. history
  const hist = visible(['HISTORY_MEDICAL', 'HISTORY_SURGICAL', 'HISTORY_FAMILY', 'HISTORY_SOCIAL']).map((f) => ({ f, r: row(v, f, `${f.category === 'HISTORY_FAMILY' ? 'Family' : f.category === 'HISTORY_SOCIAL' ? 'Social' : f.category === 'HISTORY_SURGICAL' ? 'Surgical' : 'Medical'}: ${cap(f.normalizedValue ?? f.value)}`) }));
  const isUncertain = (f: ClinicalFact) => f.informationState === 'UNKNOWN' || f.provenance === 'AI_EXTRACTED' || f.provenance === 'TRANSCRIPTION' || f.provenance === 'UNKNOWN';
  const history = {
    confirmed: hist.filter(({ f }) => f.status === 'CONFIRMED').map((x) => x.r),
    patientReported: hist.filter(({ f }) => f.status !== 'CONFIRMED' && !isUncertain(f) && f.provenance === 'PATIENT_REPORTED').map((x) => x.r),
    clinicianStated: hist.filter(({ f }) => f.status !== 'CONFIRMED' && !isUncertain(f) && f.provenance === 'CLINICIAN_STATED').map((x) => x.r),
    uncertain: hist.filter(({ f }) => f.status !== 'CONFIRMED' && isUncertain(f)).map((x) => x.r),
  };

  // ---- F. medications (never: mentioned = active prescription)
  const meds = visible(['MEDICATION']).filter((f) => f.conceptKey !== 'ANY');
  const medications: ClinicalReport['medications'] = { current: [], previous: [], reportedStopped: [], proposedChange: [], uncertain: [], fromRecordNotDiscussed: [] };
  for (const f of meds) {
    const r = medRow(v, f);
    const t = f.attributes.takingStatus;
    if (f.informationState === 'UNKNOWN' || r.flags.includes('Conflict — review')) medications.uncertain.push(r);
    else if (f.informationState === 'NEGATIVE') medications.uncertain.push({ ...r, takingStatus: 'stated not taking' });
    else if (t === 'CURRENT') medications.current.push(r);
    else if (t === 'PREVIOUS') medications.previous.push(r);
    else if (t === 'DISCONTINUED') medications.reportedStopped.push({ ...r, flags: [...r.flags, f.status === 'CONFIRMED' ? 'Discontinuation confirmed' : 'Reported stopped — clinician to confirm; not removed from the record'] });
    else medications.uncertain.push({ ...r, takingStatus: 'mentioned — status not stated' });
  }
  const mentioned = new Set(meds.map((f) => (f.attributes.rxcui ?? f.conceptKey).toLowerCase()));
  for (const m of currentMedications(allVisits.filter((x) => x.visitId !== v.visitId && x.startedAt <= v.startedAt))) {
    if (mentioned.has((m.fact.attributes.rxcui ?? m.fact.conceptKey).toLowerCase())) continue;
    const r = medRow(m.visit, m.fact);
    medications.fromRecordNotDiscussed.push({ ...r, flags: [...r.flags, `Confirmed at ${m.visit.visitCode}; not discussed this visit (not discontinued)`] });
  }
  for (const f of visible(['PLAN'])) {
    const names = medicationsIn(f.value);
    if (names.length) medications.proposedChange.push({ ...row(v, f, names.join(', '), f.value), flags: [...flagsOf(v, f), 'Clinician-stated plan wording — not a prescription record'] });
  }

  // ---- G. allergies
  const al = allergyStatus([v]);
  const allergyFacts = v.facts.filter((f) => f.category === 'ALLERGY' && isCurrent(f));
  const anyNeg = allergyFacts.filter((f) => isEligible(f) && f.conceptKey === 'ANY' && f.informationState === 'NEGATIVE');
  const allergyRows = al.positives.map((p) => ({ ...row(v, p.fact, p.fact.attributes.substance ?? p.fact.value, `${p.fact.attributes.substance ?? p.fact.value}${p.fact.attributes.reaction ? ` — reaction: ${p.fact.attributes.reaction}` : ' — reaction not stated'}`), flags: [...flagsOf(v, p.fact), ...(p.contextUnclear ? ['Needs clarification (context)'] : [])] }));
  const allergyState: ClinicalReport['allergies']['status'] = al.positives.length
    ? 'ALLERGIES_RECORDED'
    : /unclear/i.test(al.statusLine)
      ? 'UNCERTAIN'
      : anyNeg.some((f) => f.status === 'CONFIRMED')
        ? 'NO_KNOWN_ALLERGIES_DOCUMENTED'
        : anyNeg.length
          ? 'ALLERGY_DENIED'
          : allergyFacts.some((f) => f.informationState !== 'NOT_DISCUSSED')
            ? 'UNCERTAIN'
            : 'NOT_DISCUSSED';
  const allergyLine = { ALLERGIES_RECORDED: al.statusLine, NO_KNOWN_ALLERGIES_DOCUMENTED: 'No known allergies documented (confirmed by clinician)', ALLERGY_DENIED: 'Allergy denied (stated in consultation; not yet confirmed)', NOT_DISCUSSED: 'Allergies not discussed', UNCERTAIN: 'Allergy status uncertain — needs clarification' }[allergyState];

  // ---- H. vitals
  const vitals = visible(['VITAL_SIGN']).map((f) => {
    const a = f.attributes;
    const value = a.vitalKind === 'BP' && a.numericValue2 !== undefined ? `${a.numericValue}/${a.numericValue2}` : String(a.numericValue ?? f.value);
    return { ...row(v, f, VITAL_LABEL[a.vitalKind ?? ''] ?? 'Measurement', value), measurement: VITAL_LABEL[a.vitalKind ?? ''] ?? 'Measurement', unit: a.unit ?? 'not stated' };
  });

  // ---- I. examination (only what the clinician said)
  const exam = visible(['EXAMINATION_FINDING']);
  const examination = {
    positive: exam.filter((f) => f.informationState !== 'NEGATIVE').map((f) => row(v, f, 'Finding', f.value)),
    negative: exam.filter((f) => f.informationState === 'NEGATIVE').map((f) => row(v, f, 'Documented normal / negative', f.value)),
    status: (exam.length ? 'PRESENT' : 'NOT_DISCUSSED') as Completeness,
  };

  // ---- J. investigations
  const inv = visible(['INVESTIGATION']).map((f): InvestigationRow => {
    const a = f.attributes;
    const unit = a.result?.match(/[a-z%/]+$/i)?.[0] ?? a.unit ?? '';
    return { ...row(v, f, cap(a.testName ?? f.value)), test: cap(a.testName ?? f.value), result: a.result ?? 'not stated', unit: unit || 'not stated', date: formatDate(v.startedAt), investigationStatus: (a.investigationStatus ?? 'UNKNOWN').toLowerCase().replace(/_/g, ' ') };
  });
  const investigations = {
    completed: inv.filter((i) => ['completed', 'result available', 'result discussed'].includes(i.investigationStatus)),
    pending: inv.filter((i) => i.investigationStatus === 'pending' || i.investigationStatus === 'scheduled'),
    planned: inv.filter((i) => i.investigationStatus === 'ordered'),
    unknown: inv.filter((i) => i.investigationStatus === 'unknown'),
  };

  // ---- K. consolidated facts: one entry per concept + state; repeated statements counted, not repeated
  const groups = new Map<string, ClinicalFact[]>();
  for (const f of v.facts.filter((x) => isEligible(x) && x.conceptKey !== 'ANY' && !hidden.has(x.factId))) {
    const k = `${f.category}|${f.conceptKey === 'UNMAPPED' ? f.value.toLowerCase() : f.conceptKey}|${f.informationState}|${f.attributes.dose ?? ''}|${f.attributes.duration ?? ''}|${f.attributes.takingStatus ?? ''}|${f.attributes.numericValue ?? ''}`;
    groups.set(k, (groups.get(k) ?? []).concat(f));
  }
  const consolidatedFacts = Array.from(groups.values())
    .sort((a, b) => (a[0].sourceStartTime ?? 0) - (b[0].sourceStartTime ?? 0))
    .map((fs) => {
      const c = fs.map((f) => codes(v, f));
      return {
        category: fs[0].category,
        value: strip(renderFact(fs.find((f) => f.status === 'CONFIRMED') ?? fs[0])),
        state: STATE_TEXT[fs[0].informationState],
        mentions: fs.length,
        sources: Array.from(new Set(fs.map((f) => cap(provenanceLabel(f))))),
        status: fs.some((f) => f.status === 'CONFIRMED') ? 'Confirmed by clinician' : 'Provisional — not reviewed',
        transcriptCodes: Array.from(new Set(c.flatMap((x) => x.transcriptCodes))),
        segmentCodes: Array.from(new Set(c.flatMap((x) => x.segmentCodes))),
        conflict: fs.some((f) => flagsOf(v, f).includes('Conflict — review')),
      };
    });

  // ---- changes during the consultation (conflicts with chronology)
  const allFacts = allVisits.flatMap((x) => (x.visitId === v.visitId ? v.facts : x.facts));
  const informationChanges = v.conflicts.map((c) => {
    const fs = c.factIds.map((id) => allFacts.find((f) => f.factId === id)).filter((f): f is ClinicalFact => !!f);
    const ordered = [...fs].sort((a, b) => (a.visitId === b.visitId ? (a.sourceStartTime ?? 0) - (b.sourceStartTime ?? 0) : a.createdAt.localeCompare(b.createdAt)));
    const where = (f: ClinicalFact) => {
      const owner = f.visitId === v.visitId ? v : allVisits.find((x) => x.visitId === f.visitId);
      if (!owner) return '';
      const cc = codes(owner, f);
      return [f.visitId !== v.visitId ? `earlier visit ${owner.visitCode} (${formatDate(owner.startedAt)})` : null, cc.segmentCodes.join(', ') || null, cc.transcriptCodes.join(', ') || null, f.sourceStartTime !== undefined ? formatDuration(f.sourceStartTime) : null].filter(Boolean).join(' · ');
    };
    const chronology = ordered.map((f) => ({ value: f.value, state: STATE_TEXT[f.informationState], source: cap(provenanceLabel(f)), where: where(f) }));
    if (c.conflictType === 'PROFILE_MISMATCH') chronology.unshift({ value: `${c.profileField}: ${c.profileValue}`, state: 'recorded', source: 'Patient profile (entered by clinician)', where: 'profile' });
    const topic = cap(fs[0]?.category === 'DEMOGRAPHIC' ? (fs[0].attributes.demographicKind ?? 'detail').toLowerCase() : fs[0]?.normalizedValue ?? (fs[0] && fs[0].conceptKey !== 'UNMAPPED' ? fs[0].conceptKey : fs[0]?.value ?? 'item'));
    const summary =
      c.status !== 'OPEN'
        ? `Resolved by clinician ${formatDateTime(c.resolvedAt)}; all statements kept in history.`
        : c.conflictType === 'PROFILE_MISMATCH'
          ? 'The consultation differs from the patient profile. The profile was not changed; choose which value to keep.'
          : c.explicitCorrection
            ? 'The later statement was worded as a correction. It is shown as current, pending clinician confirmation; the earlier statement is kept.'
            : c.conflictType === 'CROSS_VISIT'
              ? 'Differs from an earlier visit. Earlier records are unchanged; review which is current.'
              : 'The information changed during the consultation. Neither statement was overwritten; clinician to decide which is current.';
    return { conflictId: c.conflictId, topic, type: c.conflictType.toLowerCase().replace(/_/g, ' '), status: c.status.toLowerCase().replace(/_/g, ' '), explicitCorrection: !!c.explicitCorrection, summary, chronology };
  });

  // ---- L. possibilities to review (R2, in-app only)
  const cands = v.candidates.filter((c) => !c.supersededByRunId && c.status !== 'DISMISSED');
  const factValue = (id: string) => v.facts.find((f) => f.factId === id)?.value ?? id;
  const clinicalTopics = {
    shown: !!input.possibilitiesShown && cands.length > 0,
    note: input.possibilitiesShown
      ? cands.length
        ? 'POSSIBILITY TO REVIEW — not a diagnosis. Generated only from retrieved evidence (R2 development feature). Never included in exports.'
        : v.candidateSkipReason ?? 'No possibilities were generated.'
      : 'Possibilities to review are off (R2 feature behind a default-off flag until a formal regulatory assessment, ADR-025).',
    items: input.possibilitiesShown
      ? cands.map((c) => ({
          topic: c.topic,
          reason: c.reason,
          supporting: c.supportingFactIds.map(factValue),
          contradicting: c.contradictingFactIds.map(factValue),
          missing: c.missingInformation,
          evidence: c.evidenceIds.map((id) => v.evidence.find((e) => e.evidenceId === id)).filter((e): e is NonNullable<typeof e> => !!e).map((e) => ({ title: e.title, url: e.url, identifier: `${e.identifierType} ${e.identifier}` })),
        }))
      : [],
  };

  // ---- M. medication evidence (label text quoted from the source; no dosing)
  const medicationEvidence = meds
    .map((f) => {
      const records = v.evidence.filter((e) => e.sourceType === 'REGULATORY' && (e.sourceFactIds.includes(f.factId) || (f.attributes.rxcui && e.retrievedFor.includes(`RxCUI ${f.attributes.rxcui}`))));
      return {
        medication: f.attributes.normalizedName ?? f.attributes.rawName ?? f.value,
        rxcui: f.attributes.rxcui,
        records: records.map((e) => ({ provider: e.provider, title: e.title, identifier: `${e.identifierType} ${e.identifier}`, url: e.url, publishedAt: e.publishedAt, retrievedAt: e.retrievedAt, indications: e.extra?.indications, boxedWarning: e.extra?.boxedWarning, warnings: e.extra?.warnings, contraindications: e.extra?.contraindications, interactions: e.extra?.interactions })),
      };
    })
    .filter((m, i, arr) => arr.findIndex((x) => x.medication.toLowerCase() === m.medication.toLowerCase()) === i);
  const gaps: string[] = [];
  if (allergyState === 'NOT_DISCUSSED' || allergyState === 'UNCERTAIN') gaps.push('Allergy status is not established.');
  if (openConflicts.length) gaps.push(`${openConflicts.length} unresolved conflict(s).`);
  if (!visible(['ASSESSMENT']).some((f) => f.status === 'CONFIRMED')) gaps.push('No clinician-confirmed assessment.');
  if (meds.some((f) => f.status !== 'CONFIRMED')) gaps.push('Medication list not yet confirmed by the clinician.');
  const withLabels = medicationEvidence.filter((m) => m.records.length);
  const medicationOptions: ClinicalReport['medicationOptions'] = withLabels.length
    ? { status: 'LABEL_INFORMATION_ONLY', message: `Label information is shown for ${withLabels.length} medication(s) already mentioned. ClinNote does not suggest, choose or dose medications; suitability for this patient is the clinician's decision.`, gaps }
    : { status: 'INSUFFICIENT_VERIFIED_EVIDENCE', message: 'INSUFFICIENT VERIFIED EVIDENCE FOR MEDICATION OPTIONS. No verified label records were retrieved for the medications in this visit, and ClinNote never proposes new medications.', gaps };

  // ---- N/O/P. assessment, plan, follow-up (clinician wording)
  const assessment = visible(['ASSESSMENT'])
    .filter((f) => f.status === 'CONFIRMED' || f.rootOriginProvenance === 'CLINICIAN_STATED')
    .map((f) => row(v, f, 'Assessment (clinician)', f.value));
  const plan = visible(['PLAN']).map((f) => row(v, f, 'Plan (clinician)', f.value));
  const followUp = visible(['FOLLOW_UP']).map((f) => {
    const due = followUpDue(f, v);
    return { ...row(v, f, 'Follow-up', f.value), due: due ? `${due.approximate ? 'approx. ' : ''}${formatDate(due.date)}${due.approximate ? ` (${f.attributes.interval} after the visit)` : ''}` : 'not stated' };
  });

  // ---- Q. longitudinal comparison (deterministic, ADR-045 d5)
  const prev = sortedVisits.filter((x) => x.startedAt < v.startedAt).pop();
  const longitudinal = prev
    ? { previous: { visitCode: prev.visitCode, date: formatDate(prev.startedAt) }, items: compareVisits(prev, v).filter((d) => d.kind !== 'UNCHANGED').map((d) => ({ kind: d.kind.toLowerCase().replace(/_/g, ' '), text: d.text, provisional: d.provisional })) }
    : { items: [] };

  // ---- R. evidence sources (retrieved records only)
  const seenIds = new Set<string>();
  const evidenceSources = v.evidence
    .filter((e) => !seenIds.has(e.identifier) && seenIds.add(e.identifier))
    .map((e) => ({ source: e.provider, sourceType: e.sourceType.toLowerCase().replace(/_/g, ' '), title: e.title, identifier: `${e.identifierType} ${e.identifier}`, publishedAt: e.publishedAt ? formatDate(e.publishedAt) : 'not stated', retrievedAt: formatDateTime(e.retrievedAt), url: e.url }));

  // ---- uncertainties
  const uncertainties = v.facts.filter((f) => isCurrent(f) && (f.informationState === 'UNKNOWN' || (f.needsClarification && f.clarificationReason !== 'CONFLICT'))).map((f) => row(v, f, cap(f.category.toLowerCase().replace(/_/g, ' ')), f.value));
  const markedUncertain = canonicalTranscript(v).filter((s) => s.clinicianMarkedUncertain || s.confidence === 'LOW');
  for (const s of markedUncertain) uncertainties.push({ label: 'Transcript', value: `"${s.text}"`, source: 'Transcript (unclear speech)', status: 'Check recording / transcript', transcriptCodes: [s.displayCode], segmentCodes: [], flags: ['Uncertain speech'] });

  // ---- S. review
  const current = v.facts.filter(isCurrent);
  const finalNote = [...v.noteVersions].reverse().find((n) => n.source === 'CLINICIAN_FINALIZED');
  const review = {
    draftStatus: 'DRAFT — generated by code from documented facts. Saving or finalizing does not mark it clinically verified.',
    noteState: v.noteState.toLowerCase(),
    clinicianEditedFacts: current.filter((f) => f.derivationMethod === 'CLINICIAN_EDIT').length,
    confirmedFacts: current.filter((f) => f.status === 'CONFIRMED').length,
    provisionalFacts: current.filter((f) => f.status === 'PROVISIONAL').length,
    unresolvedConflicts: openConflicts.length,
    uncertainValues: uncertainties.length,
    consultationState: v.consultationState.toLowerCase(),
    consultationFinalizedAt: v.consultationFinalizedAt,
    noteFinalizedAt: finalNote?.createdAt ?? (latestNote?.source === 'CLINICIAN_FINALIZED' ? latestNote.createdAt : undefined),
  };

  // ---- completeness (honest: no value is invented to complete a section)
  const domainStatus = (cats: FactCategory[], label: string): { domain: string; status: Completeness; detail: string } => {
    const fs = v.facts.filter((f) => isCurrent(f) && cats.includes(f.category));
    const conflict = fs.some((f) => openConflicts.some((c) => c.factIds.includes(f.factId)));
    const stated = fs.filter((f) => isEligible(f) && f.informationState !== 'NOT_DISCUSSED' && f.conceptKey !== 'ANY');
    if (conflict) return { domain: label, status: 'CONFLICTED', detail: `${fs.length} item(s), conflict open` };
    if (stated.length) return { domain: label, status: 'PRESENT', detail: `${stated.length} item(s)` };
    if (fs.some((f) => f.informationState === 'UNKNOWN' || !isEligible(f))) return { domain: label, status: 'UNKNOWN', detail: 'stated but unclear or under review' };
    if (fs.some((f) => f.informationState === 'NEGATIVE')) return { domain: label, status: 'PRESENT', detail: 'denied / none stated' };
    return { domain: label, status: 'NOT_DISCUSSED', detail: 'nothing documented' };
  };
  const completeness = [
    domainStatus(['DEMOGRAPHIC'], 'Demographics (from consultation)'),
    domainStatus(['SYMPTOM'], 'Symptoms'),
    domainStatus(['HISTORY_MEDICAL', 'HISTORY_SURGICAL', 'HISTORY_FAMILY', 'HISTORY_SOCIAL'], 'History'),
    domainStatus(['MEDICATION'], 'Medications'),
    { domain: 'Allergies', status: (allergyState === 'NOT_DISCUSSED' ? 'NOT_DISCUSSED' : allergyState === 'UNCERTAIN' ? 'UNKNOWN' : al.conflict ? 'CONFLICTED' : 'PRESENT') as Completeness, detail: allergyLine },
    domainStatus(['VITAL_SIGN'], 'Vital signs'),
    domainStatus(['EXAMINATION_FINDING'], 'Examination'),
    domainStatus(['INVESTIGATION'], 'Investigations'),
    domainStatus(['ASSESSMENT'], 'Assessment'),
    domainStatus(['PLAN'], 'Plan'),
    domainStatus(['FOLLOW_UP'], 'Follow-up'),
    { domain: 'Unresolved conflicts', status: (openConflicts.length ? 'CONFLICTED' : 'NOT_APPLICABLE') as Completeness, detail: openConflicts.length ? `${openConflicts.length} open` : 'none open' },
  ];
  if (patient.age !== undefined || demographic(v, 'AGE')) completeness[0] = { ...completeness[0], status: completeness[0].status === 'NOT_DISCUSSED' ? 'PRESENT' : completeness[0].status, detail: completeness[0].status === 'NOT_DISCUSSED' ? 'from patient profile' : completeness[0].detail };

  const offset = -new Date(v.startedAt).getTimezoneOffset();
  const tz = `UTC${offset >= 0 ? '+' : '−'}${String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0')}:${String(Math.abs(offset) % 60).padStart(2, '0')}`;

  return {
    schema: REPORT_GENERATOR,
    generatedAt: nowIso(),
    transcriptVersion: v.transcriptVersion,
    demo: patient.isDemo,
    timeZoneNote: `Times are stored in UTC and shown in this device's local time (${tz}).`,
    patient: patientRows,
    visit: { rows: visitRows, segments },
    chiefComplaint: ccFact ? row(v, ccFact, 'Presenting complaint') : null,
    presentIllness: hpi,
    negativeFindings: sx.filter((f) => f.informationState === 'NEGATIVE').map((f) => row(v, f)),
    history,
    medications,
    allergies: { rows: allergyRows, status: allergyState, statusLine: allergyLine },
    vitals,
    examination,
    investigations,
    consolidatedFacts,
    informationChanges,
    clinicalTopics,
    medicationEvidence,
    medicationOptions,
    assessment,
    plan,
    followUp,
    longitudinal,
    evidenceSources,
    uncertainties,
    review,
    completeness,
  };
}

/** Stores a new report version (previous versions are kept). Returns it. */
export function addReportVersion(v: Visit, report: ClinicalReport): ReportVersion {
  const providers = Array.from(new Set(['rule-based (on device)', ...v.executions.filter((e) => e.outcome === 'SUCCESS').map((e) => `${e.provider}${e.model ? ` ${e.model}` : ''} (${e.job})`)]));
  const current = v.facts.filter(isCurrent);
  const rv: ReportVersion = {
    versionId: newId(),
    versionNumber: v.reportVersions.length + 1,
    generatedAt: report.generatedAt,
    transcriptVersion: v.transcriptVersion,
    generator: REPORT_GENERATOR,
    extractionProviders: providers,
    clinicianEditedFactCount: current.filter((f) => f.derivationMethod === 'CLINICIAN_EDIT').length,
    confirmedFactCount: current.filter((f) => f.status === 'CONFIRMED').length,
    currentFactCount: current.length,
    unresolvedConflictCount: v.conflicts.filter((c) => c.status === 'OPEN').length,
    report: report as unknown as Record<string, unknown>,
  };
  v.reportVersions.push(rv);
  v.audit.push({ eventId: newId(), entityType: 'REPORT', entityId: rv.versionId, action: 'GENERATED', actor: 'SYSTEM', createdAt: nowIso(), detail: `version ${rv.versionNumber}, transcript v${rv.transcriptVersion}` });
  return rv;
}

// ------------------------------------------------------------------ text rendering (export / PDF)

function rowsText(rows: ReportRow[], empty = 'None documented'): string[] {
  if (!rows.length) return [`  ${empty}`];
  return rows.map((r) => `  - ${r.label === r.value ? r.value : `${r.label}: ${r.value}`} [${r.source}; ${r.status}${r.transcriptCodes.length ? `; ${[...r.segmentCodes, ...r.transcriptCodes].join(', ')}` : ''}]${r.flags.length ? ` — ${r.flags.join('; ')}` : ''}`);
}

/** Plain-text rendering of the report for export. Possibilities are never rendered here (CS-32). */
export function renderReportText(r: ClinicalReport): string {
  const L: string[] = [];
  L.push('CLINNOTE CLINICAL ENCOUNTER REPORT');
  if (r.demo) L.push(DEMO_LABEL);
  L.push(r.review.draftStatus, r.timeZoneNote, '');
  const sec = (t: string, body: string[]) => L.push(t, ...body, '');
  sec('A. PATIENT INFORMATION', r.patient.map((p) => `  ${p.label}: ${p.value} [${p.source}; ${p.status}]`));
  sec('B. VISIT INFORMATION', [...r.visit.rows.map((x) => `  ${x.label}: ${x.value}`), ...r.visit.segments.map((s) => `  ${s.code}: ${formatDateTime(s.startedAt)}${s.endedAt ? ` – ${formatDateTime(s.endedAt)}` : ''} · ${s.duration} · ${s.language} · ${s.utterances} utterance(s) · ${s.status}`)]);
  sec('C. CHIEF COMPLAINT', r.chiefComplaint ? rowsText([r.chiefComplaint]) : ['  Not documented']);
  sec('D. HISTORY OF PRESENT ILLNESS', [...rowsText(r.presentIllness), ...(r.negativeFindings.length ? ['  Explicitly denied:', ...rowsText(r.negativeFindings)] : [])]);
  sec('E. RELEVANT MEDICAL HISTORY', [
    '  Confirmed:', ...rowsText(r.history.confirmed), '  Patient-reported:', ...rowsText(r.history.patientReported), '  Clinician-stated:', ...rowsText(r.history.clinicianStated), '  Uncertain:', ...rowsText(r.history.uncertain),
  ]);
  const meds = (t: string, rows: MedicationRow[]) => [`  ${t}:`, ...(rows.length ? rows.map((m) => `  - ${m.medication} | dose ${m.dose} | ${m.frequency} | route ${m.route} | ${m.takingStatus} | ${m.source} | ${m.status}${m.flags.length ? ` — ${m.flags.join('; ')}` : ''}`) : ['  None documented'])];
  sec('F. MEDICATION HISTORY', [
    ...meds('Current', r.medications.current), ...meds('Previous', r.medications.previous), ...meds('Reported stopped', r.medications.reportedStopped),
    '  Proposed change (clinician wording):', ...rowsText(r.medications.proposedChange), ...meds('Uncertain', r.medications.uncertain), ...meds('On record, not discussed this visit', r.medications.fromRecordNotDiscussed),
  ]);
  sec('G. ALLERGIES', [`  Status: ${r.allergies.statusLine}`, ...(r.allergies.rows.length ? rowsText(r.allergies.rows) : [])]);
  sec('H. VITAL SIGNS', r.vitals.length ? r.vitals.map((x) => `  - ${x.measurement}: ${x.value} ${x.unit === 'not stated' ? '(unit not stated)' : x.unit} [${x.source}; ${x.status}]`) : ['  None documented']);
  sec('I. EXAMINATION FINDINGS', ['  Documented findings:', ...rowsText(r.examination.positive), '  Documented normal / negative:', ...rowsText(r.examination.negative)]);
  const invs = (t: string, rows: InvestigationRow[]) => [`  ${t}:`, ...(rows.length ? rows.map((i) => `  - ${i.test} | result ${i.result} | ${i.date} | ${i.investigationStatus} | ${i.source}`) : ['  None documented'])];
  sec('J. INVESTIGATIONS', [...invs('Completed', r.investigations.completed), ...invs('Pending', r.investigations.pending), ...invs('Planned', r.investigations.planned), ...invs('Status unknown', r.investigations.unknown)]);
  sec('K. CONSOLIDATED CLINICAL FACTS', r.consolidatedFacts.length ? r.consolidatedFacts.map((f) => `  - ${f.value} (${f.state}; ${f.sources.join(' + ')}; ${f.status}${f.mentions > 1 ? `; mentioned ${f.mentions}×` : ''}${f.conflict ? '; conflict' : ''})`) : ['  None']);
  sec('INFORMATION CHANGED DURING CONSULTATION', r.informationChanges.length ? r.informationChanges.flatMap((c) => [`  - ${c.topic} (${c.type}, ${c.status}): ${c.summary}`, ...c.chronology.map((x, i) => `      ${i + 1}. "${x.value}" — ${x.state} — ${x.source}${x.where ? ` — ${x.where}` : ''}`)]) : ['  None detected']);
  sec('L. CLINICAL TOPICS / POSSIBILITIES TO REVIEW', ['  Not included in exports (R2 feature; CS-32).']);
  sec('M. MEDICATION EVIDENCE (U.S. regulatory label information — not a dosing recommendation)', [
    `  ${r.medicationOptions.message}`,
    ...r.medicationOptions.gaps.map((g) => `  Information gap: ${g}`),
    ...r.medicationEvidence.flatMap((m) => [`  ${m.medication}${m.rxcui ? ` (RxCUI ${m.rxcui})` : ''}:`, ...(m.records.length ? m.records.map((x) => `    - ${x.provider}: ${x.title} · ${x.identifier} · retrieved ${formatDateTime(x.retrievedAt)} · ${x.url}`) : ['    No verified label records retrieved'])]),
  ]);
  sec('N. ASSESSMENT (clinician)', rowsText(r.assessment, 'No assessment stated by the clinician'));
  sec('O. PLAN (clinician)', rowsText(r.plan, 'No plan stated'));
  sec('P. FOLLOW-UP', r.followUp.length ? r.followUp.map((f) => `  - ${f.value} · due ${f.due} [${f.source}; ${f.status}]`) : ['  No follow-up stated']);
  sec('Q. LONGITUDINAL COMPARISON', r.longitudinal.previous ? [`  Compared with ${r.longitudinal.previous.visitCode} (${r.longitudinal.previous.date}):`, ...(r.longitudinal.items.length ? r.longitudinal.items.map((x) => `  - ${x.text}${x.provisional ? ' (provisional)' : ''}`) : ['  No differences in documented facts'])] : ['  No previous visit on record']);
  sec('R. EVIDENCE SOURCES', r.evidenceSources.length ? r.evidenceSources.map((e) => `  - ${e.source} | ${e.title} | ${e.identifier} | published ${e.publishedAt} | retrieved ${e.retrievedAt} | ${e.url}`) : ['  NO VERIFIED EVIDENCE FOUND (or no search run)']);
  sec('UNCERTAIN VALUES', rowsText(r.uncertainties, 'None'));
  sec('S. REVIEW AND CONFIRMATION', [
    `  ${r.review.draftStatus}`,
    `  Facts confirmed by clinician: ${r.review.confirmedFacts} · provisional: ${r.review.provisionalFacts} · clinician-edited: ${r.review.clinicianEditedFacts}`,
    `  Unresolved conflicts: ${r.review.unresolvedConflicts} · uncertain values: ${r.review.uncertainValues}`,
    `  Consultation: ${r.review.consultationState}${r.review.consultationFinalizedAt ? ` (${formatDateTime(r.review.consultationFinalizedAt)})` : ''} · note: ${r.review.noteState}${r.review.noteFinalizedAt ? ` (${formatDateTime(r.review.noteFinalizedAt)})` : ''}`,
  ]);
  sec('COMPLETENESS', r.completeness.map((c) => `  ${c.domain}: ${c.status.replace(/_/g, ' ')} — ${c.detail}`));
  return L.join('\n');
}
