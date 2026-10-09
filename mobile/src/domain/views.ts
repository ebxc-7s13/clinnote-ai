/**
 * Derived patient views (DATA_MODEL §10, authoritative). Absence never discontinues a medication; a positive
 * allergy is never hidden; PROVISIONAL items never become active problems.
 */
import { isCurrent, isEligible } from './facts';
import { durationDays } from './text';
import type { ClinicalFact, Patient, Visit } from './types';

export interface CurrentMedication {
  fact: ClinicalFact;
  visit: Visit;
  notDiscussedSince?: string;
  conflict: boolean;
}

function medIdentity(f: ClinicalFact): string {
  return (f.attributes.rxcui ?? f.attributes.normalizedName ?? (f.conceptKey !== 'UNMAPPED' ? f.conceptKey : f.attributes.rawName ?? f.value)).toLowerCase();
}

/** §10.2: most recent CONFIRMED record per medication; stays current until a CONFIRMED discontinuation. */
export function currentMedications(visits: Visit[]): CurrentMedication[] {
  const sorted = [...visits].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const latest = new Map<string, { fact: ClinicalFact; visit: Visit }>();
  const mentionedAt = new Map<string, string>();
  for (const v of sorted) {
    for (const f of v.facts.filter((x) => x.category === 'MEDICATION' && isEligible(x) && x.conceptKey !== 'ANY')) {
      mentionedAt.set(medIdentity(f), v.startedAt);
      if (f.status === 'CONFIRMED') latest.set(medIdentity(f), { fact: f, visit: v });
    }
  }
  const lastVisit = sorted[sorted.length - 1];
  const out: CurrentMedication[] = [];
  for (const [id, { fact, visit }] of latest) {
    // §10.2 point 2: included only when the latest CONFIRMED record says CURRENT
    if (fact.attributes.takingStatus !== 'CURRENT' || fact.informationState !== 'POSITIVE') continue;
    const lastMention = mentionedAt.get(id);
    out.push({
      fact,
      visit,
      notDiscussedSince: lastVisit && lastMention && lastMention < lastVisit.startedAt ? lastMention : undefined,
      conflict: fact.conflictIds.length > 0 || visits.some((v) => v.conflicts.some((c) => c.status === 'OPEN' && c.factIds.includes(fact.factId))),
    });
  }
  return out;
}

export interface AllergyStatus {
  positives: { fact: ClinicalFact; contextUnclear: boolean; conflict: boolean }[];
  statusLine: string;
  conflict: boolean;
}

/** §10.3 including the ADR-045 allergy safety exception. */
export function allergyStatus(visits: Visit[]): AllergyStatus {
  const all = visits.flatMap((v) => v.facts.filter((f) => f.category === 'ALLERGY'));
  const eligible = all.filter(isEligible);
  const flaggedPatientAllergies = all.filter(
    (f) => isCurrent(f) && f.needsClarification && f.clarificationReason === 'CONTEXT_UNCLEAR' && !/\b(my|his|her) (son|daughter|mother|father|wife|husband|brother|sister)\b/i.test(f.value),
  );
  const openConflictIds = new Set(visits.flatMap((v) => v.conflicts.filter((c) => c.status === 'OPEN').flatMap((c) => c.factIds)));
  const positives = eligible
    .filter((f) => f.informationState === 'POSITIVE' && f.conceptKey !== 'ANY')
    .map((f) => ({ fact: f, contextUnclear: false, conflict: openConflictIds.has(f.factId) }))
    .concat(flaggedPatientAllergies.map((f) => ({ fact: f, contextUnclear: true, conflict: openConflictIds.has(f.factId) })));
  const conflict = all.some((f) => openConflictIds.has(f.factId));
  const anyNeg = eligible.filter((f) => f.conceptKey === 'ANY' && f.informationState === 'NEGATIVE');
  const confirmedNeg = anyNeg.filter((f) => f.status === 'CONFIRMED').sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const provisionalNeg = anyNeg.find((f) => f.status === 'PROVISIONAL');
  const unknown = eligible.some((f) => f.informationState === 'UNKNOWN') || flaggedPatientAllergies.length > 0;
  const specificNeg = eligible.filter((f) => f.conceptKey !== 'ANY' && f.informationState === 'NEGATIVE');

  let statusLine: string;
  if (unknown) statusLine = 'Allergy status unclear — needs clarification';
  else if (positives.length > 0) {
    const lastPositive = positives.map((p) => p.fact.createdAt).sort().pop() as string;
    statusLine =
      confirmedNeg && confirmedNeg.createdAt > lastPositive && !conflict
        ? `No other known allergies (confirmed ${confirmedNeg.confirmedAt?.slice(0, 10) ?? ''})`
        : 'Other allergies: not established';
  } else if (confirmedNeg) statusLine = 'No known allergies';
  else if (provisionalNeg) statusLine = 'No allergies reported — needs review';
  else if (specificNeg.length) statusLine = `${specificNeg.map((f) => `No allergy to ${f.attributes.substance ?? f.value} reported`).join('; ')}. General allergy status not discussed`;
  else statusLine = 'Not discussed';
  return { positives, statusLine, conflict };
}

/** §10.1: clinician-curated problem list only. */
export function activeProblems(patient: Patient) {
  return patient.problems.filter((p) => p.problemStatus === 'ACTIVE');
}

/** §10.4: current PROVISIONAL items from all visits, grouped by visit. */
export function proposedForReview(visits: Visit[], currentVisitId?: string) {
  const cats = new Set(['MEDICATION', 'HISTORY_MEDICAL', 'HISTORY_SURGICAL', 'ASSESSMENT', 'ALLERGY']);
  const items = visits.flatMap((v) => v.facts.filter((f) => isCurrent(f) && f.status === 'PROVISIONAL' && cats.has(f.category)).map((f) => ({ fact: f, visit: v })));
  return {
    thisVisit: items.filter((i) => i.visit.visitId === currentVisitId),
    earlier: items.filter((i) => i.visit.visitId !== currentVisitId),
  };
}

export function pendingFollowUps(visits: Visit[]) {
  return visits.flatMap((v) => v.facts.filter((f) => f.category === 'FOLLOW_UP' && isEligible(f) && (f.attributes.followUpStatus ?? 'PENDING') === 'PENDING').map((f) => ({ fact: f, visit: v })));
}

export function unreviewedCount(v: Visit): number {
  return v.facts.filter((f) => isCurrent(f) && (f.status === 'PROVISIONAL' || (f.needsClarification && f.clarificationReason !== 'CONFLICT'))).length;
}

/**
 * Due date of a follow-up: the clinician-set dueDate, else the stated interval counted from the visit date
 * (code arithmetic on stated values, labelled approximate). Null when neither was stated — never guessed.
 */
export function followUpDue(f: ClinicalFact, v: Visit): { date: string; approximate: boolean } | null {
  if (f.attributes.dueDate) return { date: f.attributes.dueDate, approximate: false };
  const days = f.attributes.interval ? durationDays(f.attributes.interval) : null;
  if (days === null) return null;
  const d = new Date(new Date(v.startedAt).getTime() + days * 86400000);
  return { date: d.toISOString().slice(0, 10), approximate: true };
}
