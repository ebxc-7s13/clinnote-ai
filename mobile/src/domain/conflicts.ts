/**
 * Deterministic contradiction detector (DATA_MODEL §9, ADR-022). Both observations are kept; a FactConflict is
 * opened; nothing is overwritten. Compares facts eligible for automatic input only (§3.3a).
 */
import { isEligible } from './facts';
import type { ClinicalFact, FactConflict, Visit } from './types';
import { cmp, durationDays } from './text';
import { newId, nowIso } from './util';

const WITHIN_VISIT = new Set(['SYMPTOM', 'HISTORY_MEDICAL', 'HISTORY_SURGICAL', 'HISTORY_FAMILY', 'HISTORY_SOCIAL', 'MEDICATION', 'ALLERGY', 'ASSESSMENT']);
// Symptoms legitimately change between visits (that is a change, not a contradiction).
const CROSS_VISIT = new Set(['HISTORY_MEDICAL', 'HISTORY_SURGICAL', 'HISTORY_FAMILY', 'MEDICATION', 'ALLERGY']);

function key(f: ClinicalFact): string {
  return f.conceptKey === 'UNMAPPED' ? `#${cmp(f.normalizedValue ?? f.value)}` : f.conceptKey;
}

function valueMismatch(a: ClinicalFact, b: ClinicalFact): boolean {
  if (a.category === 'MEDICATION') {
    const da = a.attributes.dose?.replace(/\s/g, '');
    const db = b.attributes.dose?.replace(/\s/g, '');
    if (da && db && da !== db) return true;
    const fa = a.attributes.frequency?.toLowerCase();
    const fb = b.attributes.frequency?.toLowerCase();
    return !!(fa && fb && fa !== fb);
  }
  if (a.category === 'SYMPTOM') {
    const x = a.attributes.duration ? durationDays(a.attributes.duration) : null;
    const y = b.attributes.duration ? durationDays(b.attributes.duration) : null;
    return x !== null && y !== null && x !== y;
  }
  return false;
}

function disagree(a: ClinicalFact, b: ClinicalFact): FactConflict['conflictType'] | null {
  const blanket = (f: ClinicalFact) => f.conceptKey === 'ANY';
  if (blanket(a) !== blanket(b)) {
    const bl = blanket(a) ? a : b;
    const sp = blanket(a) ? b : a;
    return bl.informationState === 'NEGATIVE' && sp.informationState === 'POSITIVE' ? 'BLANKET_VS_SPECIFIC' : null;
  }
  const states = new Set([a.informationState, b.informationState]);
  const stateConflict = states.has('POSITIVE') && states.has('NEGATIVE');
  if (stateConflict) return a.sourceSpeakerRole && b.sourceSpeakerRole && a.sourceSpeakerRole !== b.sourceSpeakerRole ? 'SPEAKER_DISAGREEMENT' : 'SELF_CORRECTION';
  if (a.informationState === 'POSITIVE' && b.informationState === 'POSITIVE' && valueMismatch(a, b)) {
    return a.category === 'SYMPTOM' ? 'SELF_CORRECTION' : 'VALUE_MISMATCH';
  }
  return null;
}

/**
 * Runs over the current visit's eligible facts against each other and against eligible facts of earlier visits.
 * Opens conflicts on the current visit only; earlier visits are never modified (§9 rule 7).
 */
export function detectConflicts(current: Visit, earlier: Visit[]): FactConflict[] {
  const created: FactConflict[] = [];
  const cur = current.facts.filter(isEligible);
  const prev = earlier.filter((v) => v.visitId !== current.visitId).flatMap((v) => v.facts.filter(isEligible));
  const existingPairs = new Set(
    current.conflicts.flatMap((c) => {
      const ids = [...c.factIds].sort();
      return [ids.join('|')];
    }),
  );
  const open = (a: ClinicalFact, b: ClinicalFact, type: FactConflict['conflictType']) => {
    const pair = [a.factId, b.factId].sort().join('|');
    if (existingPairs.has(pair)) return; // resolved/dismissed pairs are not reopened without a new version
    existingPairs.add(pair);
    const later = a.createdAt >= b.createdAt ? a : b;
    const c: FactConflict = {
      conflictId: newId(),
      patientId: current.patientId,
      visitId: current.visitId,
      factIds: [a.factId, b.factId],
      conflictType: type,
      detectedBy: 'DETERMINISTIC_RULE',
      status: 'OPEN',
      proposedCurrentFactId: type === 'CROSS_VISIT' ? undefined : later.factId,
      detectedAt: nowIso(),
    };
    created.push(c);
    for (const f of [a, b]) {
      if (f.visitId !== current.visitId) continue;
      f.conflictIds.push(c.conflictId);
      if (!f.needsClarification) {
        f.needsClarification = true;
        f.clarificationReason = 'CONFLICT';
      }
    }
  };
  const sameChain = (a: ClinicalFact, b: ClinicalFact) => a.supersedesFactId === b.factId || b.supersedesFactId === a.factId;

  for (let i = 0; i < cur.length; i++) {
    for (let j = i + 1; j < cur.length; j++) {
      const a = cur[i];
      const b = cur[j];
      if (a.category !== b.category || !WITHIN_VISIT.has(a.category) || sameChain(a, b)) continue;
      if (key(a) !== key(b) && a.conceptKey !== 'ANY' && b.conceptKey !== 'ANY') continue;
      const t = disagree(a, b);
      if (t) open(a, b, t);
    }
    for (const b of prev) {
      const a = cur[i];
      if (a.category !== b.category || !CROSS_VISIT.has(a.category)) continue;
      if (key(a) !== key(b) && a.conceptKey !== 'ANY' && b.conceptKey !== 'ANY') continue;
      const t = disagree(a, b);
      if (t) open(a, b, t === 'BLANKET_VS_SPECIFIC' ? t : 'CROSS_VISIT');
    }
  }
  current.conflicts.push(...created);
  return created;
}
