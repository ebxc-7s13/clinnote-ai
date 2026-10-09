/**
 * Semantic validation and promotion of extraction items (AI.md §5.1; DATA_MODEL §8.3, §3.2).
 * Code — never the model — assigns provenance, review status, conceptKey and normalizedValue.
 * Rejected items are returned as visible discards (ADR-045 d2), never silently dropped.
 */
import { ExtractionItem, type ExtractorKind } from './item';
import type { ClinicalFact, DiscardedItem, Provenance, SpeakerRole, TranscriptSegment } from '../types';
import { CONDITIONS, INFERENTIAL_WORDING, MEDICATIONS, SYMPTOMS, SYNONYMS, canonicalConcept } from '../lexicon';
import { DEMOGRAPHIC_NEGATION } from './deterministic';
import { clauseContaining, clauseContext, cmp, isNegatedSpan, isSpan, numbersIn, phrasesIn, tokensGrounded } from '../text';
import { newId, nowIso } from '../util';

export type DiscardReason =
  | 'SCHEMA_INVALID'
  | 'UNKNOWN_SEGMENT'
  | 'NUMBER_NOT_IN_SOURCE'
  | 'NEGATION_MISMATCH'
  | 'NOT_GROUNDED'
  | 'INFERENTIAL_WORDING'
  | 'QUESTION_ONLY'
  | 'CUE_CLAUSE_OMITTED'
  | 'CONDITIONAL_FOLLOW_UP'
  | 'ASSESSMENT_OR_PLAN_NOT_CLINICIAN'
  | 'ROLES_NOT_CONFIRMED';

export const DISCARD_LABELS: Record<DiscardReason, string> = {
  SCHEMA_INVALID: 'Output did not match the required format',
  UNKNOWN_SEGMENT: 'Referenced a transcript segment that does not exist',
  NUMBER_NOT_IN_SOURCE: 'Contained a number not present in the transcript',
  NEGATION_MISMATCH: 'Negation did not match the transcript',
  NOT_GROUNDED: 'Wording not found in the transcript',
  INFERENTIAL_WORDING: 'Contained inferential or treatment wording not stated in the transcript',
  QUESTION_ONLY: 'Came only from a question, not an answer',
  CUE_CLAUSE_OMITTED: 'Dropped a conditional or other-person context',
  CONDITIONAL_FOLLOW_UP: 'Conditional advice is not a follow-up',
  ASSESSMENT_OR_PLAN_NOT_CLINICIAN: 'Assessments and plans must come from the clinician',
  ROLES_NOT_CONFIRMED: 'Speaker roles were not confirmed',
};

/** Rule 16: conceptKey from the fact's own value only. Exactly one table concept in the value, else UNMAPPED. */
export function computeConceptKey(category: ClinicalFact['category'], value: string, attrs: ExtractionItem['attributes']): { key: string; normalized?: string } {
  if ((category === 'ALLERGY' && attrs.substance === 'ANY') || (category === 'MEDICATION' && attrs.rawName === 'ANY')) return { key: 'ANY' };
  if (category === 'ALLERGY' && attrs.substance) return { key: attrs.substance.toLowerCase(), normalized: attrs.substance.toLowerCase() };
  if (category === 'VITAL_SIGN' && attrs.vitalKind) return { key: attrs.vitalKind.toLowerCase() };
  if (category === 'DEMOGRAPHIC') return { key: attrs.demographicKind ? `demographic:${attrs.demographicKind.toLowerCase()}` : 'UNMAPPED' };
  if (category === 'INVESTIGATION' && attrs.testName) {
    const c = canonicalConcept(attrs.testName) ?? attrs.testName.toLowerCase();
    return { key: c, normalized: c };
  }
  const direct = canonicalConcept(value);
  if (direct) return { key: direct, normalized: direct };
  const n = ` ${cmp(value)} `;
  const found = new Set<string>();
  const pool = category === 'MEDICATION' ? MEDICATIONS : Object.keys(SYNONYMS).concat(CONDITIONS, MEDICATIONS, SYMPTOMS);
  for (const p of pool) {
    if (n.includes(` ${cmp(p)} `)) found.add(canonicalConcept(p) ?? p);
  }
  // remove concepts that are sub-phrases of another found concept ("cancer" inside "lung cancer")
  const list = Array.from(found).filter((c) => !Array.from(found).some((o) => o !== c && o.includes(c)));
  if (list.length === 1) return { key: list[0], normalized: list[0] };
  return { key: 'UNMAPPED' };
}

/** DATA_MODEL §8.3 mapping. Only extraction derivations are handled here. */
export function provenanceFor(derivation: ExtractionItem['derivationMethod'], segRoles: SpeakerRole[]): Provenance {
  if (derivation === 'AI_INFERENCE' || segRoles.length > 1) return 'AI_EXTRACTED';
  const r = segRoles[0];
  if (r === 'PATIENT') return 'PATIENT_REPORTED';
  if (r === 'DOCTOR') return 'CLINICIAN_STATED';
  return 'TRANSCRIPTION';
}

export interface ValidationResult {
  facts: ClinicalFact[];
  discarded: DiscardedItem[];
}

export function validateAndPromote(
  rawItems: unknown[],
  segments: TranscriptSegment[],
  ctx: { patientId: string; visitId: string; extractor: ExtractorKind; aiJobVersion?: string; providerExecutionId?: string },
): ValidationResult {
  const facts: ClinicalFact[] = [];
  const discarded: DiscardedItem[] = [];
  const segById = new Map(segments.map((s) => [s.segmentId, s]));
  const discard = (category: ClinicalFact['category'] | undefined, segIds: string[], reason: DiscardReason) =>
    discarded.push({ itemId: newId(), category: category ?? 'OTHER', segmentIds: segIds, reasonCode: reason, createdAt: nowIso() });

  for (const raw of rawItems) {
    const parsed = ExtractionItem.safeParse(raw);
    const maybe = raw as { category?: ClinicalFact['category']; sourceSegmentIds?: string[] };
    if (!parsed.success) {
      discard(typeof maybe?.category === 'string' ? maybe.category : undefined, Array.isArray(maybe?.sourceSegmentIds) ? maybe.sourceSegmentIds : [], 'SCHEMA_INVALID');
      continue;
    }
    const item = { ...parsed.data, attributes: { ...parsed.data.attributes } };
    const segs = item.sourceSegmentIds.map((id) => segById.get(id));
    if (segs.some((s) => !s)) {
      discard(item.category, item.sourceSegmentIds, 'UNKNOWN_SEGMENT'); // rule 1
      continue;
    }
    const cited = segs as TranscriptSegment[];
    if (cited.some((s) => !s.speakerRoleConfirmed)) {
      discard(item.category, item.sourceSegmentIds, 'ROLES_NOT_CONFIRMED'); // DATA_MODEL §3.2 rule 5
      continue;
    }
    const texts = cited.map((s) => s.text);
    const allText = texts.join(' ');

    // rule 2: every number in the value and attributes appears in the source
    const attrText = Object.values(item.attributes).filter((v) => typeof v === 'string' || typeof v === 'number').join(' ');
    const srcNums = new Set(numbersIn(allText));
    if (numbersIn(`${item.value} ${attrText}`).some((n) => !srcNums.has(n))) {
      discard(item.category, item.sourceSegmentIds, 'NUMBER_NOT_IN_SOURCE');
      continue;
    }

    // rule 17a / rule 8: verbatim claims must be a span of exactly one cited segment
    let derivation = item.derivationMethod;
    const spanSeg = cited.length === 1 && isSpan(cited[0].text, item.value) ? cited[0] : undefined;
    if (derivation !== 'AI_INFERENCE' && !spanSeg) derivation = 'AI_INFERENCE';
    // rule 17b: AI inference tokens must all be grounded
    if (derivation === 'AI_INFERENCE' && !tokensGrounded(item.value, texts)) {
      discard(item.category, item.sourceSegmentIds, 'NOT_GROUNDED');
      continue;
    }
    // rule 17c: inferential/diagnostic/treatment wording only verbatim from the source (ASSESSMENT/PLAN: DOCTOR only)
    const wording = phrasesIn(item.value, INFERENTIAL_WORDING);
    const doctorText = cited.filter((s) => s.speakerRole === 'DOCTOR').map((s) => s.text).join(' ');
    const wordingSource = item.category === 'ASSESSMENT' || item.category === 'PLAN' ? doctorText : allText;
    if (wording.some((w) => phrasesIn(wordingSource, [w]).length === 0)) {
      discard(item.category, item.sourceSegmentIds, 'INFERENTIAL_WORDING');
      continue;
    }
    // jobs 7–8: assessments and plans only from clinician segments; a patient's diagnosis report is history (CS-40)
    if ((item.category === 'ASSESSMENT' || item.category === 'PLAN') && !cited.every((s) => s.speakerRole === 'DOCTOR')) {
      discard(item.category, item.sourceSegmentIds, 'ASSESSMENT_OR_PLAN_NOT_CLINICIAN');
      continue;
    }

    // rule 19: context check on the clause that holds the value
    const primary = spanSeg ?? cited[cited.length - 1];
    const clause = clauseContaining(primary.text, item.value) ?? primary.text;
    const cc = clauseContext(clause);
    const allQuestions = cited.every((s) => {
      const c = clauseContaining(s.text, item.value) ?? s.text;
      return clauseContext(c).question;
    });
    if (allQuestions && item.informationState !== 'UNKNOWN') {
      discard(item.category, item.sourceSegmentIds, 'QUESTION_ONLY');
      continue;
    }
    let contextFlag = false;
    if (cc.hypothetical) {
      if (item.category === 'FOLLOW_UP') {
        discard(item.category, item.sourceSegmentIds, 'CONDITIONAL_FOLLOW_UP');
        continue;
      }
      const condPresent = cmp(item.value).includes(cmp(cc.hypothetical));
      if (item.category === 'PLAN' && primary.speakerRole === 'DOCTOR') {
        if (!condPresent) {
          discard(item.category, item.sourceSegmentIds, 'CUE_CLAUSE_OMITTED');
          continue;
        }
      } else {
        if (!condPresent) {
          discard(item.category, item.sourceSegmentIds, 'CUE_CLAUSE_OMITTED');
          continue;
        }
        contextFlag = true;
      }
    }
    if (cc.experiencer && item.category !== 'HISTORY_FAMILY' && item.category !== 'HISTORY_SOCIAL') {
      const who = cc.experiencer.split(' ').pop() as string;
      if (!cmp(item.value).includes(cmp(who))) {
        discard(item.category, item.sourceSegmentIds, 'CUE_CLAUSE_OMITTED');
        continue;
      }
      contextFlag = true;
    }

    // rule 9 (hedge on the whole clause) and rule 3 (negation in scope)
    let state = item.informationState;
    let needs = item.needsClarification;
    let reason = item.clarificationReason;
    if (state !== 'NOT_DISCUSSED') {
      if (cc.hedge && state !== 'UNKNOWN' && !(needs && reason === 'HEDGED_STATEMENT')) {
        state = 'UNKNOWN';
        needs = true;
        reason = 'HEDGED_STATEMENT';
      }
      if (!cc.hedge) {
        const negated =
          item.category === 'DEMOGRAPHIC'
            ? DEMOGRAPHIC_NEGATION.test(item.value) // "No, I'm 47" corrects, it does not negate the age
            : isNegatedSpan(clause, item.value) || (spanSeg ? false : texts.some((t) => isNegatedSpan(clauseContaining(t, item.value) ?? t, item.value)));
        const blanket = item.attributes.substance === 'ANY' || item.attributes.rawName === 'ANY';
        if (state === 'POSITIVE' && negated && !blanket && item.attributes.takingStatus !== 'DISCONTINUED') {
          discard(item.category, item.sourceSegmentIds, 'NEGATION_MISMATCH');
          continue;
        }
        if (state === 'NEGATIVE' && !negated && !blanket && derivation !== 'AI_INFERENCE' && item.category !== 'EXAMINATION_FINDING') {
          discard(item.category, item.sourceSegmentIds, 'NEGATION_MISMATCH');
          continue;
        }
      }
    } else if (!cc.notDiscussed) {
      // "not discussed" is never inferred: it must be stated (otherwise it is simply absent)
      discard(item.category, item.sourceSegmentIds, 'NOT_GROUNDED');
      continue;
    }

    // rule 18: unclear audio
    if (cited.some((s) => /\[unclear\]/i.test(s.text) || s.confidence === 'LOW' || s.clinicianMarkedUncertain) && !needs) {
      needs = true;
      reason = 'UNCERTAIN_SPEECH';
    }
    if (contextFlag) {
      needs = true;
      reason = 'CONTEXT_UNCLEAR';
    }

    // DISCONTINUED only for an identified medication named in the cited segments (CS-26, CS-36)
    if (item.category === 'MEDICATION' && item.attributes.takingStatus === 'DISCONTINUED') {
      const name = item.attributes.rawName ?? '';
      if (!name || !phrasesIn(allText, [name]).length) {
        delete item.attributes.takingStatus;
        needs = true;
        reason = 'UNIDENTIFIED_SUBJECT';
      }
    }

    const { key, normalized } = computeConceptKey(item.category, item.value, item.attributes);
    if (derivation === 'VERBATIM_EXTRACTION' && normalized && normalized !== cmp(item.value)) derivation = 'NORMALIZED_EXTRACTION';
    const roles = Array.from(new Set(cited.map((s) => s.speakerRole)));
    const prov = provenanceFor(derivation, cited.length > 1 ? cited.map((s) => s.speakerRole) : roles);
    const ts = nowIso();
    facts.push({
      factId: newId(),
      patientId: ctx.patientId,
      visitId: ctx.visitId,
      category: item.category,
      conceptKey: key,
      value: item.value,
      normalizedValue: normalized && normalized !== cmp(item.value) ? normalized : undefined,
      informationState: state,
      originProvenance: prov,
      rootOriginProvenance: prov,
      provenance: prov,
      status: 'PROVISIONAL',
      derivationMethod: derivation,
      sourceSegmentIds: item.sourceSegmentIds,
      sourceSpeakerId: primary.speakerId,
      sourceSpeakerRole: primary.speakerRole,
      sourceStartTime: primary.startTime,
      confidence: item.confidence,
      needsClarification: needs,
      clarificationReason: needs ? reason ?? 'OTHER' : undefined,
      conflictIds: [],
      attributes: item.attributes,
      extractor: ctx.extractor,
      aiJobVersion: ctx.aiJobVersion,
      providerExecutionId: ctx.providerExecutionId,
      createdAt: ts,
      updatedAt: ts,
    });
  }
  return { facts, discarded };
}

/** Merges AI facts into deterministic facts: identical (category, conceptKey, state, segments) are dropped. */
export function mergeFacts(primary: ClinicalFact[], secondary: ClinicalFact[]): ClinicalFact[] {
  const sig = (f: ClinicalFact) => `${f.category}|${f.conceptKey === 'UNMAPPED' ? cmp(f.value) : f.conceptKey}|${f.informationState}|${[...f.sourceSegmentIds].sort().join(',')}`;
  const seen = new Set(primary.map(sig));
  return primary.concat(secondary.filter((f) => !seen.has(sig(f))));
}
