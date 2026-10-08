/**
 * Possibilities to review (job 12, R2 behind a default-off flag — ADR-025, ADR-034). Validation per AI.md §5.1
 * rules 10–11 and DATA_MODEL §4.14. Candidates never enter notes or exports (CS-32) and are never diagnoses.
 */
import { z } from 'zod';
import { isEligible } from './facts';
import type { ClinicalCandidate, Visit } from './types';
import { newId } from './util';

export const CandidateItem = z
          .object({
            topic: z.string().min(2).max(80),
            reason: z.string().min(2).max(300),
            supportingFactIds: z.array(z.string()).max(12),
            contradictingFactIds: z.array(z.string()).max(12),
            missingInformation: z.array(z.string().max(120)).max(8),
            evidenceIds: z.array(z.string()).max(10),
          })
          .strict();
export const CandidateOutput = z.object({ candidates: z.array(z.unknown()).max(5) }).strict();

const FORBIDDEN = /(\d+\s*%|percent|probability|definitely|confirmed|diagnosis is|final diagnosis|prescribe|start (?:on|taking)|\bdose\b|\bmg\b|pmid|doi:|nct\d|guideline says)/i;

export type CandidatePrecondition = { ok: true } | { ok: false; reason: string };

/** DATA_MODEL §5.2 candidate precondition (canonical gating wording). */
export function candidatePrecondition(v: Visit, flagOn: boolean): CandidatePrecondition {
  if (!flagOn) return { ok: false, reason: 'Possibilities are turned off (R2, default off).' };
  if (v.evidenceState !== 'COMPLETED' && v.evidenceState !== 'PARTIAL') return { ok: false, reason: 'Possibilities not generated: evidence retrieval did not complete.' };
  if (!v.evidence.some((e) => e.citable)) return { ok: false, reason: 'Possibilities not generated: no evidence retrieved.' };
  return { ok: true };
}

export function validateCandidates(raw: unknown, v: Visit, runId: string, aiJobVersion: string): { candidates: ClinicalCandidate[]; rejected: number } {
  const parsed = CandidateOutput.safeParse(raw);
  if (!parsed.success) return { candidates: [], rejected: 1 };
  const facts = new Map(v.facts.filter(isEligible).map((f) => [f.factId, f]));
  const openConflict = new Set(v.conflicts.filter((c) => c.status === 'OPEN').flatMap((c) => c.factIds));
  const citable = new Set(v.evidence.filter((e) => e.citable).map((e) => e.evidenceId));
  const out: ClinicalCandidate[] = [];
  let rejected = 0;
  for (const rawC of parsed.data.candidates) {
    const one = CandidateItem.safeParse(rawC);
    if (!one.success) {
      rejected++;
      continue;
    }
    const c = one.data;
    const all = [...c.supportingFactIds, ...c.contradictingFactIds];
    const ok =
      all.every((id) => facts.has(id)) && // rule 1: IDs exist and are eligible
      c.supportingFactIds.length > 0 &&
      c.supportingFactIds.every((id) => {
        const f = facts.get(id)!;
        return (f.informationState === 'POSITIVE' || f.informationState === 'UNKNOWN') && !openConflict.has(id);
      }) && // CS-33 B: NEGATIVE only as contradicting; open-conflict facts never supporting
      c.contradictingFactIds.every((id) => facts.get(id)!.informationState !== 'NOT_DISCUSSED') &&
      c.evidenceIds.length > 0 &&
      c.evidenceIds.every((id) => citable.has(id)) && // rule 10: citations ⊆ citable bundle (CS-16)
      ![c.topic, c.reason, ...c.missingInformation].some((t) => FORBIDDEN.test(t)); // no probabilities, doses, invented sources
    if (!ok) {
      rejected++;
      continue;
    }
    out.push({
      candidateId: newId(),
      generationRunId: runId,
      topic: c.topic,
      reason: c.reason,
      supportingFactIds: c.supportingFactIds,
      contradictingFactIds: c.contradictingFactIds,
      conflictFactIds: c.supportingFactIds.filter((id) => openConflict.has(id)),
      missingInformation: c.missingInformation,
      evidenceIds: c.evidenceIds,
      sourceFactVersionIds: all,
      evidenceStateAtGeneration: v.evidenceState === 'PARTIAL' ? 'PARTIAL' : 'COMPLETED',
      outdated: false,
      status: 'PROVISIONAL',
      aiJobVersion,
    });
  }
  // stable, meaningless order (ADR-034: "Order has no meaning")
  return { candidates: out.sort((a, b) => a.topic.localeCompare(b.topic)), rejected };
}

/** Marks candidates outdated when a source fact changed (ADR-038, CS-43). */
export function refreshCandidateStaleness(v: Visit): void {
  const byId = new Map(v.facts.map((f) => [f.factId, f]));
  const openConflict = new Set(v.conflicts.filter((c) => c.status === 'OPEN').flatMap((c) => c.factIds));
  for (const c of v.candidates) {
    if (c.outdated) continue;
    c.outdated = c.sourceFactVersionIds.some((id) => {
      const f = byId.get(id);
      return !f || !isEligible(f) || (openConflict.has(id) && !c.conflictFactIds.includes(id));
    });
  }
}
