/**
 * Evidence stage (ARCHITECTURE §6.4, canonical order ADR-023): facts → concepts → queries → retrieval →
 * validation → dedup → rank → storage. Runs once per visit after extraction (never per sentence), uses a
 * device-side cache of public records (ADR-028) and request de-duplication. Failure never touches clinical data.
 */
import { z } from 'zod';
import { audit, isEligible } from '../domain/facts';
import { buildAutomaticQueries, dedupe, evidenceConceptSignature, rank, refreshEvidenceStaleness, sanitizeTerm, type Route } from '../domain/evidence';
import type { ClinicalFact, EvidenceQuery, EvidenceSource, Patient, Visit } from '../domain/types';
import { newId, nowIso } from '../domain/util';
import type { ClinicalStore } from '../infrastructure/storage/clinicalStore';
import {
  clinicalTrials,
  dailymedLabels,
  drugsAtFda,
  europePmcSearch,
  medlinePlusTopics,
  openfdaLabel,
  openfdaRecalls,
  pubchemCompound,
  pubmedSearch,
  rxnormNormalize,
  rxnormProducts,
  type RecordDraft,
} from '../providers/evidence/adapters';
import { ProviderError } from '../providers/evidence/http';

const DAY = 86400000;
const TTL: Partial<Record<Route, number>> = { LITERATURE_PRIMARY: 7 * DAY, PATIENT_EDUCATION: 7 * DAY, MEDICATION_LABEL: 7 * DAY, REGULATORY_SOURCE: 7 * DAY };

const CacheDoc = z.object({ entries: z.record(z.string(), z.object({ at: z.number(), records: z.array(z.any()) })) });
type CacheDocT = z.infer<typeof CacheDoc>;

export class EvidenceService {
  private mem: CacheDocT | null = null;
  private inflight = new Map<string, Promise<RecordDraft[]>>();

  constructor(private readonly store: ClinicalStore) {}

  private async cache(): Promise<CacheDocT> {
    if (!this.mem) this.mem = (await this.store.readCache(CacheDoc)) ?? { entries: {} };
    return this.mem;
  }

  /** Cached + de-duplicated fetch. Recalls (REGULATORY_SAFETY) are always refetched. */
  private async cached(route: Route, key: string, fn: () => Promise<RecordDraft[]>): Promise<RecordDraft[]> {
    const k = `${route}|${key.toLowerCase()}`;
    const ttl = TTL[route];
    const c = await this.cache();
    const hit = c.entries[k];
    if (ttl && hit && Date.now() - hit.at < ttl) return hit.records as RecordDraft[];
    const running = this.inflight.get(k);
    if (running) return running;
    const p = fn()
      .then(async (records) => {
        if (ttl) {
          c.entries[k] = { at: Date.now(), records };
          const keys = Object.keys(c.entries);
          if (keys.length > 300) for (const old of keys.sort((a, b) => c.entries[a].at - c.entries[b].at).slice(0, keys.length - 300)) delete c.entries[old];
          await this.store.writeCache(c).catch(() => undefined);
        }
        return records;
      })
      .finally(() => this.inflight.delete(k));
    this.inflight.set(k, p);
    return p;
  }

  private toSource(d: RecordDraft, q: EvidenceQuery, retrievedFor: string): EvidenceSource {
    return { ...d, evidenceId: newId(), queryId: q.queryId, retrievedFor, sourceFactIds: q.sourceFactIds, factsChangedSinceRetrieval: false, citable: d.sourceType !== 'CLINICAL_TRIAL' && d.sourceType !== 'PUBLIC_HEALTH' };
  }

  /** Medication normalization (route MEDICATION_STANDARD) then label lookups only for an exact/selected RxCUI. */
  private async medication(v: Visit, q: EvidenceQuery, term: string): Promise<EvidenceSource[]> {
    const facts = v.facts.filter((f) => q.sourceFactIds.includes(f.factId));
    let rxcui = facts.find((f) => f.attributes.rxcui)?.attributes.rxcui;
    if (!rxcui) {
      const norm = await rxnormNormalize(term);
      for (const f of facts) {
        if (norm.exact) {
          f.attributes.rxcui = norm.exact.rxcui;
          f.attributes.normalizedName = norm.exact.name;
        } else if (norm.candidates.length) {
          f.attributes.normalizationCandidates = norm.candidates;
          f.needsClarification = f.needsClarification || norm.candidates.length > 1;
          if (norm.candidates.length > 1 && !f.clarificationReason) f.clarificationReason = 'AMBIGUOUS_MEDICATION';
        }
      }
      rxcui = norm.exact?.rxcui;
    }
    if (!rxcui) return []; // CS-11: no label until a single exact match or a clinician selection
    return this.labelsFor(v, q, rxcui, term);
  }

  async labelsFor(v: Visit, q: EvidenceQuery, rxcui: string, term: string): Promise<EvidenceSource[]> {
    const products = await this.cached('MEDICATION_LABEL', `products:${rxcui}`, async () => (await rxnormProducts(rxcui)).map((id) => ({ identifier: id }) as unknown as RecordDraft));
    const ids = products.map((p) => (p as unknown as { identifier: string }).identifier);
    const label = `${term} (RxCUI ${rxcui})`;
    const parts = await Promise.allSettled([
      this.cached('MEDICATION_LABEL', `dailymed:${rxcui}`, () => dailymedLabels(rxcui)),
      this.cached('MEDICATION_LABEL', `openfda:${rxcui}`, () => openfdaLabel(ids)),
      this.cached('REGULATORY_SOURCE', `drugsfda:${rxcui}`, () => drugsAtFda(ids)),
      this.cached('REGULATORY_SAFETY', `recall:${rxcui}`, () => openfdaRecalls(ids)),
    ]);
    const out: EvidenceSource[] = [];
    for (const p of parts) if (p.status === 'fulfilled') out.push(...p.value.map((d) => this.toSource(d, q, label)));
    if (parts.every((p) => p.status === 'rejected')) throw (parts[0] as PromiseRejectedResult).reason;
    return out;
  }

  /** Automatic evidence stage for a visit. Mutates the visit; caller saves. */
  async runAutomatic(v: Visit, patient: Patient): Promise<{ failedRoutes: string[] }> {
    v.evidenceState = 'IN_PROGRESS';
    const { planned } = buildAutomaticQueries(v, patient);
    const failed: string[] = [];
    const collected: EvidenceSource[] = [];
    // drop previous automatic results (manual searches are kept)
    const oldAuto = new Set(v.evidenceQueries.filter((q) => q.origin === 'AUTOMATIC').map((q) => q.queryId));
    v.evidenceQueries = v.evidenceQueries.filter((q) => q.origin !== 'AUTOMATIC');
    v.evidence = v.evidence.filter((e) => !oldAuto.has(e.queryId));

    for (const { query, term } of planned) {
      const retrievedFor = `${query.concepts.map((c) => c.term).join(', ')} (${query.concepts.map((c) => c.informationState.toLowerCase()).join(', ')})`;
      try {
        let records: EvidenceSource[] = [];
        if (query.route === 'MEDICATION_STANDARD') {
          query.provider = 'RxNorm → DailyMed / openFDA';
          records = await this.medication(v, query, term);
        } else if (query.route === 'LITERATURE_PRIMARY') {
          query.provider = 'PubMed';
          const terms = query.concepts.map((c) => c.term);
          let drafts = await this.cached('LITERATURE_PRIMARY', `pubmed:${terms.join('|')}`, () => pubmedSearch(terms));
          if (drafts.length < 3) {
            // secondary source when primary is weak (EVIDENCE-SOURCES §3); deduplicated below
            query.provider = 'PubMed + Europe PMC';
            const sec = await this.cached('LITERATURE_PRIMARY', `epmc:${terms.join('|')}`, () => europePmcSearch(terms)).catch(() => [] as RecordDraft[]);
            drafts = drafts.concat(sec);
          }
          records = drafts.map((d) => this.toSource(d, query, retrievedFor));
        } else if (query.route === 'PATIENT_EDUCATION' || query.route === 'CANCER_INFO') {
          query.provider = 'MedlinePlus';
          records = (await this.cached('PATIENT_EDUCATION', `mlp:${term}`, () => medlinePlusTopics(term))).map((d) => this.toSource(d, query, retrievedFor));
        }
        query.state = records.length ? 'COMPLETED' : 'NO_RESULTS';
        collected.push(...records);
      } catch (e) {
        query.state = 'FAILED';
        query.errorKind = e instanceof ProviderError ? e.kind : 'UNKNOWN';
        failed.push(`${query.route}:${term}`);
      }
      v.evidenceQueries.push(query);
    }
    v.evidence.push(...rank(dedupe(collected)));
    refreshEvidenceStaleness(v);
    const anyOk = v.evidenceQueries.some((q) => q.origin === 'AUTOMATIC' && (q.state === 'COMPLETED' || q.state === 'NO_RESULTS'));
    v.evidenceState = planned.length === 0 ? 'COMPLETED' : failed.length === 0 ? 'COMPLETED' : anyOk ? 'PARTIAL' : 'FAILED';
    v.evidenceConceptSignature = evidenceConceptSignature(v, patient);
    audit(v, 'VISIT', v.visitId, 'UPDATED', 'SYSTEM', `evidence ${v.evidenceState}`);
    return { failedRoutes: failed };
  }

  /** Clinician manual search (CLINICIAN_MANUAL). Trials and chemistry are only ever clinician-requested. */
  async runManual(v: Visit, patient: Patient, rawTerm: string, kind: 'LITERATURE' | 'PATIENT_EDUCATION' | 'TRIALS' | 'CHEMICAL'): Promise<{ added: number; error?: string }> {
    const s = sanitizeTerm(rawTerm, patient);
    if (!s.ok) return { added: 0, error: s.reason };
    const route: Route = kind === 'LITERATURE' ? 'LITERATURE_PRIMARY' : kind === 'PATIENT_EDUCATION' ? 'PATIENT_EDUCATION' : kind === 'TRIALS' ? 'TRIALS' : 'CHEMICAL';
    const q: EvidenceQuery = {
      queryId: newId(),
      origin: 'CLINICIAN_MANUAL',
      sourceFactIds: [],
      sourceFactVersionIds: [],
      concepts: [{ term: s.term, informationState: 'POSITIVE' }],
      route,
      provider: kind === 'LITERATURE' ? 'PubMed' : kind === 'PATIENT_EDUCATION' ? 'MedlinePlus' : kind === 'TRIALS' ? 'ClinicalTrials.gov' : 'PubChem',
      createdAt: nowIso(),
      state: 'PENDING',
    };
    try {
      const drafts =
        kind === 'LITERATURE'
          ? await this.cached('LITERATURE_PRIMARY', `pubmed:${s.term}`, () => pubmedSearch([s.term]))
          : kind === 'PATIENT_EDUCATION'
            ? await this.cached('PATIENT_EDUCATION', `mlp:${s.term}`, () => medlinePlusTopics(s.term))
            : kind === 'TRIALS'
              ? await clinicalTrials(s.term)
              : await pubchemCompound(s.term);
      const records = rank(dedupe(drafts.map((d) => this.toSource(d, q, 'Clinician search'))));
      q.state = records.length ? 'COMPLETED' : 'NO_RESULTS';
      v.evidenceQueries.push(q);
      v.evidence.push(...records);
      return { added: records.length };
    } catch (e) {
      q.state = 'FAILED';
      q.errorKind = e instanceof ProviderError ? e.kind : 'UNKNOWN';
      v.evidenceQueries.push(q);
      return { added: 0, error: e instanceof ProviderError ? e.message : 'The search failed. Try again later.' };
    }
  }

  /** Clinician selects one RxNorm candidate (CS-11), then labels are fetched. */
  async selectRxcui(v: Visit, fact: ClinicalFact, rxcui: string, name: string): Promise<number> {
    fact.attributes.rxcui = rxcui;
    fact.attributes.normalizedName = name;
    if (fact.clarificationReason === 'AMBIGUOUS_MEDICATION') {
      fact.needsClarification = false;
      fact.clarificationReason = undefined;
    }
    audit(v, 'FACT', fact.factId, 'UPDATED', 'CLINICIAN', 'RxNorm selection');
    const q: EvidenceQuery = {
      queryId: newId(),
      origin: 'CLINICIAN_MANUAL',
      sourceFactIds: [fact.factId],
      sourceFactVersionIds: [fact.factId],
      concepts: [{ term: name, informationState: fact.informationState }],
      route: 'MEDICATION_LABEL',
      provider: 'DailyMed / openFDA',
      createdAt: nowIso(),
      state: 'PENDING',
    };
    try {
      const recs = await this.labelsFor(v, q, rxcui, name);
      q.state = recs.length ? 'COMPLETED' : 'NO_RESULTS';
      v.evidenceQueries.push(q);
      v.evidence.push(...rank(dedupe(recs)));
      return recs.length;
    } catch {
      q.state = 'FAILED';
      v.evidenceQueries.push(q);
      return 0;
    }
  }
}

/** Facts excluded from automatic search only because the concept key is UNMAPPED, in a routed category (FR-17.8). */
export function unmappedNotices(v: Visit): ClinicalFact[] {
  return v.facts.filter((f) => isEligible(f) && f.conceptKey === 'UNMAPPED' && ['MEDICATION', 'SYMPTOM', 'HISTORY_MEDICAL', 'ASSESSMENT'].includes(f.category) && (f.informationState === 'POSITIVE' || f.informationState === 'UNKNOWN') && !(f.originProvenance === 'AI_EXTRACTED' && f.status !== 'CONFIRMED'));
}
