/**
 * Export rendering (PRODUCT_SPEC Feature 26, UI-UX §4). Pure functions; the platform layer writes and shares the
 * file. Draft exports carry "DRAFT — not finalized by clinician" on every page (FR-26.5); conflicts render as
 * conflicts (the note already contains them); possibilities never enter exports (CS-32); no evidence excerpts or
 * AI text is added here. Every export writes an AuditEvent (FR-26.3).
 */
import { audit } from './facts';
import { renderFact } from './note';
import type { NoteVersion, Patient, Visit } from './types';
import { activeProblems, allergyStatus, currentMedications, pendingFollowUps } from './views';
import { formatDate, formatDateTime } from './util';

export const DRAFT_EXPORT_LABEL = 'DRAFT — not finalized by clinician';
export const DEMO_LABEL = 'DEMO DATA — NOT A REAL PATIENT';

export function latestNote(v: Visit): NoteVersion | undefined {
  return v.noteVersions[v.noteVersions.length - 1];
}

export function isFinalNote(v: Visit): boolean {
  return latestNote(v)?.source === 'CLINICIAN_FINALIZED';
}

export interface ExportDoc {
  fileBase: string;
  text: string;
  html: string;
  isDraft: boolean;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function html(title: string, body: string, isDraft: boolean, isDemo: boolean): string {
  const banner = [isDraft ? DRAFT_EXPORT_LABEL : null, isDemo ? DEMO_LABEL : null].filter(Boolean).join(' · ');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
@page { margin: 22mm 16mm 18mm 16mm; }
body { font-family: sans-serif; font-size: 11pt; color: #111; }
.mark { position: fixed; top: -14mm; left: 0; right: 0; text-align: center; font-weight: 700; color: #8a1c1c; font-size: 10pt; }
pre { white-space: pre-wrap; font-family: sans-serif; font-size: 11pt; line-height: 1.45; }
footer { position: fixed; bottom: -12mm; left: 0; right: 0; font-size: 8pt; color: #555; text-align: center; }
</style></head><body>${banner ? `<div class="mark">${esc(banner)}</div>` : ''}<pre>${esc(body)}</pre>
<footer>Exported from ClinNote ${esc(formatDateTime(new Date().toISOString()))}. Documentation aid; not a diagnosis or prescription.</footer></body></html>`;
}

/** Note export (latest version). Mutates the visit's audit log; the caller saves the visit. */
export function exportNote(patient: Patient, v: Visit): ExportDoc {
  const note = latestNote(v);
  if (!note) throw new Error('There is no note to export yet. Generate or write a note first.');
  const isDraft = note.source !== 'CLINICIAN_FINALIZED';
  const header = [isDraft ? DRAFT_EXPORT_LABEL : null, v.isDemo ? DEMO_LABEL : null].filter(Boolean) as string[];
  const text = [...header, ...(header.length ? [''] : []), note.content, '', `Note version ${note.versionNumber} · ${formatDateTime(note.createdAt)}`].join('\n');
  audit(v, 'NOTE', note.versionId, 'EXPORTED', 'CLINICIAN', isDraft ? 'draft' : 'finalized');
  return { fileBase: `${patient.patientReference}_${v.visitCode}_note${isDraft ? '_DRAFT' : ''}`, text, html: html(`${patient.patientReference} ${v.visitCode}`, text, isDraft, v.isDemo), isDraft };
}

/** Patient record summary built from the derived views only (clinician-confirmed lists + labeled status lines). */
export function exportPatientSummary(patient: Patient, visits: Visit[]): ExportDoc {
  const lines: string[] = [];
  if (patient.isDemo) lines.push(DEMO_LABEL, '');
  lines.push(`Patient summary · ${patient.patientReference}`);
  lines.push(`${patient.age !== undefined ? `Age ${patient.age}` : 'Age not recorded'} · ${patient.sex ? patient.sex.toLowerCase() : 'sex not recorded'}`);
  lines.push(`Generated ${formatDateTime(new Date().toISOString())} from records on this device. Possibilities and AI suggestions are not included.`);
  lines.push('');
  const problems = activeProblems(patient);
  lines.push('ACTIVE PROBLEMS (clinician-curated)');
  lines.push(...(problems.length ? problems.map((p) => `- ${p.label}`) : ['- None recorded']));
  lines.push('');
  lines.push('CURRENT MEDICATIONS (confirmed records)');
  const meds = currentMedications(visits);
  lines.push(...(meds.length ? meds.map((m) => `- ${renderFact(m.fact)}${m.notDiscussedSince ? ` — not discussed since ${formatDate(m.notDiscussedSince)}` : ''}${m.conflict ? ' — Conflict — review' : ''}`) : ['- None confirmed']));
  lines.push('');
  const al = allergyStatus(visits);
  lines.push('ALLERGIES');
  lines.push(...al.positives.map((p) => `- ${p.fact.attributes.substance ?? p.fact.value}${p.fact.attributes.reaction ? ` (${p.fact.attributes.reaction})` : ''}${p.contextUnclear ? ' — needs clarification (context)' : ''}${p.conflict ? ' — Conflict — review' : ''}`));
  lines.push(`- ${al.statusLine}`);
  lines.push('');
  lines.push('PENDING FOLLOW-UP');
  const fu = pendingFollowUps(visits);
  lines.push(...(fu.length ? fu.map((x) => `- ${renderFact(x.fact)} (visit ${x.visit.visitCode}, ${formatDate(x.visit.startedAt)})`) : ['- None']));
  lines.push('');
  lines.push('VISITS');
  for (const v of [...visits].sort((a, b) => b.startedAt.localeCompare(a.startedAt))) {
    lines.push(`- ${v.visitCode} · ${formatDate(v.startedAt)} · note ${v.noteState.toLowerCase()}${v.conflicts.some((c) => c.status === 'OPEN') ? ' · open conflicts' : ''}`);
  }
  const text = lines.join('\n');
  const isDraft = visits.some((v) => !isFinalNote(v));
  return { fileBase: `${patient.patientReference}_summary`, text, html: html(`${patient.patientReference} summary`, text, false, patient.isDemo), isDraft };
}
