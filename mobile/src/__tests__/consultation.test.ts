/**
 * Multi-segment consultations, reconciliation and the structured report (ADR-050/051/052). Synthetic data only.
 * DEMO DATA — NOT A REAL PATIENT.
 */
import { DEMO_VISIT_1, DEMO_VISIT_1_MORE } from '../application/demo';
import { EvidenceService } from '../application/evidenceService';
import { VisitService } from '../application/visitService';
import {
  activeRecordingSegment,
  appendUtterance,
  canonicalTranscript,
  consultationPhase,
  migrateVisit,
  needsReconciliation,
  PHASE_ACTIONS,
} from '../domain/consultation';
import { exportReport, REPORT_EXPORT_SCHEMA } from '../domain/export';
import { confirmFact, isCurrent, resolveConflict } from '../domain/facts';
import { autoDetectLocales, resolveLanguages } from '../domain/languages';
import { addReportVersion, buildClinicalReport, renderReportText } from '../domain/report';
import { buildReminders } from '../domain/reminders';
import { addManualSegment, correctSegment, excludeSegment, markSegmentUncertain, mergeWithNext, restoreSegment, splitSegment } from '../domain/transcript';
import type { AppSettings, Patient, SpeakerRole, Visit } from '../domain/types';
import { Visit as VisitSchema } from '../domain/types';
import { setClock } from '../domain/util';
import { followUpDue } from '../domain/views';
import { ClinicalStore, DEFAULT_SETTINGS } from '../infrastructure/storage/clinicalStore';
import { DocumentCipher } from '../infrastructure/storage/crypto';
import { MemoryFileBackend } from '../infrastructure/storage/fileBackend';
import { MockBackend } from '../providers/backend';

const rnd = (n: number) => Uint8Array.from({ length: n }, () => Math.floor(Math.random() * 256));
const settings: AppSettings = { ...DEFAULT_SETTINGS, cloudProcessingEnabled: true };

let now = new Date('2026-10-09T04:00:00.000Z'); // 09:30 IST
const at = (iso: string) => (now = new Date(iso));
beforeAll(() => setClock(() => now));
afterAll(() => setClock(() => new Date()));

function setup() {
  const store = new ClinicalStore(new MemoryFileBackend(), new DocumentCipher(rnd(32), rnd));
  const evidence = new EvidenceService(store);
  const svc = new VisitService(store, new MockBackend({ kind: 'NOT_CONFIGURED' }), evidence);
  return { store, svc };
}

/** Records one segment: utterances 6 s apart on the visit clock. Returns the visit clock at the end. */
function recordSegment(svc: VisitService, v: Visit, lines: { role: SpeakerRole; text: string }[], clock0: number): number {
  svc.startRecording(v);
  lines.forEach((l, i) => svc.addLiveSegment(v, l.text, 0.95, l.role, clock0 + i * 6, clock0 + i * 6 + 5, 'demo-script'));
  const end = clock0 + lines.length * 6;
  svc.stopRecording(v, end);
  return end;
}

async function newVisit(store: ClinicalStore, patient?: Partial<Patient>) {
  const p = await store.createPatient({ age: patient?.age, name: patient?.name ?? 'Demo Patient (synthetic)', sex: 'MALE', occupation: patient?.occupation, isDemo: true });
  const v = await store.createVisit(p.patientId, 'AMBIENT');
  return { p, v };
}

const extract = async (svc: VisitService, v: Visit, p: Patient, earlier: Visit[] = []) => {
  svc.confirmRoles(v, {});
  return svc.runExtraction(v, settings, earlier, p);
};

// ---------------------------------------------------------------- recording lifecycle

describe('recording segments and visit time', () => {
  test('E: pause and resume — no duplicate, no missing segment, visit start unchanged', async () => {
    const { store, svc } = setup();
    at('2026-10-09T04:00:00.000Z');
    const { v } = await newVisit(store);
    const visitStart = v.startedAt;
    svc.recordConsent(v, 'VERBAL_ATTESTED_BY_CLINICIAN');
    svc.startRecording(v);
    svc.addLiveSegment(v, 'I have had a cough for three weeks.', 0.9, 'PATIENT', 0, 4);
    at('2026-10-09T04:01:00.000Z');
    svc.pauseRecording(v, 10);
    svc.pauseRecording(v, 10); // double press
    // the recognizer's final for the same words arrives after the pause: not stored twice
    svc.addLiveSegment(v, 'I have had a cough for three weeks.', 0.9, 'PATIENT', 5, 9);
    at('2026-10-09T04:03:00.000Z');
    svc.resumeRecording(v);
    svc.resumeRecording(v);
    svc.addLiveSegment(v, 'It is worse at night.', 0.9, 'PATIENT', 11, 14);
    at('2026-10-09T04:08:00.000Z');
    svc.stopRecording(v, 20);
    svc.stopRecording(v, 20); // double press is a no-op
    expect(v.recordingSegments).toHaveLength(1);
    expect(v.segments.map((s) => s.text)).toEqual(['I have had a cough for three weeks.', 'It is worse at night.']);
    expect(v.recordingSegments[0].pauses).toEqual([{ pausedAt: '2026-10-09T04:01:00.000Z', resumedAt: '2026-10-09T04:03:00.000Z' }]);
    expect(v.startedAt).toBe(visitStart);
    expect(v.recordingSegments[0].endedAt).toBe('2026-10-09T04:08:00.000Z');
  });

  test('a kept partial is replaced by its final instead of appended twice', async () => {
    const { store, svc } = setup();
    const { v } = await newVisit(store);
    svc.recordConsent(v, 'VERBAL_ATTESTED_BY_CLINICIAN');
    svc.startRecording(v);
    svc.addLiveSegment(v, 'I have a cough', 0, 'PATIENT', 0, 2, 'android-speechrecognizer', { origin: 'PARTIAL_COMMIT' });
    svc.addLiveSegment(v, 'I have a cough for three weeks', 0.9, 'PATIENT', 2.5, 4);
    expect(v.segments).toHaveLength(1);
    expect(v.segments[0].text).toBe('I have a cough for three weeks');
    expect(v.segments[0].origin).toBe('LIVE');
  });

  test('D: finalize, then add more conversation — appended, earlier segments intact, report regenerated', async () => {
    const { store, svc } = setup();
    at('2026-10-09T04:00:00.000Z');
    const { p, v } = await newVisit(store);
    svc.recordConsent(v, 'VERBAL_ATTESTED_BY_CLINICIAN');
    const t1 = recordSegment(svc, v, DEMO_VISIT_1, 0);
    await extract(svc, v, p);
    const r1 = addReportVersion(v, buildClinicalReport({ patient: p, visit: v, allVisits: [v] }));
    svc.finalizeConsultation(v);
    expect(v.consultationState).toBe('FINALIZED');
    const seg1Texts = v.segments.map((s) => s.text);
    const factIdsBefore = v.facts.map((f) => f.factId);
    // ADD MORE CONVERSATION: reopens; finishing a segment does not finalize
    at('2026-10-09T04:14:00.000Z');
    recordSegment(svc, v, DEMO_VISIT_1_MORE, t1);
    expect(v.consultationState).toBe('OPEN');
    expect(v.recordingSegments.map((s) => s.displayCode)).toEqual(['SEG-0001', 'SEG-0002']);
    expect(v.segments.slice(0, seg1Texts.length).map((s) => s.text)).toEqual(seg1Texts);
    expect(v.facts.map((f) => f.factId)).toEqual(factIdsBefore); // nothing touched before reconciliation
    expect(needsReconciliation(v)).toBe(true);
    expect(v.speakerMappingState).toBe('PARTIAL'); // new speakers need confirmation
    expect(v.audit.some((a) => a.action === 'CONSULTATION_REOPENED')).toBe(true);
    await extract(svc, v, p);
    expect(needsReconciliation(v)).toBe(false);
    const r2 = addReportVersion(v, buildClinicalReport({ patient: p, visit: v, allVisits: [v] }));
    expect(r2.versionNumber).toBe(2);
    expect(r2.transcriptVersion).toBeGreaterThan(r1.transcriptVersion);
    expect(v.reportVersions[0].versionId).toBe(r1.versionId); // previous version kept
    // facts from both segments, in order
    const codes = new Set(v.facts.flatMap((f) => f.sourceSegmentIds).map((id) => v.segments.find((s) => s.segmentId === id)?.recordingSegmentId));
    expect(codes.size).toBe(2);
  });

  test('state machine: actions per phase; finish segment and finalize are separate', async () => {
    const { store, svc } = setup();
    const { v } = await newVisit(store);
    svc.recordConsent(v, 'VERBAL_ATTESTED_BY_CLINICIAN');
    expect(consultationPhase(v, { live: false })).toBe('IDLE');
    svc.startRecording(v);
    expect(consultationPhase(v, { live: true })).toBe('RECORDING');
    expect(PHASE_ACTIONS.RECORDING).toEqual(['PAUSE', 'FINISH_SEGMENT']);
    expect(consultationPhase(v, { live: false })).toBe('RECOVERABLE'); // app restarted mid-recording
    svc.pauseRecording(v, 3);
    expect(consultationPhase(v, { live: true })).toBe('PAUSED');
    expect(PHASE_ACTIONS.PAUSED).toEqual(['RESUME', 'FINISH_SEGMENT']);
    svc.stopRecording(v, 5);
    expect(consultationPhase(v, { live: true, justCompleted: true })).toBe('SEGMENT_COMPLETE');
    expect(PHASE_ACTIONS.SEGMENT_COMPLETE).toEqual(expect.arrayContaining(['CONTINUE', 'FINALIZE']));
    expect(consultationPhase(v, { live: false })).toBe('CONSULTATION_OPEN');
    expect(consultationPhase(v, { live: false, finalizing: true })).toBe('FINALIZING');
    expect(PHASE_ACTIONS.FINALIZING).toEqual([]);
    svc.finalizeConsultation(v);
    expect(consultationPhase(v, { live: false })).toBe('FINALIZED');
    expect(PHASE_ACTIONS.FINALIZED).toContain('ADD_MORE');
    svc.startRecording(v);
    expect(() => svc.finalizeConsultation(v)).toThrow(/Finish the current recording segment/);
  });

  test('segment and visit timestamps are stored in UTC and never reset', async () => {
    const { store, svc } = setup();
    at('2026-10-09T04:00:00.000Z');
    const { v } = await newVisit(store);
    svc.recordConsent(v, 'VERBAL_ATTESTED_BY_CLINICIAN');
    recordSegment(svc, v, [{ role: 'PATIENT', text: 'I have a cough.' }], 0);
    at('2026-10-09T04:14:00.000Z');
    svc.startRecording(v);
    at('2026-10-09T04:21:00.000Z');
    svc.stopRecording(v, 300);
    at('2026-10-09T04:26:00.000Z');
    svc.finalizeConsultation(v);
    expect(v.startedAt).toBe('2026-10-09T04:00:00.000Z');
    expect(v.recordingSegments[1].startedAt).toBe('2026-10-09T04:14:00.000Z');
    expect(v.recordingSegments[1].endedAt).toBe('2026-10-09T04:21:00.000Z');
    expect(v.consultationFinalizedAt).toBe('2026-10-09T04:26:00.000Z');
    expect(v.recordingSegments[1].clockOffsetSec).toBe(6);
  });

  test('saved and reloaded: segments, versions and report versions survive (encrypted store)', async () => {
    const { store, svc } = setup();
    const { p, v } = await newVisit(store);
    svc.recordConsent(v, 'VERBAL_ATTESTED_BY_CLINICIAN');
    recordSegment(svc, v, DEMO_VISIT_1, 0);
    await extract(svc, v, p);
    addReportVersion(v, buildClinicalReport({ patient: p, visit: v, allVisits: [v] }));
    await store.saveVisit(v);
    const back = await store.getVisit(p.patientId, v.visitId);
    expect(back.recordingSegments).toHaveLength(1);
    expect(back.reportVersions).toHaveLength(1);
    expect(back.schemaVersion).toBe(2);
  });
});

// ---------------------------------------------------------------- reconciliation cases A–C

describe('reconciliation across segments', () => {
  test('A: duration corrected in a later segment — original kept, explicit correction recognised', async () => {
    const { store, svc } = setup();
    const { p, v } = await newVisit(store);
    svc.recordConsent(v, 'VERBAL_ATTESTED_BY_CLINICIAN');
    const t = recordSegment(svc, v, [{ role: 'PATIENT', text: 'I have had a cough for two weeks.' }, { role: 'DOCTOR', text: 'Are you taking any medication?' }], 0);
    recordSegment(svc, v, [{ role: 'PATIENT', text: 'Sorry, actually the cough started three weeks ago.' }], t);
    await extract(svc, v, p);
    const coughs = v.facts.filter((f) => f.conceptKey === 'cough');
    expect(coughs).toHaveLength(2);
    const c = v.conflicts.find((x) => x.factIds.every((id) => coughs.some((f) => f.factId === id)));
    expect(c?.status).toBe('OPEN');
    expect(c?.explicitCorrection).toBe(true);
    const later = coughs.find((f) => f.attributes.duration?.includes('3'));
    expect(c?.proposedCurrentFactId).toBe(later?.factId);
    const r = buildClinicalReport({ patient: p, visit: v, allVisits: [v] });
    expect(r.presentIllness.map((x) => x.factId)).toEqual([later?.factId]); // corrected value shown …
    expect(r.presentIllness[0].flags).toContain('Corrected during consultation — pending clinician confirmation');
    const change = r.informationChanges.find((x) => x.conflictId === c?.conflictId);
    expect(change?.chronology.map((x) => x.value)).toEqual(['cough', 'cough']); // … and both statements traceable
    expect(change?.chronology[0].where).toMatch(/SEG-0001/);
    expect(change?.chronology[1].where).toMatch(/SEG-0002/);
  });

  test('A (no cue): without an explicit correction both durations stay visible as a conflict', async () => {
    const { store, svc } = setup();
    const { p, v } = await newVisit(store);
    svc.recordConsent(v, 'VERBAL_ATTESTED_BY_CLINICIAN');
    const t = recordSegment(svc, v, [{ role: 'PATIENT', text: 'I have had a cough for two weeks.' }], 0);
    recordSegment(svc, v, [{ role: 'PATIENT', text: 'The cough has been there for three weeks.' }], t);
    await extract(svc, v, p);
    const r = buildClinicalReport({ patient: p, visit: v, allVisits: [v] });
    expect(r.presentIllness).toHaveLength(2);
    expect(r.presentIllness.every((x) => x.flags.includes('Conflict — review'))).toBe(true);
  });

  test('B: fever denied, later reported — both kept; state not computed by concatenation', async () => {
    const { store, svc } = setup();
    const { p, v } = await newVisit(store);
    svc.recordConsent(v, 'VERBAL_ATTESTED_BY_CLINICIAN');
    const t = recordSegment(svc, v, [{ role: 'PATIENT', text: 'No, I do not have any fever.' }], 0);
    recordSegment(svc, v, [{ role: 'PATIENT', text: 'I have had a fever since yesterday.' }], t);
    await extract(svc, v, p);
    const fevers = v.facts.filter((f) => f.conceptKey === 'fever');
    expect(fevers.map((f) => f.informationState).sort()).toEqual(['NEGATIVE', 'POSITIVE']);
    const r = buildClinicalReport({ patient: p, visit: v, allVisits: [v] });
    const ch = r.informationChanges.find((x) => x.topic.toLowerCase() === 'fever');
    expect(ch?.status).toBe('open');
    expect(ch?.chronology.map((x) => x.state)).toEqual(['denied / absent', 'present']);
    expect(ch?.summary).toMatch(/Neither statement was overwritten/);
    expect(r.consolidatedFacts.filter((f) => /fever/i.test(f.value)).every((f) => f.conflict)).toBe(true);
  });

  test('C: medication mentioned, later reported stopped — not deleted; status change traceable', async () => {
    const { store, svc } = setup();
    const { p, v } = await newVisit(store);
    svc.recordConsent(v, 'VERBAL_ATTESTED_BY_CLINICIAN');
    const t = recordSegment(svc, v, [{ role: 'PATIENT', text: 'I take atorvastatin 20 mg at night.' }], 0);
    recordSegment(svc, v, [{ role: 'PATIENT', text: 'I stopped taking atorvastatin last month.' }], t);
    await extract(svc, v, p);
    const meds = v.facts.filter((f) => f.conceptKey === 'atorvastatin');
    expect(meds).toHaveLength(2);
    expect(meds.map((f) => f.attributes.takingStatus).sort()).toEqual(['CURRENT', 'DISCONTINUED']);
    expect(v.conflicts.some((c) => c.status === 'OPEN' && meds.every((m) => c.factIds.includes(m.factId)))).toBe(true);
    const r = buildClinicalReport({ patient: p, visit: v, allVisits: [v] });
    const all = [...r.medications.current, ...r.medications.uncertain, ...r.medications.reportedStopped];
    expect(all.length).toBe(2); // neither silently removed
    expect(r.informationChanges.some((c) => c.chronology.length === 2 && /atorvastatin/.test(c.chronology[1].value))).toBe(true);
  });

  test('manual profile age 45 vs stated 47 — conflict, profile not overwritten', async () => {
    const { store, svc } = setup();
    const { p, v } = await newVisit(store, { age: 45 });
    svc.recordConsent(v, 'VERBAL_ATTESTED_BY_CLINICIAN');
    recordSegment(svc, v, [{ role: 'DOCTOR', text: 'How old are you?' }, { role: 'PATIENT', text: 'I turned 47 recently.' }], 0);
    await extract(svc, v, p);
    const c = v.conflicts.find((x) => x.conflictType === 'PROFILE_MISMATCH');
    expect(c).toMatchObject({ profileField: 'age', profileValue: '45', status: 'OPEN' });
    const age = v.facts.find((f) => f.attributes.demographicKind === 'AGE');
    expect(age).toMatchObject({ provenance: 'PATIENT_REPORTED', status: 'PROVISIONAL' });
    expect(age?.attributes.numericValue).toBe(47);
    expect(p.age).toBe(45);
    const r = buildClinicalReport({ patient: p, visit: v, allVisits: [v] });
    expect(r.patient.find((x) => x.label === 'Age')?.value).toBe('45 years (profile) · 47 years (stated in consultation)');
    // the question alone never becomes a value; resolution keeps history
    resolveConflict(v, c!.conflictId, null, [v]);
    expect(v.facts.find((f) => f.factId === age?.factId)).toBeTruthy();
  });
});

// ---------------------------------------------------------------- report accuracy (owner Task 37)

describe('structured report from a complete synthetic consultation', () => {
  const SCRIPT: { role: SpeakerRole; text: string }[] = [
    { role: 'DOCTOR', text: 'What is your name?' },
    { role: 'PATIENT', text: 'My name is Demo Patient.' },
    { role: 'DOCTOR', text: 'How old are you?' },
    { role: 'PATIENT', text: "I'm 47." },
    { role: 'PATIENT', text: 'I work as a teacher.' },
    { role: 'PATIENT', text: 'I started coughing about three weeks ago.' },
    { role: 'DOCTOR', text: 'When is it worse?' },
    { role: 'PATIENT', text: 'The cough is worse at night.' },
    { role: 'DOCTOR', text: 'Any fever?' },
    { role: 'PATIENT', text: 'No, I do not have any fever.' },
    { role: 'PATIENT', text: "I've lost about 3 kg." },
    { role: 'PATIENT', text: 'I take metformin 500 milligrams twice daily.' },
    { role: 'PATIENT', text: 'I stopped taking atorvastatin last year.' },
    { role: 'DOCTOR', text: "We'll order a chest x-ray." },
    { role: 'DOCTOR', text: 'Come back in two weeks.' },
  ];

  async function build() {
    const { store, svc } = setup();
    at('2026-10-09T04:00:00.000Z');
    const { p, v } = await newVisit(store, { name: undefined });
    p.name = undefined;
    svc.recordConsent(v, 'VERBAL_ATTESTED_BY_CLINICIAN');
    const t = recordSegment(svc, v, SCRIPT.slice(0, 9), 0);
    recordSegment(svc, v, SCRIPT.slice(9), t);
    await extract(svc, v, p);
    return { p, v, r: buildClinicalReport({ patient: p, visit: v, allVisits: [v] }) };
  }

  test('every stated detail lands in the right section; nothing invented', async () => {
    const { v, r } = await build();
    expect(r.demo).toBe(true);
    const field = (l: string) => r.patient.find((x) => x.label === l);
    expect(field('Name')?.value).toBe('Demo Patient');
    expect(field('Name')?.source).toMatch(/Patient-reported/i);
    expect(field('Age')?.value).toBe('47 years');
    expect(field('Occupation')?.value).toBe('teacher');
    expect(field('Date of birth')?.value).toBe('Not recorded');
    expect(r.chiefComplaint?.label).toBe('Presenting complaint');
    expect(r.chiefComplaint?.value.toLowerCase()).toContain('cough');
    const hpi = r.presentIllness.map((x) => x.value.toLowerCase()).join(' | ');
    expect(hpi).toContain('3 weeks');
    expect(hpi).toContain('worse at night');
    expect(hpi).toMatch(/lost about 3 kg/);
    // fever explicitly denied → negative, never present
    expect(r.negativeFindings.map((x) => x.value.toLowerCase()).join(' ')).toContain('fever');
    expect(hpi).not.toContain('fever');
    // current vs previous medications are not confused
    expect(r.medications.current.map((m) => m.medication)).toEqual(['metformin']);
    expect(r.medications.current[0]).toMatchObject({ dose: '500 mg', frequency: 'twice daily' });
    expect(r.medications.reportedStopped.map((m) => m.medication)).toEqual(['atorvastatin']);
    // no invented allergies or examination findings
    expect(r.allergies.status).toBe('NOT_DISCUSSED');
    expect(r.allergies.statusLine).toBe('Allergies not discussed');
    expect(r.examination.positive).toEqual([]);
    expect(r.examination.negative).toEqual([]);
    expect(r.examination.status).toBe('NOT_DISCUSSED');
    expect(r.vitals).toEqual([]);
    expect(r.investigations.planned.map((i) => i.test.toLowerCase())).toEqual(['chest x-ray']);
    expect(r.plan.map((x) => x.value)).toContain("We'll order a chest x-ray");
    expect(r.followUp.map((x) => x.value)).toEqual(['Come back in 2 weeks']); // number words → digits (existing, value unchanged)
    expect(r.followUp[0].due).toBe('approx. 23 Oct 2026 (2 weeks after the visit)');
    expect(r.assessment).toEqual([]);
    // provenance from the confirmed speaker role, every fact provisional until a clinician confirms
    expect(v.facts.every((f) => f.status === 'PROVISIONAL')).toBe(true);
    expect(r.consolidatedFacts.every((f) => f.status === 'Provisional — not reviewed')).toBe(true);
    // original transcript retained in full
    expect(canonicalTranscript(v).map((s) => s.text)).toEqual(SCRIPT.map((s) => s.text));
    // only retrieved sources are cited: none were retrieved here
    expect(r.evidenceSources).toEqual([]);
    expect(r.medicationOptions.status).toBe('INSUFFICIENT_VERIFIED_EVIDENCE');
    expect(r.completeness.find((c) => c.domain === 'Allergies')?.status).toBe('NOT_DISCUSSED');
    expect(r.completeness.find((c) => c.domain === 'Examination')?.status).toBe('NOT_DISCUSSED');
    expect(r.completeness.find((c) => c.domain === 'Symptoms')?.status).toBe('PRESENT');
    const text = renderReportText(r);
    expect(text).toContain('DEMO DATA — NOT A REAL PATIENT');
    expect(text).toContain('Allergies not discussed');
    expect(text).not.toMatch(/no known allergies documented/i);
    expect(text).toContain('Not included in exports (R2 feature; CS-32).');
  });

  test('JSON export is valid, complete, and keeps source and derived data apart', async () => {
    const { p, v, r } = await build();
    const rv = addReportVersion(v, r);
    const doc = exportReport(p, v, r, rv.versionNumber);
    const j = JSON.parse(doc.json as string);
    expect(j.schema).toBe(REPORT_EXPORT_SCHEMA);
    expect(j.labels).toEqual(['DRAFT — not finalized by clinician', 'DEMO DATA — NOT A REAL PATIENT']);
    expect(j.source.transcriptSegments).toHaveLength(SCRIPT.length);
    expect(j.source.recordingSegments).toHaveLength(2);
    expect(j.source.clinicalFacts.length).toBe(v.facts.length);
    expect(j.derived.report.schema).toBe('clinnote-report@1');
    for (const k of ['patient', 'visit', 'presentIllness', 'medications', 'allergies', 'vitals', 'examination', 'investigations', 'assessment', 'plan', 'followUp', 'evidenceSources', 'longitudinal', 'informationChanges', 'uncertainties', 'review', 'completeness'])
      expect(j.derived.report).toHaveProperty(k);
    expect(JSON.stringify(j)).not.toMatch(/candidates|possibilit(y|ies) to review/i);
    expect(v.audit.some((a) => a.entityType === 'REPORT' && a.action === 'EXPORTED')).toBe(true);
  });

  test('confirmed facts and clinician edits are reflected; saving the report confirms nothing', async () => {
    const { p, v } = await build();
    const metformin = v.facts.find((f) => f.conceptKey === 'metformin')!;
    confirmFact(v, metformin.factId);
    const r = buildClinicalReport({ patient: p, visit: v, allVisits: [v] });
    expect(r.medications.current[0].status).toBe('Confirmed by clinician');
    expect(r.review.confirmedFacts).toBe(1);
    addReportVersion(v, r);
    expect(v.facts.filter((f) => isCurrent(f) && f.status === 'CONFIRMED')).toHaveLength(1);
  });
});

// ---------------------------------------------------------------- transcript review operations

describe('transcript review tools keep source evidence', () => {
  async function seeded() {
    const { store, svc } = setup();
    const { p, v } = await newVisit(store);
    svc.recordConsent(v, 'VERBAL_ATTESTED_BY_CLINICIAN');
    recordSegment(svc, v, [{ role: 'PATIENT', text: 'I have a cough. It is worse at night.' }, { role: 'PATIENT', text: 'And a headache.' }, { role: 'PATIENT', text: 'I have a cough. It is worse at night.' }], 0);
    await extract(svc, v, p);
    return { svc, p, v };
  }

  test('split, merge, exclude and restore are versioned; citing facts return to review', async () => {
    const { v } = await seeded();
    const [a, , b] = v.segments;
    const ver = v.transcriptVersion;
    const second = splitSegment(v, a.segmentId, a.text.indexOf('It is'));
    expect(a.text).toBe('I have a cough.');
    expect(second.text).toBe('It is worse at night.');
    expect(v.segmentRevisions.find((x) => x.action === 'SPLIT')?.previousText).toBe('I have a cough. It is worse at night.');
    expect(v.facts.filter((f) => f.sourceSegmentIds.includes(a.segmentId) && isCurrent(f)).every((f) => f.clarificationReason === 'SOURCE_CHANGED')).toBe(true);
    excludeSegment(v, b.segmentId, 'DUPLICATE');
    expect(canonicalTranscript(v).some((s) => s.segmentId === b.segmentId)).toBe(false);
    expect(v.segments.some((s) => s.segmentId === b.segmentId)).toBe(true); // kept as evidence
    restoreSegment(v, b.segmentId);
    expect(canonicalTranscript(v).some((s) => s.segmentId === b.segmentId)).toBe(true);
    mergeWithNext(v, a.segmentId);
    expect(a.text).toBe('I have a cough. It is worse at night.');
    expect(second.excluded?.reason).toBe('MERGED');
    expect(v.transcriptVersion).toBeGreaterThan(ver);
    expect(needsReconciliation(v)).toBe(true);
  });

  test('repeated statement is marked, not deleted; uncertain mark flags facts; manual segment is confirmed', async () => {
    const { svc, p, v } = await seeded();
    expect(v.segments[2].possibleRepeatOf).toBe(v.segments[0].segmentId);
    expect(v.segments).toHaveLength(3);
    markSegmentUncertain(v, v.segments[1].segmentId);
    const head = v.facts.find((f) => f.conceptKey === 'headache' && isCurrent(f));
    expect(head?.clarificationReason).toBe('SOURCE_CHANGED');
    const m = addManualSegment(v, { text: 'Patient denies chest pain.', role: 'DOCTOR' });
    expect(m).toMatchObject({ speakerRoleConfirmed: true, origin: 'MANUAL', sourceProvider: 'clinician-typed' });
    correctSegment(v, m.segmentId, { text: 'Patient denies chest pain or fever.' });
    expect(v.segmentRevisions.filter((x) => x.segmentId === m.segmentId).map((x) => x.action)).toEqual(['MANUAL_ADDED', 'TEXT_CORRECTED']);
    svc.confirmRoles(v, {});
    await svc.runExtraction(v, settings, [], p);
    const uncertain = v.facts.find((f) => f.conceptKey === 'headache' && isCurrent(f));
    expect(uncertain?.clarificationReason).toBe('UNCERTAIN_SPEECH');
    expect(v.facts.find((f) => f.conceptKey === 'chest pain')?.informationState).toBe('NEGATIVE');
  });
});

// ---------------------------------------------------------------- migration, languages, follow-up

describe('schema migration and language registry', () => {
  test('v1 visit migrates to one recording segment without changing data', () => {
    const raw = {
      schemaVersion: 1, visitId: 'V', visitCode: 'V-000001', patientId: 'P', startedAt: '2026-10-01T09:00:00.000Z', endedAt: '2026-10-01T09:10:00.000Z', mode: 'AMBIENT', isDemo: true,
      recordingState: 'STOPPED', recordingDurationSec: 600, transcriptState: 'COMPLETED', transcriptSource: 'LIVE_DEVICE', speakerMappingState: 'COMPLETED', speakerAssignmentUncertain: false,
      clinicalExtractionState: 'COMPLETED', evidenceState: 'NOT_STARTED', candidateState: 'NOT_STARTED', noteState: 'NONE',
      segments: [{ segmentId: 'S1', displayCode: 'T-0001', speakerId: 'Live-P', speakerRole: 'PATIENT', speakerRoleConfirmed: true, text: 'I have a cough.', startTime: 0, endTime: 3, confidence: 'HIGH', isFinal: true, editedByClinician: false, sourceProvider: 'android-speechrecognizer' }],
      facts: [], conflicts: [], discarded: [], evidenceQueries: [], evidence: [], candidates: [], noteVersions: [], executions: [], audit: [], pendingAudioUris: [], updatedAt: '2026-10-01T09:10:00.000Z',
    };
    const v = migrateVisit(VisitSchema.parse(raw));
    expect(v.schemaVersion).toBe(2);
    expect(v.recordingSegments).toHaveLength(1);
    expect(v.recordingSegments[0]).toMatchObject({ displayCode: 'SEG-0001', startedAt: '2026-10-01T09:00:00.000Z', durationSec: 600, status: 'COMPLETED' });
    expect(v.segments[0].recordingSegmentId).toBe(v.recordingSegments[0].recordingSegmentId);
    expect(v.startedAt).toBe('2026-10-01T09:00:00.000Z');
    expect(needsReconciliation(v)).toBe(false);
  });

  test('a language is enabled only when the device reports it; unknown devices keep English only', () => {
    const unknown = resolveLanguages({ locales: [], installedLocales: [], apiLevel: 31 });
    expect(unknown.filter((l) => l.enabled).map((l) => l.entry.languageCode)).toEqual(['en-US']);
    expect(unknown.find((l) => l.entry.languageCode === 'te-IN')?.reason).toMatch(/cannot be confirmed/);
    const device = { locales: ['en-US', 'hi-IN', 'te-IN'], installedLocales: ['en-US', 'hi-IN'], apiLevel: 34 };
    const res = resolveLanguages(device);
    const on = (c: string) => res.find((l) => l.entry.languageCode === c);
    expect(on('hi-IN')).toMatchObject({ enabled: true, onDevice: true });
    expect(on('te-IN')).toMatchObject({ enabled: true, onDevice: false });
    expect(on('ta-IN')?.enabled).toBe(false);
    expect(on('auto')?.enabled).toBe(true);
    expect(autoDetectLocales(device)).toEqual(['en-US', 'hi-IN']);
    expect(resolveLanguages({ ...device, apiLevel: 33 }).find((l) => l.entry.languageCode === 'auto')?.enabled).toBe(false);
  });

  test('non-English utterances keep their language and original text and are never auto-extracted', async () => {
    const { store, svc } = setup();
    const { p, v } = await newVisit(store);
    svc.recordConsent(v, 'VERBAL_ATTESTED_BY_CLINICIAN');
    svc.startRecording(v, { language: 'hi-IN' });
    // synthetic Hinglish phrase: "fever is not there" — English negation rules would misread it
    appendUtterance(v, { text: 'mujhe fever nahi hai', confidence: 0.9, role: 'PATIENT', start: 0, end: 2, sourceProvider: 'test' });
    svc.stopRecording(v, 3);
    const r = await extract(svc, v, p);
    expect(v.segments[0]).toMatchObject({ text: 'mujhe fever nahi hai', language: 'hi-IN' });
    expect(v.facts).toEqual([]);
    expect(r.message).toMatch(/not in English/);
    expect(v.recordingSegments[0].language).toBe('hi-IN');
  });

  test('follow-up due date: stated interval from the visit date, labelled approximate; never guessed', () => {
    const v = { startedAt: '2026-10-09T04:00:00.000Z' } as Visit;
    const f = { attributes: { interval: 'two weeks' } } as Visit['facts'][number];
    expect(followUpDue(f, v)).toEqual({ date: '2026-10-23', approximate: true });
    expect(followUpDue({ attributes: {} } as Visit['facts'][number], v)).toBeNull();
  });

  test('active segment helper', async () => {
    const { store, svc } = setup();
    const { v } = await newVisit(store);
    svc.recordConsent(v, 'VERBAL_ATTESTED_BY_CLINICIAN');
    expect(activeRecordingSegment(v)).toBeUndefined();
    const s = svc.startRecording(v);
    expect(svc.startRecording(v).recordingSegmentId).toBe(s.recordingSegmentId);
  });
});

describe('in-app reminders', () => {
  test('overdue and upcoming follow-ups, reconcile and open consultations are listed; nothing invented', async () => {
    const { store, svc } = setup();
    at('2026-10-01T04:00:00.000Z');
    const { p, v } = await newVisit(store);
    svc.recordConsent(v, 'VERBAL_ATTESTED_BY_CLINICIAN');
    const t = recordSegment(svc, v, [{ role: 'DOCTOR', text: 'Come back in one week.' }, { role: 'DOCTOR', text: 'Follow up in two weeks.' }], 0);
    await extract(svc, v, p);
    recordSegment(svc, v, [{ role: 'PATIENT', text: 'I also have a headache.' }], t);
    const idx = [{ patientId: p.patientId, patientReference: p.patientReference, isDemo: true, visitCount: 1, updatedAt: p.updatedAt }];
    const r = buildReminders(idx, { [p.patientId]: [v] }, '2026-10-09');
    const kinds = r.map((x) => x.kind);
    expect(kinds).toContain('FOLLOW_UP_OVERDUE'); // due 2026-10-08
    expect(kinds).toContain('FOLLOW_UP_SOON'); // due 2026-10-15
    expect(kinds).toContain('RECONCILE');
    expect(kinds).toContain('CONSULTATION_OPEN');
    expect(r[0].priority).toBeLessThanOrEqual(r[r.length - 1].priority);
    expect(r.find((x) => x.kind === 'FOLLOW_UP_OVERDUE')?.due).toBe('2026-10-08');
  });
});
