/**
 * Free public evidence adapters (API_CATALOG; endpoints verified live 2026-10-08). Every response is schema-
 * validated; identifiers come only from validated responses (ADR-036); records failing validation are dropped,
 * never repaired (CS-16a, CS-17). Queries carry sanitized clinical concepts only.
 */
import { z } from 'zod';
import type { EvidenceSource } from '../../domain/types';
import { nowIso } from '../../domain/util';
import { getJson, getText, ProviderError, stripTags } from './http';

export type RecordDraft = Omit<EvidenceSource, 'evidenceId' | 'queryId' | 'retrievedFor' | 'sourceFactIds' | 'factsChangedSinceRetrieval' | 'citable'>;

const NCBI_TOOL = 'clinnote';
const ncbiEmail = () => (process.env.EXPO_PUBLIC_NCBI_EMAIL ? `&email=${encodeURIComponent(process.env.EXPO_PUBLIC_NCBI_EMAIL)}` : '');
const US_REG = 'U.S. regulatory information';
const enc = encodeURIComponent;
const clip = (s: string | undefined, n = 320) => (s && s.length > n ? `${s.slice(0, n).trim()}…` : s);

// ---------------------------------------------------------------- RxNorm (terminology)
const RxExact = z.object({ idGroup: z.object({ rxnormId: z.array(z.string().regex(/^\d+$/)).optional() }) });
const RxApprox = z.object({
  approximateGroup: z.object({
    candidate: z.array(z.object({ rxcui: z.string().regex(/^\d+$/), name: z.string().optional(), source: z.string().optional() })).optional(),
  }),
});
const RxRelated = z.object({
  relatedGroup: z.object({
    conceptGroup: z.array(z.object({ conceptProperties: z.array(z.object({ rxcui: z.string().regex(/^\d+$/), name: z.string() })).optional() })).optional(),
  }),
});

export interface RxNormResult {
  exact: { rxcui: string; name: string } | null;
  candidates: { rxcui: string; name: string }[];
}

export async function rxnormNormalize(term: string): Promise<RxNormResult> {
  const ex = RxExact.safeParse(await getJson(`https://rxnav.nlm.nih.gov/REST/rxcui.json?name=${enc(term)}&search=0`));
  if (!ex.success) throw new ProviderError('INVALID_RESPONSE', 'RxNorm returned an unexpected response.');
  const ids = ex.data.idGroup.rxnormId ?? [];
  if (ids.length === 1) return { exact: { rxcui: ids[0], name: term.toLowerCase() }, candidates: [] };
  const ap = RxApprox.safeParse(await getJson(`https://rxnav.nlm.nih.gov/REST/approximateTerm.json?term=${enc(term)}&maxEntries=6`));
  if (!ap.success) throw new ProviderError('INVALID_RESPONSE', 'RxNorm returned an unexpected response.');
  const seen = new Set<string>();
  const candidates = (ap.data.approximateGroup.candidate ?? [])
    .filter((c) => c.source === 'RXNORM' && c.name && !seen.has(c.rxcui) && seen.add(c.rxcui))
    .map((c) => ({ rxcui: c.rxcui, name: c.name as string }));
  // Several options: never auto-selected (CS-11). The clinician chooses.
  return { exact: null, candidates };
}

/** Product-level RxCUIs (SCD/SBD) for an ingredient RxCUI — openFDA indexes product RxCUIs. */
export async function rxnormProducts(rxcui: string): Promise<string[]> {
  const r = RxRelated.safeParse(await getJson(`https://rxnav.nlm.nih.gov/REST/rxcui/${enc(rxcui)}/related.json?tty=SCD+SBD`));
  if (!r.success) throw new ProviderError('INVALID_RESPONSE', 'RxNorm returned an unexpected response.');
  const ids = (r.data.relatedGroup.conceptGroup ?? []).flatMap((g) => (g.conceptProperties ?? []).map((c) => c.rxcui));
  return Array.from(new Set([rxcui, ...ids])).slice(0, 25);
}

// ---------------------------------------------------------------- DailyMed (labels)
const DailyMedList = z.object({
  data: z.array(z.object({ setid: z.string().regex(/^[0-9a-f-]{36}$/i), title: z.string(), published_date: z.string().optional(), spl_version: z.number().optional() })),
});
export async function dailymedLabels(rxcui: string): Promise<RecordDraft[]> {
  const r = DailyMedList.safeParse(await getJson(`https://dailymed.nlm.nih.gov/dailymed/services/v2/spls.json?rxcui=${enc(rxcui)}&pagesize=3`));
  if (!r.success) throw new ProviderError('INVALID_RESPONSE', 'DailyMed returned an unexpected response.');
  const ts = nowIso();
  return r.data.data.slice(0, 3).map((d) => ({
    provider: 'DailyMed',
    sourceType: 'REGULATORY',
    tier: 1,
    title: d.title,
    identifier: d.setid,
    identifierType: 'SETID',
    alternateIdentifiers: [],
    url: `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${d.setid}`,
    publishedAt: d.published_date,
    retrievedAt: ts,
    relevance: 'HIGH',
    jurisdictionLabel: US_REG,
    responseValidated: true,
  }));
}

// ---------------------------------------------------------------- openFDA (label, Drugs@FDA, recalls)
const rxOr = (ids: string[]) => `openfda.rxcui:(${ids.map((i) => `"${i}"`).join('+')})`;
const FdaLabel = z.object({
  results: z.array(
    z.object({
      set_id: z.string().regex(/^[0-9a-f-]{36}$/i),
      effective_time: z.string().optional(),
      boxed_warning: z.array(z.string()).optional(),
      warnings: z.array(z.string()).optional(),
      warnings_and_cautions: z.array(z.string()).optional(),
      contraindications: z.array(z.string()).optional(),
      indications_and_usage: z.array(z.string()).optional(),
      openfda: z.object({ brand_name: z.array(z.string()).optional(), generic_name: z.array(z.string()).optional(), manufacturer_name: z.array(z.string()).optional() }).optional(),
    }),
  ),
});
export async function openfdaLabel(productRxcuis: string[]): Promise<RecordDraft[]> {
  let raw: unknown;
  try {
    raw = await getJson(`https://api.fda.gov/drug/label.json?search=${enc(rxOr(productRxcuis))}&limit=1`);
  } catch (e) {
    if (e instanceof ProviderError && e.kind === 'NO_RESULTS') return [];
    throw e;
  }
  const r = FdaLabel.safeParse(raw);
  if (!r.success) throw new ProviderError('INVALID_RESPONSE', 'openFDA returned an unexpected response.');
  const ts = nowIso();
  return r.data.results.map((x) => {
    const name = x.openfda?.generic_name?.[0] ?? x.openfda?.brand_name?.[0] ?? 'Drug label';
    const extra: Record<string, string> = {};
    if (x.boxed_warning?.[0]) extra.boxedWarning = clip(x.boxed_warning[0]) as string;
    const warn = x.warnings_and_cautions?.[0] ?? x.warnings?.[0];
    if (warn) extra.warnings = clip(warn) as string;
    if (x.contraindications?.[0]) extra.contraindications = clip(x.contraindications[0]) as string;
    if (x.indications_and_usage?.[0]) extra.indications = clip(x.indications_and_usage[0]) as string;
    if (x.openfda?.manufacturer_name?.[0]) extra.manufacturer = x.openfda.manufacturer_name[0];
    return {
      provider: 'openFDA label',
      sourceType: 'REGULATORY' as const,
      tier: 1,
      title: `${name} — prescribing information (openFDA)`,
      identifier: x.set_id,
      identifierType: 'SETID' as const,
      alternateIdentifiers: [],
      url: `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${x.set_id}`,
      publishedAt: x.effective_time ? `${x.effective_time.slice(0, 4)}-${x.effective_time.slice(4, 6)}-${x.effective_time.slice(6, 8)}` : undefined,
      retrievedAt: ts,
      relevance: 'HIGH' as const,
      jurisdictionLabel: US_REG,
      extra,
      responseValidated: true as const,
    };
  });
}

const DrugsFda = z.object({
  results: z.array(z.object({ application_number: z.string().regex(/^(NDA|ANDA|BLA)\d+$/), sponsor_name: z.string().optional(), products: z.array(z.object({ brand_name: z.string().optional(), marketing_status: z.string().optional() })).optional() })),
});
export async function drugsAtFda(productRxcuis: string[]): Promise<RecordDraft[]> {
  let raw: unknown;
  try {
    raw = await getJson(`https://api.fda.gov/drug/drugsfda.json?search=${enc(rxOr(productRxcuis))}&limit=3`);
  } catch (e) {
    if (e instanceof ProviderError && e.kind === 'NO_RESULTS') return [];
    throw e;
  }
  const r = DrugsFda.safeParse(raw);
  if (!r.success) throw new ProviderError('INVALID_RESPONSE', 'Drugs@FDA returned an unexpected response.');
  const ts = nowIso();
  return r.data.results.map((x) => ({
    provider: 'Drugs@FDA',
    sourceType: 'REGULATORY' as const,
    tier: 1,
    title: `${x.products?.[0]?.brand_name ?? 'Application'} — ${x.application_number}${x.sponsor_name ? ` (${x.sponsor_name})` : ''}`,
    identifier: x.application_number,
    identifierType: 'APPLICATION_NO' as const,
    alternateIdentifiers: [],
    url: `https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=${x.application_number.replace(/\D/g, '')}`,
    retrievedAt: ts,
    relevance: 'MEDIUM' as const,
    jurisdictionLabel: US_REG,
    extra: x.products?.[0]?.marketing_status ? { marketingStatus: x.products[0].marketing_status } : undefined,
    responseValidated: true as const,
  }));
}

const Enforcement = z.object({
  results: z.array(z.object({ recall_number: z.string(), reason_for_recall: z.string().optional(), report_date: z.string().optional(), classification: z.string().optional(), status: z.string().optional() })),
});
export async function openfdaRecalls(productRxcuis: string[]): Promise<RecordDraft[]> {
  let raw: unknown;
  try {
    raw = await getJson(`https://api.fda.gov/drug/enforcement.json?search=${enc(rxOr(productRxcuis))}&limit=3&sort=report_date:desc`);
  } catch (e) {
    if (e instanceof ProviderError && e.kind === 'NO_RESULTS') return [];
    throw e;
  }
  const r = Enforcement.safeParse(raw);
  if (!r.success) throw new ProviderError('INVALID_RESPONSE', 'openFDA returned an unexpected response.');
  const ts = nowIso();
  return r.data.results.map((x) => ({
    provider: 'openFDA enforcement',
    sourceType: 'REGULATORY' as const,
    tier: 1,
    title: `Recall ${x.recall_number}${x.classification ? ` · ${x.classification}` : ''}${x.status ? ` · ${x.status}` : ''}`,
    identifier: `recall:${x.recall_number}`,
    identifierType: 'URL' as const,
    alternateIdentifiers: [],
    url: `https://api.fda.gov/drug/enforcement.json?search=recall_number:"${enc(x.recall_number)}"`,
    publishedAt: x.report_date ? `${x.report_date.slice(0, 4)}-${x.report_date.slice(4, 6)}-${x.report_date.slice(6, 8)}` : undefined,
    retrievedAt: ts,
    relevance: 'MEDIUM' as const,
    excerpt: clip(x.reason_for_recall),
    jurisdictionLabel: US_REG,
    responseValidated: true as const,
  }));
}

// ---------------------------------------------------------------- PubMed (E-utilities)
const ESearch = z.object({ esearchresult: z.object({ idlist: z.array(z.string().regex(/^\d+$/)) }) });
const ESummaryItem = z.object({
  uid: z.string().regex(/^\d+$/),
  title: z.string().min(1),
  pubdate: z.string().optional(),
  source: z.string().optional(),
  authors: z.array(z.object({ name: z.string() })).optional(),
  pubtype: z.array(z.string()).optional(),
  articleids: z.array(z.object({ idtype: z.string(), value: z.string() })).optional(),
});

export async function pubmedSearch(terms: string[], max = 5): Promise<RecordDraft[]> {
  const query = terms.map((t) => `(${t})`).join(' AND ');
  const es = ESearch.safeParse(await getJson(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${enc(query)}&retmode=json&retmax=${max}&sort=relevance&tool=${NCBI_TOOL}${ncbiEmail()}`));
  if (!es.success) throw new ProviderError('INVALID_RESPONSE', 'PubMed returned an unexpected response.');
  const ids = es.data.esearchresult.idlist;
  if (!ids.length) return [];
  return pubmedSummaries(ids);
}

/** Re-resolves PMIDs via ESummary; any ID that does not resolve is dropped (CS-16a). */
export async function pubmedSummaries(ids: string[]): Promise<RecordDraft[]> {
  const raw = (await getJson(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json&tool=${NCBI_TOOL}${ncbiEmail()}`)) as { result?: Record<string, unknown> };
  if (!raw || typeof raw !== 'object' || !raw.result) throw new ProviderError('INVALID_RESPONSE', 'PubMed returned an unexpected response.');
  const ts = nowIso();
  const out: RecordDraft[] = [];
  for (const id of ids) {
    const item = ESummaryItem.safeParse(raw.result[id]);
    if (!item.success || item.data.uid !== id) continue;
    const x = item.data;
    const doi = x.articleids?.find((a) => a.idtype === 'doi')?.value;
    const pmc = x.articleids?.find((a) => a.idtype === 'pmc')?.value;
    const pt = (x.pubtype ?? []).join('; ');
    const guideline = /guideline/i.test(pt);
    out.push({
      provider: 'PubMed',
      sourceType: guideline ? 'GUIDELINE' : 'LITERATURE',
      tier: guideline ? 2 : 3,
      title: x.title.replace(/\.$/, ''),
      identifier: x.uid,
      identifierType: 'PMID',
      alternateIdentifiers: [doi, pmc].filter((v): v is string => !!v),
      url: `https://pubmed.ncbi.nlm.nih.gov/${x.uid}/`,
      authors: x.authors?.slice(0, 3).map((a) => a.name).join(', ') + ((x.authors?.length ?? 0) > 3 ? ' et al.' : ''),
      journal: x.source,
      publishedAt: x.pubdate,
      retrievedAt: ts,
      relevance: 'MEDIUM',
      extra: pt ? { publicationTypes: pt } : undefined,
      responseValidated: true,
    });
  }
  return out;
}

// ---------------------------------------------------------------- Europe PMC
const EpmcSearch = z.object({
  resultList: z.object({
    result: z.array(
      z.object({
        id: z.string(),
        source: z.string(),
        pmid: z.string().regex(/^\d+$/).optional(),
        pmcid: z.string().optional(),
        doi: z.string().optional(),
        title: z.string().min(1),
        authorString: z.string().optional(),
        journalTitle: z.string().optional(),
        firstPublicationDate: z.string().optional(),
        pubType: z.string().optional(),
      }),
    ),
  }),
});
export async function europePmcSearch(terms: string[], max = 5): Promise<RecordDraft[]> {
  const query = terms.map((t) => `"${t}"`).join(' AND ');
  const r = EpmcSearch.safeParse(await getJson(`https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${enc(query)}&format=json&pageSize=${max}&resultType=lite`));
  if (!r.success) throw new ProviderError('INVALID_RESPONSE', 'Europe PMC returned an unexpected response.');
  const ts = nowIso();
  return r.data.resultList.result.map((x) => {
    const id = x.pmid ?? x.doi ?? `${x.source}:${x.id}`;
    const guideline = /guideline/i.test(x.pubType ?? '');
    return {
      provider: 'Europe PMC',
      sourceType: guideline ? ('GUIDELINE' as const) : ('LITERATURE' as const),
      tier: guideline ? 2 : 3,
      title: x.title.replace(/\.$/, ''),
      identifier: id,
      identifierType: x.pmid ? ('PMID' as const) : x.doi ? ('DOI' as const) : ('URL' as const),
      alternateIdentifiers: [x.doi, x.pmcid].filter((v): v is string => !!v && v !== id),
      url: x.pmid ? `https://europepmc.org/article/MED/${x.pmid}` : `https://europepmc.org/article/${x.source}/${x.id}`,
      authors: x.authorString,
      journal: x.journalTitle,
      publishedAt: x.firstPublicationDate,
      retrievedAt: ts,
      relevance: 'MEDIUM' as const,
      extra: x.pubType ? { publicationTypes: x.pubType } : undefined,
      responseValidated: true as const,
    };
  });
}

// ---------------------------------------------------------------- MedlinePlus (patient education, XML)
export async function medlinePlusTopics(term: string, max = 2): Promise<RecordDraft[]> {
  const { status, body } = await getText(`https://wsearch.nlm.nih.gov/ws/query?db=healthTopics&term=${enc(term)}&retmax=${max}`);
  if (status !== 200 || !body.includes('<nlmSearchResult')) throw new ProviderError('INVALID_RESPONSE', 'MedlinePlus returned an unexpected response.');
  const ts = nowIso();
  const out: RecordDraft[] = [];
  const docRe = /<document[^>]*url="([^"]+)"[^>]*>([\s\S]*?)<\/document>/g;
  let m: RegExpExecArray | null;
  while ((m = docRe.exec(body))) {
    const url = m[1];
    if (!/^https:\/\/medlineplus\.gov\//.test(url)) continue; // only MedlinePlus pages
    const title = stripTags(m[2].match(/<content name="title">([\s\S]*?)<\/content>/)?.[1] ?? '');
    const summary = stripTags(m[2].match(/<content name="FullSummary">([\s\S]*?)<\/content>/)?.[1] ?? '');
    if (!title) continue;
    out.push({
      provider: 'MedlinePlus',
      sourceType: 'PATIENT_EDUCATION',
      tier: 4,
      title,
      identifier: url,
      identifierType: 'URL',
      alternateIdentifiers: [],
      url,
      retrievedAt: ts,
      relevance: 'MEDIUM',
      excerpt: clip(summary, 400),
      extra: { attribution: 'Source: MedlinePlus.gov' },
      responseValidated: true,
    });
  }
  return out;
}

// ---------------------------------------------------------------- clinician-request-only sources
const CtgStudies = z.object({
  studies: z.array(
    z.object({
      protocolSection: z.object({
        identificationModule: z.object({ nctId: z.string().regex(/^NCT\d{8}$/), briefTitle: z.string() }),
        statusModule: z.object({ overallStatus: z.string().optional() }).optional(),
        conditionsModule: z.object({ conditions: z.array(z.string()).optional() }).optional(),
        armsInterventionsModule: z.object({ interventions: z.array(z.object({ name: z.string() })).optional() }).optional(),
        contactsLocationsModule: z.object({ locations: z.array(z.object({ country: z.string().optional() })).optional() }).optional(),
      }),
    }),
  ),
});
export async function clinicalTrials(term: string): Promise<RecordDraft[]> {
  const r = CtgStudies.safeParse(
    await getJson(`https://clinicaltrials.gov/api/v2/studies?query.cond=${enc(term)}&pageSize=5&fields=NCTId,BriefTitle,OverallStatus,Condition,InterventionName,LocationCountry`),
  );
  if (!r.success) throw new ProviderError('INVALID_RESPONSE', 'ClinicalTrials.gov returned an unexpected response.');
  const ts = nowIso();
  return r.data.studies.map((s) => {
    const p = s.protocolSection;
    const countries = Array.from(new Set((p.contactsLocationsModule?.locations ?? []).map((l) => l.country).filter(Boolean))).slice(0, 4);
    return {
      provider: 'ClinicalTrials.gov',
      sourceType: 'CLINICAL_TRIAL' as const,
      tier: 1,
      title: p.identificationModule.briefTitle,
      identifier: p.identificationModule.nctId,
      identifierType: 'NCT' as const,
      alternateIdentifiers: [],
      url: `https://clinicaltrials.gov/study/${p.identificationModule.nctId}`,
      retrievedAt: ts,
      relevance: 'LOW' as const,
      extra: {
        status: p.statusModule?.overallStatus ?? 'unknown',
        conditions: (p.conditionsModule?.conditions ?? []).slice(0, 3).join(', '),
        interventions: (p.armsInterventionsModule?.interventions ?? []).slice(0, 3).map((i) => i.name).join(', '),
        locations: countries.join(', '),
        note: 'Registry record — not evidence of efficacy',
      },
      responseValidated: true as const,
    };
  });
}

const PubChemProps = z.object({
  PropertyTable: z.object({ Properties: z.array(z.object({ CID: z.number().int(), MolecularFormula: z.string().optional(), IUPACName: z.string().optional(), MolecularWeight: z.union([z.string(), z.number()]).optional() })) }),
});
export async function pubchemCompound(name: string): Promise<RecordDraft[]> {
  let raw: unknown;
  try {
    raw = await getJson(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${enc(name)}/property/MolecularFormula,IUPACName,MolecularWeight/JSON`);
  } catch (e) {
    if (e instanceof ProviderError && (e.kind === 'NO_RESULTS' || e.kind === 'HTTP')) return [];
    throw e;
  }
  const r = PubChemProps.safeParse(raw);
  if (!r.success) throw new ProviderError('INVALID_RESPONSE', 'PubChem returned an unexpected response.');
  const ts = nowIso();
  return r.data.PropertyTable.Properties.slice(0, 1).map((p) => ({
    provider: 'PubChem',
    sourceType: 'CHEMICAL_INFORMATION' as const,
    tier: 1,
    title: `${name} — compound CID ${p.CID}`,
    identifier: String(p.CID),
    identifierType: 'CID' as const,
    alternateIdentifiers: [],
    url: `https://pubchem.ncbi.nlm.nih.gov/compound/${p.CID}`,
    retrievedAt: ts,
    relevance: 'LOW' as const,
    extra: { formula: p.MolecularFormula ?? '', weight: String(p.MolecularWeight ?? ''), note: 'Reference data — not patient-specific guidance' },
    responseValidated: true as const,
  }));
}

const ClinTables = z.tuple([z.number(), z.array(z.string()), z.unknown(), z.array(z.array(z.string()))]);
/** NLM Clinical Tables condition autocomplete — terminology help for manual search, never a diagnosis. */
export async function conditionSuggestions(prefix: string): Promise<string[]> {
  if (prefix.trim().length < 3) return [];
  const r = ClinTables.safeParse(await getJson(`https://clinicaltables.nlm.nih.gov/api/conditions/v3/search?terms=${enc(prefix.trim())}&df=primary_name&maxList=6`, 6000));
  if (!r.success) return [];
  return r.data[3].map((x) => x[0]).filter(Boolean);
}
