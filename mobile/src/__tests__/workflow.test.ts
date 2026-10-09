/**
 * End-to-end workflow (owner checklist §6/§28) through the real application services with mock providers and
 * synthetic data only: create patient → visit → consent → record (demo script) → stop → transcript → speaker
 * roles → extraction → profile update → timeline → medications → evidence → possibilities (R2 flag on, dev) →
 * review → note → edit → finalize → save → reopen (restart) → second visit → compare → export → offline.
 * DEMO DATA — NOT A REAL PATIENT.
 */
import { DEMO_VISIT_1, DEMO_VISIT_2 } from '../application/demo';
import { EvidenceService } from '../application/evidenceService';
import { JOB_CANDIDATES, JOB_EXTRACTION, VisitService } from '../application/visitService';
import { compareVisits } from '../domain/diff';
import { DRAFT_EXPORT_LABEL, exportNote, exportPatientSummary } from '../domain/export';
import { confirmFact, editFact, isCurrent } from '../domain/facts';
import { addNoteVersion, finalizeNote } from '../domain/note';
import { addProblemFromFact } from '../domain/problems';
import { searchLocal } from '../domain/search';
import { patientTimeline, symptomCourse } from '../domain/timeline';
import { correctSegment, parseTimestamp, segmentIndexAt } from '../domain/transcript';
import type { AppSettings, Patient, Visit } from '../domain/types';
import { allergyStatus, currentMedications, pendingFollowUps } from '../domain/views';
import { ClinicalStore, DEFAULT_SETTINGS } from '../infrastructure/storage/clinicalStore';
import { DocumentCipher } from '../infrastructure/storage/crypto';
import { MemoryFileBackend } from '../infrastructure/storage/fileBackend';
import { MockBackend, type ExecutionInfo } from '../providers/backend';
import { setFetch, setSleep } from '../providers/evidence/http';

const rnd = (n: number) => Uint8Array.from({ length: n }, () => Math.floor(Math.random() * 256));
const settings: AppSettings = { ...DEFAULT_SETTINGS, cloudProcessingEnabled: true, devPossibilitiesEnabled: true };
const SETID = '00000000-0000-4000-8000-000000000001';

/** Public-source fixtures (synthetic payloads in the providers' documented shapes). */
function publicSources() {
  const map: Record<string, unknown> = {
    'rxcui.json?name=metformin': { idGroup: { rxnormId: ['6809'] } },
    'rxcui.json?name=atorvastatin': { idGroup: { rxnormId: ['83367'] } },
    'related.json': { relatedGroup: { conceptGroup: [{ conceptProperties: [{ rxcui: '861007', name: 'metformin 500 MG Oral Tablet' }] }] } },
    'spls.json': { data: [{ setid: SETID, title: 'METFORMIN HYDROCHLORIDE tablet [Synthetic Labs]', published_date: 'Jan 01, 2026' }] },
    'esearch.fcgi': { esearchresult: { idlist: ['27409075'] } },
    'esummary.fcgi': { result: { uids: ['27409075'], '27409075': { uid: '27409075', title: 'Chronic cough: a review.', pubdate: '2016', source: 'J Synthetic', authors: [{ name: 'A B' }], pubtype: ['Review'], articleids: [] } } },
  };
  const calls: string[] = [];
  setFetch(async (url: string) => {
    calls.push(url);
    const key = Object.keys(map).find((k) => url.includes(k));
    if (url.includes('wsearch.nlm.nih.gov'))
      return { status: 200, ok: true, text: async () => '<?xml version="1.0"?><nlmSearchResult><list><document rank="1" url="https://medlineplus.gov/cough.html"><content name="title">Cough</content><content name="FullSummary">&lt;p&gt;Coughing is a reflex.&lt;/p&gt;</content></document></list></nlmSearchResult>' };
    if (!key) return { status: 404, ok: false, text: async () => '{"error":{"code":"NOT_FOUND"}}' };
    return { status: 200, ok: true, text: async () => JSON.stringify(map[key]) };
  });
  return calls;
}

/** Backend double: extraction returns nothing extra; possibilities cite only what the request contained. */
class DemoBackend extends MockBackend {
  async runJob<T>(job: string, _v?: string, input?: unknown): Promise<{ output: T; execution: ExecutionInfo }> {
    const exec = { executionId: 'mock', provider: 'mock', durationMs: 1 };
    if (job === JOB_CANDIDATES) {
      const inp = input as { facts: { id: string; category: string; informationState: string; value: string }[]; evidence: { id: string }[] };
      const sup = inp.facts.find((f) => f.category === 'SYMPTOM' && f.informationState === 'POSITIVE');
      const neg = inp.facts.find((f) => f.informationState === 'NEGATIVE');
      return {
        output: { candidates: [{ topic: 'Chronic cough evaluation', reason: 'Cough lasting several weeks with reported weight loss.', supportingFactIds: [sup!.id], contradictingFactIds: neg ? [neg.id] : [], missingInformation: ['Smoking history'], evidenceIds: [inp.evidence[0].id] }] } as T,
        execution: exec,
      };
    }
    return { output: { items: [] } as T, execution: exec };
  }
}

async function record(svc: VisitService, v: Visit, lines: typeof DEMO_VISIT_1) {
  svc.recordConsent(v, 'VERBAL_ATTESTED_BY_CLINICIAN');
  svc.startRecording(v);
  lines.forEach((l, i) => svc.addLiveSegment(v, l.text, 0.95, l.role, i * 6, i * 6 + 5, 'demo-script'));
  svc.stopRecording(v, lines.length * 6);
}

beforeAll(() => setSleep(async () => undefined));

describe('complete synthetic consultation workflow', () => {
  const fs = new MemoryFileBackend();
  const key = rnd(32);
  let store: ClinicalStore;
  let svc: VisitService;
  let patient: Patient;
  let v1: Visit;
  let v2: Visit;

  test('1. create patient P-000001 (demo) and visit; recording requires consent', async () => {
    store = new ClinicalStore(fs, new DocumentCipher(key, rnd));
    svc = new VisitService(store, new DemoBackend(), new EvidenceService(store));
    patient = await store.createPatient({ age: 47, sex: 'MALE', name: 'Demo Patient (synthetic)', isDemo: true });
    expect(patient.patientReference).toBe('P-000001');
    v1 = await store.createVisit(patient.patientId, 'AMBIENT');
    expect(() => svc.startRecording(v1)).toThrow(/Consent/);
  });

  test('2. consent → record → live transcript with speaker labels → stop', async () => {
    await record(svc, v1, DEMO_VISIT_1);
    expect(v1.consent?.state).toBe('CONFIRMED');
    expect(v1.recordingState).toBe('STOPPED');
    expect(v1.segments.map((s) => s.speakerRole)).toEqual(DEMO_VISIT_1.map((l) => l.role));
    expect(v1.segments[0].displayCode).toBe('T-0001');
    expect(v1.transcriptState).toBe('COMPLETED');
    await store.saveVisit(v1);
  });

  test('3. final transcript keeps the live transcript when no audio/backend; jump-to-time works', async () => {
    const r = await svc.finalTranscription(v1, settings, null);
    expect(r.ok).toBe(true);
    expect(v1.segments.length).toBe(DEMO_VISIT_1.length);
    expect(segmentIndexAt(v1, parseTimestamp('00:13')!)).toBe(2);
  });

  test('4. extraction is blocked until roles are confirmed, then extracts the demo facts', async () => {
    const blocked = await svc.runExtraction(v1, settings, []);
    expect(blocked.ok).toBe(false);
    svc.confirmRoles(v1, {});
    const r = await svc.runExtraction(v1, settings, []);
    expect(r.ok).toBe(true);
    const cough = v1.facts.find((f) => f.conceptKey === 'cough');
    expect(cough?.informationState).toBe('POSITIVE');
    expect(cough?.provenance).toBe('PATIENT_REPORTED');
    expect(cough?.status).toBe('PROVISIONAL');
    expect(cough?.attributes.duration).toMatch(/3 weeks/); // number words normalized to digits, value unchanged
    const fever = v1.facts.find((f) => f.conceptKey === 'fever');
    expect(fever?.informationState).toBe('NEGATIVE');
    expect(v1.facts.some((f) => f.category === 'HISTORY_MEDICAL' && /diabetes/i.test(f.value))).toBe(true);
    const met = v1.facts.find((f) => f.category === 'MEDICATION' && /metformin/i.test(f.value));
    expect(met?.attributes.dose).toMatch(/500/);
    expect(v1.facts.find((f) => f.category === 'VITAL_SIGN' && f.attributes.vitalKind === 'WEIGHT')?.attributes.numericValue).toBe(72);
    // safety-net advice stays a conditional PLAN, never a present symptom
    expect(v1.facts.some((f) => /chest pain/i.test(f.value) && f.category === 'SYMPTOM' && f.informationState === 'POSITIVE')).toBe(false);
    // allergies never mentioned → no allergy fact; status line says not discussed (never NKDA)
    expect(allergyStatus([v1]).statusLine).toBe('Not discussed');
    expect(v1.facts.every((f) => f.provenance !== 'CLINICIAN_CONFIRMED' && f.provenance !== 'MEASURED')).toBe(true);
    await store.saveVisit(v1);
  });

  test('5. evidence: free public sources, every record has title, source, identifier, URL and retrieval time', async () => {
    const calls = publicSources();
    const r = await svc.runEvidence(v1, patient, settings);
    expect(['COMPLETED', 'PARTIAL']).toContain(v1.evidenceState);
    expect(r.ok).toBe(true);
    expect(v1.evidence.length).toBeGreaterThan(0);
    for (const e of v1.evidence) {
      expect(e.title).toBeTruthy();
      expect(e.provider).toBeTruthy();
      expect(e.identifier).toBeTruthy();
      expect(e.url).toMatch(/^https:\/\//);
      expect(Number.isNaN(Date.parse(e.retrievedAt))).toBe(false);
    }
    expect(v1.evidence.some((e) => e.provider === 'DailyMed' && e.identifier === SETID)).toBe(true);
    // denied fever is never searched as present; no name or reference leaves the device
    expect(calls.some((u) => /fever/i.test(u))).toBe(false);
    expect(calls.some((u) => /P-000001|Demo%20Patient|Demo Patient/i.test(u))).toBe(false);
    expect(v1.facts.find((f) => /metformin/i.test(f.value))?.attributes.rxcui).toBe('6809');
  });

  test('6. possibilities (R2, flag on in dev) cite bundle evidence and stay provisional', async () => {
    const r = await svc.runCandidates(v1, settings, true);
    expect(r.ok).toBe(true);
    expect(v1.candidates.length).toBe(1);
    expect(v1.candidates[0].status).toBe('PROVISIONAL');
    expect(v1.candidates[0].evidenceIds.every((id) => v1.evidence.some((e) => e.evidenceId === id))).toBe(true);
    // production build: never generated
    const prod = await svc.runCandidates(JSON.parse(JSON.stringify(v1)), settings, false);
    expect(prod.ok).toBe(false);
  });

  test('7. clinician review: confirm facts, edit keeps history, profile update needs a confirmed fact', async () => {
    const dm = v1.facts.find((f) => f.category === 'HISTORY_MEDICAL' && /diabetes/i.test(f.value))!;
    expect(() => addProblemFromFact(patient, dm)).toThrow(/Confirm/);
    confirmFact(v1, dm.factId);
    expect(dm.provenance).toBe('CLINICIAN_CONFIRMED');
    expect(dm.rootOriginProvenance).toBe('PATIENT_REPORTED');
    addProblemFromFact(patient, dm);
    await store.savePatient(patient);
    const met = v1.facts.find((f) => f.category === 'MEDICATION' && /metformin/i.test(f.value))!;
    const edited = editFact(v1, met.factId, { attributes: { takingStatus: 'CURRENT' } });
    expect(isCurrent(met)).toBe(false);
    expect(edited.attributes.dose).toBe(met.attributes.dose); // dose never silently changed
    for (const f of v1.facts.filter((x) => isCurrent(x) && x.status === 'PROVISIONAL' && ['SYMPTOM', 'VITAL_SIGN', 'INVESTIGATION', 'FOLLOW_UP'].includes(x.category))) confirmFact(v1, f.factId);
    expect(currentMedications([v1]).map((m) => m.fact.attributes.rawName ?? m.fact.value).join()).toMatch(/metformin/i);
    expect(pendingFollowUps([v1]).length).toBeGreaterThan(0);
  });

  test('8. note: draft from facts, edit, finalize (finalize ≠ confirm), save; possibilities never in the note', async () => {
    svc.draftNote(v1, patient, [v1], 'SOAP');
    const draft = v1.noteVersions[0].content;
    expect(draft).toMatch(/^DRAFT — review before finalizing/);
    expect(draft).toMatch(/Cough/i);
    expect(draft).toMatch(/No fever/);
    expect(draft).toMatch(/Allergies: not discussed/);
    expect(draft).not.toMatch(/Chronic cough evaluation/);
    addNoteVersion(v1, 'SOAP', `${draft}\nClinician addendum: synthetic demo.`, 'CLINICIAN_EDIT');
    const provisionalBefore = v1.facts.filter((f) => isCurrent(f) && f.status === 'PROVISIONAL').length;
    finalizeNote(v1, v1.noteVersions[1].content);
    expect(v1.noteState).toBe('FINALIZED');
    expect(v1.facts.filter((f) => isCurrent(f) && f.status === 'PROVISIONAL').length).toBe(provisionalBefore);
    expect(v1.unreviewedFactCountAtFinalize).toBe(provisionalBefore);
    await store.saveVisit(v1);
  });

  test('9. app restart: a new store instance reads everything back; timeline and search work', async () => {
    store = new ClinicalStore(fs, new DocumentCipher(key, rnd));
    svc = new VisitService(store, new DemoBackend(), new EvidenceService(store));
    const p = await store.getPatient(patient.patientId);
    expect(p.problems.map((x) => x.label).join()).toMatch(/diabetes/i);
    const visits = await store.listVisits(patient.patientId);
    expect(visits.length).toBe(1);
    expect(visits[0].noteState).toBe('FINALIZED');
    expect(visits[0].segments.length).toBe(DEMO_VISIT_1.length);
    const tl = patientTimeline(visits);
    expect(tl[0].events.some((e) => e.fact.conceptKey === 'cough')).toBe(true);
    expect(tl[0].events.some((e) => e.fact.category === 'ASSESSMENT' && e.fact.status !== 'CONFIRMED')).toBe(false);
    const idx = await store.listPatients();
    expect(searchLocal('P-000001', idx, {}, 'PATIENTS').length).toBe(1);
    expect(searchLocal('addendum', idx, { [patient.patientId]: visits }, 'NOTES').length).toBe(1);
    patient = p;
    v1 = visits[0];
  });

  test('10. second visit → deterministic comparison shows what changed, invents nothing', async () => {
    v2 = await store.createVisit(patient.patientId, 'AMBIENT');
    v2.startedAt = new Date(Date.parse(v1.startedAt) + 14 * 86400000).toISOString();
    await record(svc, v2, DEMO_VISIT_2);
    svc.confirmRoles(v2, {});
    await svc.runExtraction(v2, settings, [v1]);
    await store.saveVisit(v2);
    const diff = compareVisits(v1, v2);
    const text = diff.map((d) => d.text).join('\n');
    expect(text).toMatch(/cough: stated duration increased from about 3 weeks to 5 weeks/i);
    expect(text).toMatch(/Weight changed from 72 kg to 70 kg \(−2 kg\)/);
    expect(text).toMatch(/atorvastatin: newly documented this visit \(added\)/i);
    expect(text).not.toMatch(/improved|worsened|resolved|controlled/i);
    // allergies explicitly not discussed → still never NKDA
    expect(allergyStatus([v1, v2]).statusLine).not.toMatch(/No known allergies/);
    const course = symptomCourse([v1, v2]).find((c) => c.key === 'cough');
    expect(course?.entries.length).toBe(2);
  });

  test('11. export: draft marked on the note, finalized note unmarked, summary has no possibilities; each export audited', async () => {
    svc.draftNote(v2, patient, [v1, v2], 'PROGRESS');
    const d = exportNote(patient, v2);
    expect(d.isDraft).toBe(true);
    expect(d.text.startsWith(DRAFT_EXPORT_LABEL)).toBe(true);
    expect(d.html).toContain(DRAFT_EXPORT_LABEL);
    expect(d.text).toContain('DEMO DATA — NOT A REAL PATIENT');
    expect(d.text).toMatch(/Since previous visit/i);
    expect(v2.audit.some((a) => a.action === 'EXPORTED')).toBe(true);
    const f = exportNote(patient, v1);
    expect(f.isDraft).toBe(false);
    expect(f.text).not.toContain(DRAFT_EXPORT_LABEL);
    const s = exportPatientSummary(patient, [v1, v2]);
    expect(s.text).not.toMatch(/Chronic cough evaluation/);
    expect(s.text).toMatch(/diabetes/i);
    await store.saveVisit(v2);
  });

  test('12. export failure leaves data unchanged', async () => {
    const empty = await store.createVisit(patient.patientId, 'MANUAL');
    const before = JSON.stringify(empty);
    expect(() => exportNote(patient, empty)).toThrow(/no note/i);
    expect(JSON.stringify(empty)).toBe(before);
  });
});

describe('offline and failure behaviour: no data loss', () => {
  async function seeded(backend = new MockBackend({ kind: 'OFFLINE' })) {
    const store = new ClinicalStore(new MemoryFileBackend(), new DocumentCipher(rnd(32), rnd));
    const svc = new VisitService(store, backend, new EvidenceService(store));
    const patient = await store.createPatient({ age: 47, sex: 'MALE', isDemo: true });
    const v = await store.createVisit(patient.patientId, 'AMBIENT');
    await record(svc, v, DEMO_VISIT_1);
    svc.confirmRoles(v, {});
    await store.saveVisit(v);
    return { store, svc, patient, v };
  }

  test('no internet: AI and evidence report unavailable; patients, visits, timeline, notes, search and export work', async () => {
    setFetch(async () => {
      throw new TypeError('Network request failed');
    });
    const { store, svc, patient, v } = await seeded();
    const ex = await svc.runExtraction(v, settings, []);
    expect(ex.message).toMatch(/No internet connection/);
    expect(v.facts.length).toBeGreaterThan(0); // rule-based extraction is on-device
    const ev = await svc.runEvidence(v, patient, settings);
    expect(ev.ok).toBe(false);
    expect(v.evidenceState).toBe('FAILED');
    expect(v.evidence.length).toBe(0); // nothing fabricated
    svc.draftNote(v, patient, [v], 'SOAP');
    addNoteVersion(v, 'SOAP', `${v.noteVersions[0].content}\nedited offline`, 'CLINICIAN_EDIT');
    await store.saveVisit(v);
    const back = await store.getVisit(patient.patientId, v.visitId);
    expect(back.noteVersions.length).toBe(2);
    expect(patientTimeline([back])[0].events.length).toBeGreaterThan(0);
    expect(searchLocal('offline', await store.listPatients(), { [patient.patientId]: [back] }, 'NOTES').length).toBe(1);
    expect(exportNote(patient, back).text).toContain('edited offline');
  });

  test('malformed AI JSON is rejected; rule-based facts and transcript remain', async () => {
    const { svc, v } = await seeded(new MockBackend({ jobOutputs: { [JOB_EXTRACTION]: { items: 'not-an-array', extra: true } } }));
    const r = await svc.runExtraction(v, settings, []);
    expect(r.message).toMatch(/could not be validated/);
    expect(v.executions.some((e) => e.outcome === 'VALIDATION_FAILED')).toBe(true);
    expect(v.segments.length).toBe(DEMO_VISIT_1.length);
    expect(v.facts.length).toBeGreaterThan(0);
  });

  test('speech/transcription failure keeps the live transcript', async () => {
    const { svc, v } = await seeded(new MockBackend({ kind: 'UNAVAILABLE' }));
    const r = await svc.finalTranscription(v, settings, 'file:///synthetic.wav');
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/live transcript is kept/);
    expect(v.segments.length).toBe(DEMO_VISIT_1.length);
  });

  test('recording interrupted / app restart: unfinished visit is found with its saved segments', async () => {
    const store = new ClinicalStore(new MemoryFileBackend(), new DocumentCipher(rnd(32), rnd));
    const svc = new VisitService(store, new MockBackend(), new EvidenceService(store));
    const p = await store.createPatient({ isDemo: true });
    const v = await store.createVisit(p.patientId, 'AMBIENT');
    svc.recordConsent(v, 'VERBAL_ATTESTED_BY_CLINICIAN');
    svc.startRecording(v);
    svc.addLiveSegment(v, 'I have had a cough for two weeks.', 0.9, 'PATIENT', 0, 3);
    await store.saveVisit(v); // saved per segment by the recording screen; then the process dies
    const unfinished = await store.findUnfinishedVisits();
    expect(unfinished.length).toBe(1);
    expect(unfinished[0].segments[0].text).toMatch(/cough/);
  });

  test('transcript correction returns dependent facts to review (SOURCE_CHANGED), never silently edits them', async () => {
    const { svc, v } = await seeded(new MockBackend({ kind: 'NOT_CONFIGURED' }));
    await svc.runExtraction(v, settings, []);
    const fever = v.facts.find((f) => f.conceptKey === 'fever')!;
    confirmFact(v, fever.factId);
    const n = correctSegment(v, fever.sourceSegmentIds[0], { text: "No, I don't have any fever at all." });
    expect(n).toBeGreaterThan(0);
    expect(fever.status).toBe('CONFIRMED');
    expect(fever.clarificationReason).toBe('SOURCE_CHANGED');
    expect(fever.informationState).toBe('NEGATIVE');
  });
});
