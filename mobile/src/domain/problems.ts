/**
 * Clinician-curated problem list (DATA_MODEL §10.1). Only an explicit clinician action adds or changes an entry;
 * entries from a fact require that fact to be CONFIRMED. PROVISIONAL items never become active problems.
 */
import type { ClinicalFact, Patient, ProblemListEntry } from './types';
import { newId, nowIso } from './util';

export const PROBLEM_CATEGORIES = new Set(['ASSESSMENT', 'HISTORY_MEDICAL', 'HISTORY_SURGICAL']);

export function canAddToProblems(f: ClinicalFact, patient: Patient): boolean {
  return f.status === 'CONFIRMED' && f.informationState === 'POSITIVE' && PROBLEM_CATEGORIES.has(f.category) && !patient.problems.some((p) => p.originRecordId === f.factId || (p.problemStatus === 'ACTIVE' && p.label.toLowerCase() === f.value.toLowerCase()));
}

export function addProblemFromFact(patient: Patient, f: ClinicalFact): ProblemListEntry {
  if (f.status !== 'CONFIRMED') throw new Error('Confirm the item before adding it to the problem list.');
  const e: ProblemListEntry = {
    problemId: newId(),
    label: f.value,
    problemStatus: 'ACTIVE',
    originRecordType: f.category === 'ASSESSMENT' ? 'ASSESSMENT' : 'CLINICAL_FACT',
    originRecordId: f.factId,
    provenance: 'CLINICIAN_CONFIRMED',
    createdAt: nowIso(),
  };
  patient.problems.push(e);
  return e;
}

export function addManualProblem(patient: Patient, label: string): ProblemListEntry {
  const l = label.trim();
  if (!l) throw new Error('Enter the problem.');
  const e: ProblemListEntry = { problemId: newId(), label: l, problemStatus: 'ACTIVE', originRecordType: 'MANUAL', provenance: 'CLINICIAN_CONFIRMED', createdAt: nowIso() };
  patient.problems.push(e);
  return e;
}

export function setProblemStatus(patient: Patient, problemId: string, status: ProblemListEntry['problemStatus']) {
  const p = patient.problems.find((x) => x.problemId === problemId);
  if (p) p.problemStatus = status;
}
