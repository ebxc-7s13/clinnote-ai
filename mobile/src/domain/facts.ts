/**
 * Fact lifecycle (DATA_MODEL §3.2, §3.3a, §5.3). Only clinician actions confirm, reject or edit.
 */
import type { AuditEvent, ClinicalFact, FactCategory, Visit } from './types';
import { newId, nowIso } from './util';

export const isCurrent = (f: ClinicalFact) => !f.supersededByFactId && f.status !== 'REJECTED' && !f.resolvedAwayByConflictId;

/** §3.3a: current and not flagged SOURCE_CHANGED or CONTEXT_UNCLEAR. */
export const isEligible = (f: ClinicalFact) =>
  isCurrent(f) && !(f.needsClarification && (f.clarificationReason === 'SOURCE_CHANGED' || f.clarificationReason === 'CONTEXT_UNCLEAR'));

export const isFlaggedIneligible = (f: ClinicalFact) => isCurrent(f) && !isEligible(f);

export function audit(v: Visit, entityType: string, entityId: string, action: string, actor: AuditEvent['actor'] = 'CLINICIAN', detail?: string) {
  v.audit.push({ eventId: newId(), entityType, entityId, action, actor, createdAt: nowIso(), detail });
}

export class ReviewError extends Error {}

/** PROVISIONAL → CONFIRMED (clinician). CONTEXT_UNCLEAR requires an explicit category (ADR-045, §5.3). */
export function confirmFact(v: Visit, factId: string, opts?: { category?: FactCategory }): ClinicalFact {
  const f = v.facts.find((x) => x.factId === factId);
  if (!f) throw new ReviewError('Fact not found.');
  if (!isCurrent(f)) throw new ReviewError('Only the current version can be confirmed.');
  if (f.clarificationReason === 'CONTEXT_UNCLEAR' && f.needsClarification) {
    if (!opts?.category) throw new ReviewError('Choose the category (for example, file as family history) before confirming.');
    f.category = opts.category;
  }
  if (f.clarificationReason === 'CONFLICT' && f.conflictIds.some((id) => v.conflicts.find((c) => c.conflictId === id)?.status === 'OPEN')) {
    throw new ReviewError('Resolve the open conflict first.');
  }
  f.status = 'CONFIRMED';
  f.provenance = 'CLINICIAN_CONFIRMED';
  f.confirmedAt = nowIso();
  f.updatedAt = f.confirmedAt;
  if (f.needsClarification && f.clarificationReason !== 'CONFLICT') {
    f.needsClarification = false;
    f.clarificationReason = undefined;
  }
  audit(v, 'FACT', f.factId, 'CONFIRMED');
  return f;
}

export function rejectFact(v: Visit, factId: string): void {
  const f = v.facts.find((x) => x.factId === factId);
  if (!f) throw new ReviewError('Fact not found.');
  f.status = 'REJECTED';
  f.updatedAt = nowIso();
  audit(v, 'FACT', f.factId, 'REJECTED');
}

export function restoreFact(v: Visit, factId: string): void {
  const f = v.facts.find((x) => x.factId === factId);
  if (!f || f.status !== 'REJECTED') return;
  f.status = 'PROVISIONAL';
  f.updatedAt = nowIso();
  audit(v, 'FACT', f.factId, 'UPDATED', 'CLINICIAN', 'restored');
}

/** Clinician edit creates a new CONFIRMED version; the old version is kept (§3.2 rule 4). */
export function editFact(
  v: Visit,
  factId: string,
  changes: { value?: string; informationState?: ClinicalFact['informationState']; attributes?: ClinicalFact['attributes']; category?: FactCategory },
): ClinicalFact {
  const old = v.facts.find((x) => x.factId === factId);
  if (!old) throw new ReviewError('Fact not found.');
  if (!isCurrent(old)) throw new ReviewError('Only the current version can be edited.');
  const ts = nowIso();
  const next: ClinicalFact = {
    ...old,
    factId: newId(),
    category: changes.category ?? old.category,
    value: changes.value ?? old.value,
    normalizedValue: changes.value ? undefined : old.normalizedValue,
    informationState: changes.informationState ?? old.informationState,
    attributes: { ...old.attributes, ...(changes.attributes ?? {}) },
    originProvenance: 'CLINICIAN_CONFIRMED',
    rootOriginProvenance: old.rootOriginProvenance,
    provenance: 'CLINICIAN_CONFIRMED',
    status: 'CONFIRMED',
    derivationMethod: 'CLINICIAN_EDIT',
    supersedesFactId: old.factId,
    supersededByFactId: undefined,
    needsClarification: false,
    clarificationReason: undefined,
    conflictIds: [],
    extractor: 'MANUAL',
    confirmedAt: ts,
    createdAt: ts,
    updatedAt: ts,
  };
  old.supersededByFactId = next.factId;
  old.updatedAt = ts;
  v.facts.push(next);
  audit(v, 'FACT', old.factId, 'SUPERSEDED_BY_EDIT');
  return next;
}

/** Manual entry: CLINICIAN_CONFIRMED / CONFIRMED; measurement fields: MEASURED (§3.2 rule 3). */
export function addManualFact(
  v: Visit,
  input: { category: FactCategory; value: string; informationState: ClinicalFact['informationState']; attributes?: ClinicalFact['attributes']; measured?: boolean; conceptKey?: string },
): ClinicalFact {
  const ts = nowIso();
  const prov = input.measured && input.category === 'VITAL_SIGN' ? 'MEASURED' : 'CLINICIAN_CONFIRMED';
  const f: ClinicalFact = {
    factId: newId(),
    patientId: v.patientId,
    visitId: v.visitId,
    category: input.category,
    conceptKey: input.conceptKey ?? 'UNMAPPED',
    value: input.value.trim(),
    informationState: input.informationState,
    originProvenance: prov,
    rootOriginProvenance: prov,
    provenance: prov,
    status: 'CONFIRMED',
    derivationMethod: 'MANUAL_ENTRY',
    sourceSegmentIds: [],
    confidence: 'HIGH',
    needsClarification: false,
    conflictIds: [],
    attributes: input.attributes ?? {},
    extractor: 'MANUAL',
    confirmedAt: ts,
    createdAt: ts,
    updatedAt: ts,
  };
  v.facts.push(f);
  audit(v, 'FACT', f.factId, 'CREATED');
  return f;
}

/** Clinician resolves a conflict in favour of one fact; the others are kept as history (§9 rule 4). */
export function resolveConflict(v: Visit, conflictId: string, currentFactId: string | null, allVisits: Visit[]): void {
  const c = v.conflicts.find((x) => x.conflictId === conflictId);
  if (!c || c.status !== 'OPEN') return;
  const ts = nowIso();
  c.status = currentFactId ? 'RESOLVED_BY_CLINICIAN' : 'DISMISSED_BY_CLINICIAN';
  c.resolvedCurrentFactId = currentFactId ?? undefined;
  c.resolvedAt = ts;
  const factsAll = allVisits.flatMap((x) => (x.visitId === v.visitId ? v.facts : x.facts));
  for (const id of c.factIds) {
    const f = factsAll.find((x) => x.factId === id);
    if (!f) continue;
    // a cross-visit conflict never changes the earlier visit's records (§9 rule 7)
    if (f.visitId !== v.visitId) continue;
    if (currentFactId && id !== currentFactId) f.resolvedAwayByConflictId = conflictId;
    const stillOpen = f.conflictIds.some((cid) => cid !== conflictId && v.conflicts.find((x) => x.conflictId === cid)?.status === 'OPEN');
    if (f.clarificationReason === 'CONFLICT' && !stillOpen) {
      f.needsClarification = false;
      f.clarificationReason = undefined;
    }
    f.updatedAt = ts;
  }
  audit(v, 'CONFLICT', conflictId, 'CONFLICT_RESOLVED');
}

/** Clinician flags a fact as uncertain (needs clarification). Status and provenance are unchanged; confirming clears it. */
export function markFactUncertain(v: Visit, factId: string): void {
  const f = v.facts.find((x) => x.factId === factId);
  if (!f) throw new ReviewError('Fact not found.');
  if (!isCurrent(f)) throw new ReviewError('Only the current version can be marked.');
  f.needsClarification = true;
  if (!f.clarificationReason || f.clarificationReason === 'UNCERTAIN_SPEECH') f.clarificationReason = 'OTHER';
  // provenance and review status are untouched (ADR-015); the flag alone sends it back to review
  f.updatedAt = nowIso();
  audit(v, 'FACT', f.factId, 'MARKED_UNCERTAIN');
}
