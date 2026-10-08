/**
 * Integration tests with mock providers: provider failure (owner test #75), free quota exhausted (#76),
 * R2 gating (CS-37), AI output validation, evidence adapters with fixtures (CS-11, CS-16a, CS-17).
 */
import { EvidenceService } from '../application/evidenceService';
import { JOB_CANDIDATES, JOB_EXTRACTION, VisitService } from '../application/visitService';
import type { AppSettings } from '../domain/types';
import { ClinicalStore, DEFAULT_SETTINGS } from '../infrastructure/storage/clinicalStore';
import { DocumentCipher } from '../infrastructure/storage/crypto';
import { MemoryFileBackend } from '../infrastructure/storage/fileBackend';
import { MockBackend } from '../providers/backend';
import { medlinePlusTopics, openfdaLabel, pubmedSearch, rxnormNormalize } from '../providers/evidence/adapters';
import { ProviderError, setFetch, setSleep } from '../providers/evidence/http';

const rnd = (n: number) => Uint8Array.from({ length: n }, () => Math.floor(Math.random() * 256));

async function setup(backend: MockBackend) {
  const store = new ClinicalStore(new MemoryFileBackend(), new DocumentCipher(rnd(32), rnd));
  const evidence = new EvidenceService(store);
  const svc = new VisitService(store, backend, evidence);
  const patient = await store.createPatient({ age: 47, sex: 'MALE', isDemo: true });
  const v = await store.createVisit(patient.patientId, 'AMBIENT');
  svc.recordConsent(v, 'VERBAL_ATTESTED_BY_CLINICIAN');
  svc.addLiveSegment(v, "I've had a cough for three weeks, worse at night.", 0.9, 'PATIENT', 1, 4);
  svc.addLiveSegment(v, 'Patient denies fever.', 0.9, 'DOCTOR', 5, 7);
  svc.confirmRoles(v, {});
  return { store, svc, patient, v };
}

const settings: AppSettings = { ...DEFAULT_SETTINGS, cloudProcessingEnabled: true };

beforeAll(() => setSleep(async () => undefined));

describe('provider failure keeps every piece of data (owner tests #75, #76)', () => {
  test('Gemini unavailable: transcript, facts and manual note remain; message shown', async () => {
    const { store, svc, patient, v } = await setup(new MockBackend({ kind: 'UNAVAILABLE' }));
    const t = await svc.finalTranscription(v, settings, 'file:///audio.wav');
    expect(t.ok).toBe(false);
    expect(v.segments.length).toBe(2); // live transcript kept
    expect(v.transcriptSource).toBe('LIVE_DEVICE');
    const r = await svc.runExtraction(v, settings, []);
    expect(r.message).toMatch(/unavailable/i);
    expect(v.clinicalExtractionState).toBe('PARTIAL');
    expect(v.facts.find((f) => f.conceptKey === 'cough')).toBeTruthy(); // rule-based facts still there
    svc.draftNote(v, patient, [v], 'SOAP');
    await store.saveVisit(v);
    const reloaded = await store.getVisit(patient.patientId, v.visitId);
    expect(reloaded.segments.length).toBe(2);
    expect(reloaded.noteVersions.length).toBe(1);
    expect(reloaded.executions.some((e) => e.outcome === 'UNAVAILABLE')).toBe(true);
  });

  test('free quota exhausted: no retry, no paid fallback, clear message, nothing lost', async () => {
    const backend = new MockBackend({ kind: 'QUOTA_EXHAUSTED' });
    const spy = jest.spyOn(backend, 'runJob');
    const { svc, v } = await setup(backend);
    const r = await svc.runExtraction(v, settings, []);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(r.message).toContain('Free AI quota is currently unavailable. Your saved transcript and notes remain available.');
    expect(v.facts.length).toBeGreaterThan(0);
    expect(v.executions.map((e) => e.outcome)).toContain('QUOTA_EXHAUSTED');
  });

  test('cloud processing off: nothing is sent', async () => {
    const backend = new MockBackend({ jobOutputs: {} });
    const spy = jest.spyOn(backend, 'runJob');
    const { svc, v, patient } = await setup(backend);
    await svc.runExtraction(v, { ...settings, cloudProcessingEnabled: false }, []);
    const e = await svc.runEvidence(v, patient, { ...settings, cloudProcessingEnabled: false });
    expect(spy).not.toHaveBeenCalled();
    expect(e.ok).toBe(false);
    expect(v.evidenceState).toBe('SKIPPED');
  });
});

describe('AI extraction output is validated, never trusted', () => {
  test('grounded AI items are merged; invented diagnosis and provenance claims are discarded', async () => {
    const backend = new MockBackend({
      jobOutputs: {
        [JOB_EXTRACTION]: {
          items: [
            { category: 'SYMPTOM', value: 'cough for three weeks', informationState: 'POSITIVE', sourceSegmentIds: ['__SEG0__'], derivationMethod: 'VERBATIM_EXTRACTION', confidence: 'HIGH', needsClarification: false, attributes: { duration: 'three weeks' } },
            { category: 'ASSESSMENT', value: 'tuberculosis likely', informationState: 'POSITIVE', sourceSegmentIds: ['__SEG0__'], derivationMethod: 'AI_INFERENCE', confidence: 'HIGH', needsClarification: false, attributes: {} },
          ],
        },
      },
    });
    const { svc, v } = await setup(backend);
    const out = backend.behaviour.jobOutputs![JOB_EXTRACTION] as { items: { sourceSegmentIds: string[] }[] };
    for (const it of out.items) it.sourceSegmentIds = [v.segments[0].segmentId];
    await svc.runExtraction(v, settings, []);
    expect(v.facts.some((f) => /tuberculosis/i.test(f.value))).toBe(false);
    expect(v.discarded.length).toBeGreaterThan(0);
    expect(v.facts.every((f) => f.status === 'PROVISIONAL')).toBe(true);
    expect(v.clinicalExtractionState).toBe('COMPLETED');
  });
});

describe('R2 possibilities gate (CS-37, ADR-034)', () => {
  test('flag off → SKIPPED, no AI call', async () => {
    const backend = new MockBackend({});
    const spy = jest.spyOn(backend, 'runJob');
    const { svc, v } = await setup(backend);
    const r = await svc.runCandidates(v, { ...settings, devPossibilitiesEnabled: true }, false);
    expect(r.ok).toBe(false);
    expect(v.candidateState).toBe('SKIPPED');
    expect(spy).not.toHaveBeenCalled();
  });

  test('flag on but no citable evidence → SKIPPED with reason (never from facts alone)', async () => {
    const backend = new MockBackend({});
    const spy = jest.spyOn(backend, 'runJob');
    const { svc, v } = await setup(backend);
    v.evidenceState = 'COMPLETED';
    const r = await svc.runCandidates(v, { ...settings, devPossibilitiesEnabled: true }, true);
    expect(r.message).toMatch(/no evidence retrieved/);
    expect(spy).not.toHaveBeenCalled();
  });

  test('flag on with evidence: only candidates citing bundle evidence and real facts survive', async () => {
    const backend = new MockBackend({});
    const { svc, v } = await setup(backend);
    await svc.runExtraction(v, { ...settings, cloudProcessingEnabled: false }, []);
    v.evidenceState = 'COMPLETED';
    v.evidence.push({ evidenceId: 'E1', queryId: 'q', provider: 'PubMed', sourceType: 'LITERATURE', tier: 3, title: 't', identifier: '123', identifierType: 'PMID', alternateIdentifiers: [], url: 'u', retrievedAt: '', relevance: 'MEDIUM', retrievedFor: 'cough', responseValidated: true, factsChangedSinceRetrieval: false, citable: true, sourceFactIds: [] });
    const cough = v.facts.find((f) => f.conceptKey === 'cough')!;
    const fever = v.facts.find((f) => f.conceptKey === 'fever')!;
    backend.behaviour.jobOutputs = {
      [JOB_CANDIDATES]: {
        candidates: [
          { topic: 'Chronic cough causes', reason: 'Cough for three weeks.', supportingFactIds: [cough.factId], contradictingFactIds: [], missingInformation: ['Smoking history?'], evidenceIds: ['E1'] },
          { topic: 'Pneumonia', reason: 'Fever present.', supportingFactIds: [fever.factId], contradictingFactIds: [], missingInformation: [], evidenceIds: ['E1'] }, // NEGATIVE as supporting → rejected
          { topic: 'Asthma 80% likely', reason: 'x', supportingFactIds: [cough.factId], contradictingFactIds: [], missingInformation: [], evidenceIds: ['E1'] }, // probability → rejected
          { topic: 'Bronchitis', reason: 'x', supportingFactIds: [cough.factId], contradictingFactIds: [], missingInformation: [], evidenceIds: ['PMID-FAKE'] }, // citation outside bundle → rejected
        ],
      },
    };
    const r = await svc.runCandidates(v, { ...settings, devPossibilitiesEnabled: true }, true);
    expect(v.candidates.map((c) => c.topic)).toEqual(['Chronic cough causes']);
    expect(v.candidates[0].status).toBe('PROVISIONAL');
    expect(r.message).toMatch(/3 generated item/);
  });
});

describe('evidence adapters with fixtures (no network)', () => {
  const respond = (map: Record<string, { status?: number; body: string }>) =>
    setFetch(async (url: string) => {
      const key = Object.keys(map).find((k) => url.includes(k));
      const r = key ? map[key] : { status: 404, body: '{}' };
      return { status: r.status ?? 200, ok: (r.status ?? 200) < 400, text: async () => r.body };
    });

  test('CS-16a: a PMID that does not re-resolve is dropped', async () => {
    respond({
      'esearch.fcgi': { body: JSON.stringify({ esearchresult: { idlist: ['27409075', '99999999999'] } }) },
      'esummary.fcgi': { body: JSON.stringify({ result: { uids: ['27409075', '99999999999'], '27409075': { uid: '27409075', title: 'Chronic cough review.', pubdate: '2016', source: 'J', authors: [{ name: 'A B' }], pubtype: ['Review'], articleids: [{ idtype: 'doi', value: '10.1/x' }] }, '99999999999': { uid: '99999999999', error: 'cannot get document summary' } } }) },
    });
    const r = await pubmedSearch(['chronic cough']);
    expect(r.map((x) => x.identifier)).toEqual(['27409075']);
    expect(r[0].url).toBe('https://pubmed.ncbi.nlm.nih.gov/27409075/');
    expect(r[0].alternateIdentifiers).toContain('10.1/x');
  });

  test('CS-17: malformed openFDA payload is rejected', async () => {
    respond({ 'api.fda.gov/drug/label': { body: JSON.stringify({ results: [{ set_id: 'not-a-uuid' }] }) } });
    await expect(openfdaLabel(['861007'])).rejects.toBeInstanceOf(ProviderError);
  });

  test('CS-11: several RxNorm candidates → no automatic choice', async () => {
    respond({
      'rxcui.json': { body: JSON.stringify({ idGroup: {} }) },
      'approximateTerm.json': { body: JSON.stringify({ approximateGroup: { candidate: [{ rxcui: '1', name: 'drug a', source: 'RXNORM' }, { rxcui: '2', name: 'drug b', source: 'RXNORM' }] } }) },
    });
    const r = await rxnormNormalize('drugx');
    expect(r.exact).toBeNull();
    expect(r.candidates.length).toBe(2);
  });

  test('MedlinePlus results keep attribution and only medlineplus.gov URLs', async () => {
    respond({
      'wsearch.nlm.nih.gov': {
        body: '<?xml version="1.0"?><nlmSearchResult><list><document rank="1" url="https://medlineplus.gov/cough.html"><content name="title">&lt;span class="qt0"&gt;Cough&lt;/span&gt;</content><content name="FullSummary">&lt;p&gt;Coughing is a reflex.&lt;/p&gt;</content></document><document rank="2" url="https://example.com/x"><content name="title">X</content></document></list></nlmSearchResult>',
      },
    });
    const r = await medlinePlusTopics('cough');
    expect(r.length).toBe(1);
    expect(r[0].title).toBe('Cough');
    expect(r[0].extra?.attribution).toBe('Source: MedlinePlus.gov');
  });
});
