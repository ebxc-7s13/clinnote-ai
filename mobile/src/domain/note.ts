/**
 * Note drafts rendered entirely by code from facts (ADR-043 d5, ADR-045, ADR-046 d6). No model text reaches the
 * note. NOT_DISCUSSED is decided by code; flagged items get placeholders; conflicts render as conflicts;
 * possibilities (candidates) are never included (CS-32). Finalizing confirms no fact (CS-25).
 */
import { compareVisits, VITAL_LABEL, vitalText } from './diff';
import { isCurrent, isEligible, isFlaggedIneligible } from './facts';
import type { ClinicalFact, FactCategory, NoteType, NoteVersion, Patient, Visit } from './types';
import { allergyStatus, unreviewedCount } from './views';
import { formatDate, newId, nowIso } from './util';

const PROV_LABEL: Record<string, string> = {
  PATIENT_REPORTED: 'patient-reported',
  CLINICIAN_STATED: 'clinician-stated',
  MEASURED: 'measured',
  TRANSCRIPTION: 'transcript, speaker unknown',
  AI_EXTRACTED: 'AI inference — verify',
  EXTERNAL_SOURCE: 'source',
  CLINICIAN_CONFIRMED: 'confirmed by clinician',
  UNKNOWN: 'source unknown',
};

const CATEGORY_LABEL: Record<FactCategory, string> = {
  SYMPTOM: 'Symptom',
  HISTORY_MEDICAL: 'Medical history',
  HISTORY_SURGICAL: 'Surgical history',
  HISTORY_FAMILY: 'Family history',
  HISTORY_SOCIAL: 'Social history',
  MEDICATION: 'Medication',
  ALLERGY: 'Allergy',
  VITAL_SIGN: 'Vital sign',
  EXAMINATION_FINDING: 'Examination',
  INVESTIGATION: 'Investigation',
  ASSESSMENT: 'Assessment',
  PLAN: 'Plan',
  FOLLOW_UP: 'Follow-up',
  OTHER: 'Other',
};
export const categoryLabel = (c: FactCategory) => CATEGORY_LABEL[c];
export const provenanceLabel = (f: ClinicalFact) =>
  f.provenance === 'CLINICIAN_CONFIRMED' && f.rootOriginProvenance !== 'CLINICIAN_CONFIRMED'
    ? `confirmed by clinician · originally ${PROV_LABEL[f.rootOriginProvenance]}`
    : PROV_LABEL[f.provenance];

function tag(f: ClinicalFact): string {
  const review = f.status === 'PROVISIONAL' ? ', not yet reviewed' : '';
  return ` (${provenanceLabel(f)}${review})`;
}

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

function attrSuffix(f: ClinicalFact): string {
  const a = f.attributes;
  const parts = [a.duration, a.timing, a.severity, a.progression].filter((x): x is string => !!x && !f.value.toLowerCase().includes(x.toLowerCase()));
  return parts.length ? `, ${parts.join(', ')}` : '';
}

/** Fixed per-category templates. Only fact values and code strings are used. */
export function renderFact(f: ClinicalFact): string {
  const v = f.value;
  switch (f.category) {
    case 'VITAL_SIGN':
      return `${VITAL_LABEL[f.attributes.vitalKind ?? ''] ?? 'Vital sign'} ${vitalText(f)}${tag(f)}`;
    case 'MEDICATION': {
      const a = f.attributes;
      if (f.conceptKey === 'ANY') return `${f.informationState === 'NEGATIVE' ? 'No current medications stated' : cap(v)}${tag(f)}`;
      const status = a.takingStatus ? ` — ${a.takingStatus.toLowerCase()}` : '';
      const desc = [a.rawName ?? v, a.dose, a.frequency, a.route].filter(Boolean).join(' ');
      if (f.informationState === 'UNKNOWN') return `${cap(desc)} — uncertain, needs clarification${tag(f)}`;
      return `${cap(f.informationState === 'NEGATIVE' ? `not taking ${desc}` : desc)}${status}${tag(f)}`;
    }
    case 'INVESTIGATION': {
      const a = f.attributes;
      const st = a.investigationStatus && a.investigationStatus !== 'UNKNOWN' ? ` — ${a.investigationStatus.toLowerCase().replace(/_/g, ' ')}` : '';
      return `${cap(a.testName ?? v)}${a.result ? ` ${a.result}` : ''}${st}${tag(f)}`;
    }
    case 'FOLLOW_UP':
      return `${cap(v)}${tag(f)}`;
    default:
      if (f.informationState === 'NEGATIVE') return `No ${v.replace(/^no\s+/i, '')}${tag(f)}`;
      if (f.informationState === 'UNKNOWN') return `${cap(v)}${attrSuffix(f)} — uncertain${tag(f)}`;
      if (f.informationState === 'NOT_DISCUSSED') return `${cap(v)}${tag(f)}`;
      return `${cap(v)}${attrSuffix(f)}${tag(f)}`;
  }
}

function conflictLines(v: Visit, allVisits: Visit[]): string[] {
  const facts = allVisits.flatMap((x) => x.facts);
  return v.conflicts
    .filter((c) => c.status === 'OPEN')
    .map((c) => {
      const fs = c.factIds.map((id) => facts.find((f) => f.factId === id)).filter((f): f is ClinicalFact => !!f);
      return `Conflict — review: ${fs.map((f) => `"${f.value}" (${f.informationState.toLowerCase()}, ${provenanceLabel(f)}${f.visitId !== v.visitId ? `, earlier visit` : ''})`).join(' vs ')}. Clinician to verify.`;
    });
}

function topicStatus(v: Visit, cats: FactCategory[], topic: string): string | null {
  const facts = v.facts.filter((f) => cats.includes(f.category));
  // NOT_DISCUSSED is decided by code (ADR-045 d1): any fact (incl. rejected/flagged) or discard means "discussed".
  const anyFact = facts.some((f) => f.informationState !== 'NOT_DISCUSSED');
  const discarded = v.discarded.some((d) => cats.includes(d.category));
  const explicitNotDiscussed = facts.find((f) => isEligible(f) && f.informationState === 'NOT_DISCUSSED');
  if (anyFact || discarded) {
    if (!facts.some((f) => isEligible(f) && f.informationState !== 'NOT_DISCUSSED')) return `${topic}: see transcript — needs review`;
    return null;
  }
  if (explicitNotDiscussed) return `${topic}: not discussed${tag(explicitNotDiscussed)}`;
  return `${topic}: not discussed`;
}

export interface NoteContext {
  patient: Patient;
  visit: Visit;
  allVisits: Visit[];
}

export function renderNote(type: NoteType, { patient, visit, allVisits }: NoteContext): string {
  const el = visit.facts.filter(isEligible);
  const by = (...cats: FactCategory[]) => el.filter((f) => cats.includes(f.category));
  const lines: string[] = [];
  const title = type === 'SOAP' ? 'SOAP note' : type === 'PROGRESS' ? 'Progress note' : 'Clinical note';
  lines.push(`DRAFT — review before finalizing`);
  lines.push(`${title} · ${patient.patientReference}${patient.isDemo ? ' · DEMO DATA — NOT A REAL PATIENT' : ''}`);
  lines.push(`Visit ${visit.visitCode} · ${formatDate(visit.startedAt)}`);
  lines.push('Rendered from documented facts; every line shows its source. Nothing is confirmed by finalizing.');
  lines.push('');

  const section = (heading: string, body: string[]) => {
    if (!body.length) return;
    lines.push(heading.toUpperCase());
    for (const b of body) lines.push(`- ${b}`);
    lines.push('');
  };

  const sx = by('SYMPTOM');
  const cc = sx.find((f) => f.informationState === 'POSITIVE' && f.sourceSpeakerRole === 'PATIENT') ?? sx.find((f) => f.informationState === 'POSITIVE');
  const allergy = allergyStatus([{ ...visit }]);
  const allergyLines = [
    ...allergy.positives.map((p) => `Allergy: ${p.fact.attributes.substance ?? p.fact.value}${p.fact.attributes.reaction ? ` (${p.fact.attributes.reaction})` : ''}${p.contextUnclear ? ' — needs clarification (context)' : ''}${tag(p.fact)}`),
  ];
  const allergyTopic = topicStatus(visit, ['ALLERGY'], 'Allergies');
  if (allergyTopic) allergyLines.push(allergyTopic);
  else allergyLines.push(`Allergy status: ${allergy.statusLine}`);
  const medTopic = topicStatus(visit, ['MEDICATION'], 'Medications');
  const medLines = by('MEDICATION').map(renderFact).concat(medTopic ? [medTopic] : []);
  const examTopic = topicStatus(visit, ['EXAMINATION_FINDING'], 'Examination');
  const placeholders = visit.facts.filter(isFlaggedIneligible).map((f) => `${CATEGORY_LABEL[f.category]}: item needs review — see transcript`);
  const discards = visit.discarded.length ? [`${visit.discarded.length} extracted item(s) not accepted — check transcript`] : [];

  const subjective = [
    ...(cc ? [`Presenting complaint: ${renderFact(cc)}`] : []),
    ...sx.filter((f) => f !== cc).map(renderFact),
    ...by('HISTORY_MEDICAL', 'HISTORY_SURGICAL').map((f) => `History: ${renderFact(f)}`),
    ...by('HISTORY_FAMILY').map((f) => `Family history: ${renderFact(f)}`),
    ...by('HISTORY_SOCIAL').map((f) => `Social: ${renderFact(f)}`),
    ...medLines,
    ...allergyLines,
  ];
  const objective = [...by('VITAL_SIGN').map(renderFact), ...by('EXAMINATION_FINDING').map(renderFact), ...(examTopic ? [examTopic] : []), ...by('INVESTIGATION').map(renderFact)];
  const assessment = by('ASSESSMENT')
    .filter((f) => f.status === 'CONFIRMED' || f.provenance === 'CLINICIAN_STATED' || f.rootOriginProvenance === 'CLINICIAN_STATED')
    .map(renderFact);
  const plan = [...by('PLAN').map(renderFact), ...by('FOLLOW_UP').map((f) => `Follow-up: ${renderFact(f)}`)];
  const review = [...conflictLines(visit, allVisits), ...placeholders, ...discards];

  if (type === 'SOAP') {
    section('Subjective', subjective);
    section('Objective', objective);
    section('Assessment', assessment.length ? assessment : ['No assessment stated by the clinician']);
    section('Plan', plan.length ? plan : ['No plan stated']);
  } else {
    section('History and symptoms', subjective);
    section('Findings', objective);
    if (type === 'PROGRESS') {
      const prev = allVisits.filter((x) => x.startedAt < visit.startedAt).sort((a, b) => a.startedAt.localeCompare(b.startedAt)).pop();
      section('Since previous visit', prev ? compareVisits(prev, visit).filter((d) => d.kind !== 'UNCHANGED').map((d) => `${d.text}${d.provisional ? ' (provisional — not reviewed)' : ''}`) : ['No previous visit on record']);
    }
    section('Assessment (clinician)', assessment.length ? assessment : ['No assessment stated by the clinician']);
    section('Plan', plan.length ? plan : ['No plan stated']);
  }
  section('Needs review', review);
  lines.push(`Unreviewed items: ${unreviewedCount(visit)}`);
  return lines.join('\n');
}

export function addNoteVersion(v: Visit, type: NoteType, content: string, source: NoteVersion['source']): NoteVersion {
  const nv: NoteVersion = { versionId: newId(), versionNumber: v.noteVersions.length + 1, noteType: type, content, source, createdAt: nowIso() };
  v.noteVersions.push(nv);
  v.noteState = source === 'CLINICIAN_FINALIZED' ? 'FINALIZED' : source === 'CLINICIAN_EDIT' ? 'EDITED' : 'DRAFT';
  return nv;
}

/** Finalize ≠ confirm (CS-25): records the unreviewed count; no fact transition happens. */
export function finalizeNote(v: Visit, content: string): NoteVersion {
  const latest = v.noteVersions[v.noteVersions.length - 1];
  const finalText = content.replace(/^DRAFT — review before finalizing\n/, `FINALIZED BY CLINICIAN · ${formatDate(nowIso())}\n`);
  const nv = addNoteVersion(v, latest?.noteType ?? 'SOAP', finalText, 'CLINICIAN_FINALIZED');
  v.finalizedAt = nv.createdAt;
  v.unreviewedFactCountAtFinalize = unreviewedCount(v);
  return nv;
}

export const noteFactsCurrent = (v: Visit) => v.facts.filter(isCurrent);
