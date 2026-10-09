/**
 * Evidence query generation (job 11, deterministic code — ADR-039, ADR-043), on-device sanitizer (ADR-036),
 * deduplication and ranking (EVIDENCE-SOURCES §14–§15, ADR-028). Concepts come only from stated, eligible facts
 * (DATA_MODEL §4.15 participation table). The model never builds queries.
 */
import { isEligible } from './facts';
import { CANCER_CONCEPTS } from './lexicon';
import type { ClinicalFact, EvidenceQuery, EvidenceSource, EvidenceSourceType, Patient, Visit } from './types';
import { newId, nowIso, uniq } from './util';

export type Route =
  | 'MEDICATION_STANDARD'
  | 'MEDICATION_LABEL'
  | 'REGULATORY_SOURCE'
  | 'REGULATORY_SAFETY'
  | 'LITERATURE_PRIMARY'
  | 'LITERATURE_SECONDARY'
  | 'PATIENT_EDUCATION'
  | 'CANCER_INFO'
  | 'TRIALS'
  | 'CHEMICAL'
  | 'TERMINOLOGY'
  | 'PUBLIC_HEALTH';

/** Code constant (ADR-043 d7): never automatic, whatever any configuration says. */
export const CLINICIAN_REQUEST_ONLY: ReadonlySet<Route> = new Set(['TRIALS', 'CHEMICAL', 'PUBLIC_HEALTH', 'TERMINOLOGY']);

/** EVIDENCE-SOURCES §17 route table, keyed by FactCategory. Unlisted categories get no automatic route. */
export const ROUTE_TABLE: Partial<Record<ClinicalFact['category'], Route[]>> = {
  MEDICATION: ['MEDICATION_STANDARD'],
  SYMPTOM: ['LITERATURE_PRIMARY', 'PATIENT_EDUCATION'],
  HISTORY_MEDICAL: ['LITERATURE_PRIMARY', 'PATIENT_EDUCATION'],
  ASSESSMENT: ['LITERATURE_PRIMARY', 'PATIENT_EDUCATION'],
};

export type Participation = 'QUERY' | 'EXCLUDED';

/** DATA_MODEL §4.15 participation table. Returns null when the fact may produce an automatic concept. */
export function exclusionReason(f: ClinicalFact, openConflictFactIds: Set<string>): string | null {
  if (!isEligible(f)) return f.status === 'REJECTED' ? 'rejected' : f.supersededByFactId || f.resolvedAwayByConflictId ? 'superseded' : 'flagged for review';
  if (f.informationState === 'NEGATIVE') return 'negative (never searched as if present)';
  if (f.informationState === 'NOT_DISCUSSED') return 'not discussed';
  if (openConflictFactIds.has(f.factId)) return 'in an open conflict';
  if (f.conceptKey === 'UNMAPPED' || f.conceptKey === 'ANY') return 'no mapped concept';
  if (f.category === 'HISTORY_FAMILY' || f.category === 'HISTORY_SOCIAL') return 'family/social history';
  if (f.originProvenance === 'AI_EXTRACTED' && f.status !== 'CONFIRMED') return 'unconfirmed AI inference';
  if (!ROUTE_TABLE[f.category]) return 'no automatic route for this category';
  return null;
}

/** ADR-036 sanitizer: no patient identifiers, dates, contact data or free transcript text; ≤ 6 words per term. */
export function sanitizeTerm(term: string, patient?: Pick<Patient, 'name' | 'patientReference' | 'dateOfBirth'>): { ok: true; term: string } | { ok: false; reason: string } {
  const t = term.trim().replace(/\s+/g, ' ');
  if (!t) return { ok: false, reason: 'Empty search.' };
  if (t.length > 80 || t.split(' ').length > 8) return { ok: false, reason: 'Use a short clinical term, not a sentence.' };
  if (/P-\d{6}|V-\d{6}/i.test(t)) return { ok: false, reason: 'Patient or visit references are never sent.' };
  if (/\b\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}\b|\b(19|20)\d{2}-\d{2}-\d{2}\b/.test(t)) return { ok: false, reason: 'Dates are never sent with a search.' };
  if (/@|\+?\d[\d\s-]{7,}\d|https?:/i.test(t)) return { ok: false, reason: 'Contact details or links are never sent.' };
  if (/\b\d+\s+[a-z]+\s+(street|st|road|rd|avenue|ave|lane|ln)\b/i.test(t)) return { ok: false, reason: 'Addresses are never sent.' };
  if (patient?.name) {
    for (const part of patient.name.toLowerCase().split(/\s+/).filter((p) => p.length > 2)) {
      if (t.toLowerCase().split(/\s+/).includes(part)) return { ok: false, reason: "The patient's name is never sent." };
    }
  }
  if (/\b(i|i'm|i've|my|me|you|your|he|she)\b/i.test(t)) return { ok: false, reason: 'Transcript wording is never sent; use a clinical term.' };
  return { ok: true, term: t };
}

export interface PlannedQuery {
  query: EvidenceQuery;
  term: string;
}

/** Builds automatic queries from stated facts only. One query per route per concept; medication by name. */
export function buildAutomaticQueries(v: Visit, patient: Patient): { planned: PlannedQuery[]; excluded: { fact: ClinicalFact; reason: string }[] } {
  const openConflict = new Set(v.conflicts.filter((c) => c.status === 'OPEN').flatMap((c) => c.factIds));
  const planned: PlannedQuery[] = [];
  const excluded: { fact: ClinicalFact; reason: string }[] = [];
  const byConcept = new Map<string, ClinicalFact[]>();
  for (const f of v.facts.filter((x) => !x.supersededByFactId)) {
    const why = exclusionReason(f, openConflict);
    if (why) {
      if (isEligible(f) || f.status === 'REJECTED') excluded.push({ fact: f, reason: why });
      continue;
    }
    const k = `${f.category === 'MEDICATION' ? 'MED' : 'CLIN'}|${f.conceptKey}`;
    byConcept.set(k, (byConcept.get(k) ?? []).concat(f));
  }
  const ts = nowIso();
  const mk = (term: string, facts: ClinicalFact[], route: Route): PlannedQuery | null => {
    if (CLINICIAN_REQUEST_ONLY.has(route)) return null;
    const s = sanitizeTerm(term, patient);
    if (!s.ok) return null;
    return {
      term: s.term,
      query: {
        queryId: newId(),
        origin: 'AUTOMATIC',
        sourceFactIds: facts.map((f) => f.factId),
        sourceFactVersionIds: facts.map((f) => f.factId),
        concepts: [{ term: s.term, informationState: facts.some((f) => f.informationState === 'POSITIVE') ? 'POSITIVE' : 'UNKNOWN' }],
        route,
        provider: '',
        createdAt: ts,
        state: 'PENDING',
      },
    };
  };
  const clinical: { term: string; facts: ClinicalFact[] }[] = [];
  // most reliable concepts first: clinician-confirmed, then stated more often, then earliest (presenting complaint)
  const score = (fs: ClinicalFact[]) => (fs.some((f) => f.status === 'CONFIRMED') ? 1000 : 0) + fs.length * 10 - Math.min(9, (Math.min(...fs.map((f) => f.sourceStartTime ?? 0)) / 600) | 0);
  const ordered = Array.from(byConcept.entries()).sort((a, b) => score(b[1]) - score(a[1]));
  for (const [k, facts] of ordered) {
    const term = k.split('|')[1];
    if (k.startsWith('MED')) {
      const q = mk(term, facts, 'MEDICATION_STANDARD');
      if (q) planned.push(q);
      continue;
    }
    clinical.push({ term, facts });
    const q = mk(term, facts, 'PATIENT_EDUCATION');
    if (q) planned.push(q);
    if (CANCER_CONCEPTS.has(term) && facts.some((f) => f.category === 'HISTORY_MEDICAL' || f.category === 'ASSESSMENT')) {
      const c = mk(term, facts, 'CANCER_INFO');
      if (c) planned.push(c);
    }
  }
  // One combined literature query over up to three stated concepts (cost control), plus per-concept fallback later.
  if (clinical.length) {
    const top = clinical.slice(0, 3);
    const q = mk(top.map((c) => c.term).join(' '), top.flatMap((c) => c.facts), 'LITERATURE_PRIMARY');
    if (q) {
      q.query.concepts = top.map((c) => ({ term: c.term, informationState: c.facts.some((f) => f.informationState === 'POSITIVE') ? 'POSITIVE' : 'UNKNOWN' }));
      planned.push(q);
    }
  }
  return { planned, excluded };
}

// ---------------------------------------------------------------- dedup + ranking

export function tierFor(type: EvidenceSourceType): number {
  switch (type) {
    case 'REGULATORY':
    case 'CLINICAL_TRIAL':
    case 'TERMINOLOGY':
    case 'CHEMICAL_INFORMATION':
    case 'PUBLIC_HEALTH':
      return 1;
    case 'GUIDELINE':
      return 2;
    case 'LITERATURE':
      return 3;
    case 'PATIENT_EDUCATION':
      return 4;
  }
}

export const GROUP_ORDER: EvidenceSourceType[] = ['REGULATORY', 'GUIDELINE', 'LITERATURE', 'CLINICAL_TRIAL', 'PATIENT_EDUCATION', 'TERMINOLOGY', 'CHEMICAL_INFORMATION', 'PUBLIC_HEALTH'];

/** §15: same item when any identifier matches; the first (primary provider) record wins. */
export function dedupe(records: EvidenceSource[]): EvidenceSource[] {
  const out: EvidenceSource[] = [];
  for (const r of records) {
    const ids = [r.identifier, ...r.alternateIdentifiers].map((x) => x.toLowerCase());
    const hit = out.find((o) => [o.identifier, ...o.alternateIdentifiers].some((x) => ids.includes(x.toLowerCase())));
    if (hit) hit.alternateIdentifiers = uniq(hit.alternateIdentifiers.concat(r.identifier, r.alternateIdentifiers));
    else out.push({ ...r, alternateIdentifiers: [...r.alternateIdentifiers] });
  }
  return out;
}

const LIT_RANK = (r: EvidenceSource) => {
  const t = (r.extra?.publicationTypes ?? '').toLowerCase();
  if (/systematic review|meta-analysis/.test(t)) return 0;
  if (/randomized controlled trial/.test(t)) return 1;
  if (/review/.test(t)) return 2;
  return 3;
};

/** §14: group → order within group → cap (5 per group per query). Deterministic. */
export function rank(records: EvidenceSource[], capPerGroupPerQuery = 5): EvidenceSource[] {
  const sorted = [...records].sort((a, b) => {
    const g = GROUP_ORDER.indexOf(a.sourceType) - GROUP_ORDER.indexOf(b.sourceType);
    if (g) return g;
    if (a.sourceType === 'LITERATURE') {
      const l = LIT_RANK(a) - LIT_RANK(b);
      if (l) return l;
    }
    return (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '');
  });
  const counts = new Map<string, number>();
  return sorted.filter((r) => {
    const k = `${r.queryId}|${r.sourceType}`;
    const n = (counts.get(k) ?? 0) + 1;
    counts.set(k, n);
    return n <= capPerGroupPerQuery;
  });
}

/** Marks records whose source facts changed since retrieval (ADR-039 d6). */
export function refreshEvidenceStaleness(v: Visit): void {
  const byId = new Map(v.facts.map((f) => [f.factId, f]));
  const openConflict = new Set(v.conflicts.filter((c) => c.status === 'OPEN').flatMap((c) => c.factIds));
  for (const e of v.evidence) {
    if (e.retrievedFor === 'Clinician search') continue;
    const facts = e.sourceFactIds.map((id) => byId.get(id)).filter((f): f is ClinicalFact => !!f);
    e.factsChangedSinceRetrieval = facts.some((f) => !isEligible(f) || openConflict.has(f.factId));
    const allGone = facts.length > 0 && facts.every((f) => f.status === 'REJECTED' || !!f.resolvedAwayByConflictId);
    e.citable = !allGone && e.sourceType !== 'CLINICAL_TRIAL' && e.sourceType !== 'PUBLIC_HEALTH';
  }
}

/**
 * Concept signature of the facts that would drive an automatic search. When it differs from the one stored at the
 * last search, the clinical context changed materially (new or removed concepts) and evidence should be refreshed.
 */
export function evidenceConceptSignature(v: Visit, patient: Patient): string {
  return uniq(buildAutomaticQueries(v, patient).planned.map((p) => `${p.query.route}:${p.term.toLowerCase()}`)).sort().join('|');
}

export function evidenceOutdated(v: Visit, patient: Patient): boolean {
  if (v.evidenceState === 'NOT_STARTED' || v.evidenceConceptSignature === undefined) return false;
  return evidenceConceptSignature(v, patient) !== v.evidenceConceptSignature;
}
