/**
 * @jest-environment node
 */
/**
 * LIVE provider check against the free public APIs (no credentials). Opt-in: LIVE_EVIDENCE=1 npx jest live.
 * Skipped in CI (CI uses mock providers). Queries are generic clinical terms only — no patient data.
 * Every record must carry title, source, identifier, URL and retrieval timestamp; nothing is fabricated.
 */
import type { RecordDraft } from '../providers/evidence/adapters';
import {
  clinicalTrials,
  conditionSuggestions,
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
} from '../providers/evidence/adapters';
import { setFetch, type FetchLike } from '../providers/evidence/http';
import { request } from 'node:https';

/** Real network fetch for this opt-in test (jest-expo mocks the global fetch). */
const nodeFetch: FetchLike = (url, init) =>
  new Promise((resolve, reject) => {
    const req = request(url, { headers: { 'User-Agent': 'clinnote-live-check', ...(init?.headers ?? {}) } }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        nodeFetch(new URL(res.headers.location, url).toString(), init).then(resolve, reject);
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        const status = res.statusCode ?? 0;
        resolve({ status, ok: status >= 200 && status < 300, text: async () => body });
      });
    });
    req.on('error', reject);
    init?.signal?.addEventListener('abort', () => req.destroy(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    req.end();
  });

const live = process.env.LIVE_EVIDENCE === '1' ? describe : describe.skip;
jest.setTimeout(60000);

function check(name: string, recs: RecordDraft[]) {
  for (const r of recs) {
    expect(r.title).toBeTruthy();
    expect(r.provider).toBeTruthy();
    expect(r.identifier).toBeTruthy();
    expect(r.url).toMatch(/^https:\/\//);
    expect(Number.isNaN(Date.parse(r.retrievedAt))).toBe(false);
  }
  console.log(`${name}: ${recs.length} record(s)${recs[0] ? ` · e.g. ${recs[0].identifierType} ${recs[0].identifier} · ${recs[0].url}` : ''}`);
}

live('live free public evidence sources', () => {
  beforeAll(() => setFetch(nodeFetch));
  let rxcui = '';
  let products: string[] = [];

  test('RxNorm normalization (metformin)', async () => {
    const r = await rxnormNormalize('metformin');
    expect(r.exact?.rxcui).toMatch(/^\d+$/);
    rxcui = r.exact!.rxcui;
    products = await rxnormProducts(rxcui);
    expect(products.length).toBeGreaterThan(1);
    console.log(`RxNorm: metformin → RxCUI ${rxcui}; ${products.length} product RxCUIs`);
  });
  test('DailyMed labels', async () => check('DailyMed', await dailymedLabels(rxcui)));
  test('openFDA drug label', async () => check('openFDA label', await openfdaLabel(products)));
  test('Drugs@FDA', async () => check('Drugs@FDA', await drugsAtFda(products)));
  test('openFDA recalls (may legitimately be empty)', async () => check('openFDA recalls', await openfdaRecalls(products)));
  test('PubMed', async () => {
    const r = await pubmedSearch(['chronic cough']);
    expect(r.length).toBeGreaterThan(0);
    for (const x of r) expect(x.identifierType).toBe('PMID');
    check('PubMed', r);
  });
  test('Europe PMC', async () => check('Europe PMC', await europePmcSearch(['chronic cough'])));
  test('MedlinePlus', async () => {
    const r = await medlinePlusTopics('cough');
    expect(r.every((x) => x.url.startsWith('https://medlineplus.gov/'))).toBe(true);
    check('MedlinePlus', r);
  });
  test('ClinicalTrials.gov', async () => {
    const r = await clinicalTrials('chronic cough');
    for (const x of r) expect(x.identifier).toMatch(/^NCT\d{8}$/);
    check('ClinicalTrials.gov', r);
  });
  test('PubChem', async () => check('PubChem', await pubchemCompound('metformin')));
  test('NLM Clinical Tables (autocomplete)', async () => {
    const s = await conditionSuggestions('diab');
    expect(s.length).toBeGreaterThan(0);
    console.log(`Clinical Tables: ${s.length} suggestion(s), e.g. ${s[0]}`);
  });
});
