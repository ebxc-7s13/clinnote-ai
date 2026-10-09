/**
 * Deterministic contradiction detector (DATA_MODEL §9, ADR-022). Both observations are kept; a FactConflict is
 * opened; nothing is overwritten. Compares facts eligible for automatic input only (§3.3a).
 */
import { isEligible } from './facts';
import type { ClinicalFact, FactConflict, Patient, Visit } from './types';
import { languageName } from './languages';
import { cmp, durationDays } from './text';
import { newId, nowIso } from './util';

const WITHIN_VISIT = new Set(['SYMPTOM', 'HISTORY_MEDICAL', 'HISTORY_SURGICAL', 'HISTORY_FAMILY', 'HISTORY_SOCIAL', 'MEDICATION', 'ALLERGY', 'ASSESSMENT', 'DEMOGRAPHIC']);

/** Explicit self-correction wording. Only with such a cue may a later statement be proposed as the corrected one. */
export const CORRECTION_CUE = /\b(actually|sorry|i mean|i meant|correction|let me correct|no wait|not \w+ (?:days?|weeks?|months?|years?)|to correct|i was wrong|rather)\b/i;

const NOT_CURRENT = new Set(['PREVIOUS', 'DISCONTINUED']);
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
    if (fa && fb && fa !== fb) return true;
    // "I take metformin" and later "I stopped metformin": a reported status change needs review (ADR-050)
    const ta = a.attributes.takingStatus;
    const tb = b.attributes.takingStatus;
    return !!(ta && tb && ((ta === 'CURRENT' && NOT_CURRENT.has(tb)) || (tb === 'CURRENT' && NOT_CURRENT.has(ta))));
  }
  if (a.category === 'DEMOGRAPHIC') {
    if (a.attributes.demographicKind === 'AGE') return a.attributes.numericValue !== undefined && b.attributes.numericValue !== undefined && a.attributes.numericValue !== b.attributes.numericValue;
    const x = a.attributes.demographicValue && cmp(a.attributes.demographicValue);
    const y = b.attributes.demographicValue && cmp(b.attributes.demographicValue);
    return !!(x && y && x !== y && a.attributes.demographicQualifier === b.attributes.demographicQualifier);
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
    // the later statement in the conversation (clock time), not the later-created record
    const later = (a.sourceStartTime ?? 0) === (b.sourceStartTime ?? 0) ? (a.createdAt >= b.createdAt ? a : b) : (a.sourceStartTime ?? 0) > (b.sourceStartTime ?? 0) ? a : b;
    const laterText = current.segments.filter((x) => later.sourceSegmentIds.includes(x.segmentId)).map((x) => x.text).join(' ');
    const c: FactConflict = {
      conflictId: newId(),
      patientId: current.patientId,
      visitId: current.visitId,
      factIds: [a.factId, b.factId],
      conflictType: type,
      detectedBy: 'DETERMINISTIC_RULE',
      status: 'OPEN',
      proposedCurrentFactId: type === 'CROSS_VISIT' ? undefined : later.factId,
      explicitCorrection: type !== 'CROSS_VISIT' && later.visitId === current.visitId && CORRECTION_CUE.test(laterText) ? true : undefined,
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

const PROFILE_FIELD: Partial<Record<NonNullable<ClinicalFact['attributes']['demographicKind']>, NonNullable<FactConflict['profileField']>>> = {
  AGE: 'age',
  NAME: 'name',
  OCCUPATION: 'occupation',
  LANGUAGE: 'preferredLanguage',
};

/** Value of the manual patient profile for a field, as display text (undefined when not recorded). */
export function profileValue(p: Patient, field: NonNullable<FactConflict['profileField']>): string | undefined {
  const v = p[field];
  return v === undefined || v === null || v === '' ? undefined : String(v);
}

function sameDetail(field: NonNullable<FactConflict['profileField']>, profile: string, f: ClinicalFact): boolean {
  if (field === 'age') return Number(profile) === f.attributes.numericValue;
  const said = cmp(f.attributes.demographicValue ?? f.value).split(' ');
  const rec = cmp(profile).split(' ');
  if (field === 'preferredLanguage') {
    const name = languageName(profile).toLowerCase();
    return said.includes(name) || rec.some((t) => said.includes(t));
  }
  // the stated words all appear in the recorded value, or the other way round ("Demo Patient" vs "Demo Patient (synthetic)")
  return said.every((t) => rec.includes(t)) || rec.every((t) => said.includes(t));
}

/**
 * Patient-profile reconciliation (ADR-050): a stated detail that differs from the manually entered profile opens a
 * PROFILE_MISMATCH conflict. The profile is never overwritten by code; the clinician decides which value is kept.
 */
export function reconcileProfile(v: Visit, patient: Patient): FactConflict[] {
  const created: FactConflict[] = [];
  const existing = new Set(v.conflicts.filter((c) => c.conflictType === 'PROFILE_MISMATCH').map((c) => `${c.profileField}|${c.factIds[0]}|${c.profileValue}`));
  for (const f of v.facts.filter((x) => isEligible(x) && x.category === 'DEMOGRAPHIC' && x.informationState === 'POSITIVE' && x.attributes.demographicQualifier !== 'PREVIOUS')) {
    const field = f.attributes.demographicKind ? PROFILE_FIELD[f.attributes.demographicKind] : undefined;
    if (!field) continue;
    const recorded = profileValue(patient, field);
    if (recorded === undefined || sameDetail(field, recorded, f)) continue;
    const key = `${field}|${f.factId}|${recorded}`;
    if (existing.has(key)) continue;
    existing.add(key);
    const c: FactConflict = {
      conflictId: newId(),
      patientId: v.patientId,
      visitId: v.visitId,
      factIds: [f.factId],
      conflictType: 'PROFILE_MISMATCH',
      detectedBy: 'DETERMINISTIC_RULE',
      status: 'OPEN',
      profileField: field,
      profileValue: recorded,
      detectedAt: nowIso(),
    };
    f.conflictIds.push(c.conflictId);
    created.push(c);
  }
  v.conflicts.push(...created);
  return created;
}
