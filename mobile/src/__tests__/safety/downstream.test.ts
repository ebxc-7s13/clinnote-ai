/**
 * Clinical safety suite — conflicts, derived views, comparison, note rendering, evidence filtering.
 */
import { detectConflicts } from '../../domain/conflicts';
import { compareVisits } from '../../domain/diff';
import { buildAutomaticQueries, sanitizeTerm } from '../../domain/evidence';
import { confirmFact, editFact, rejectFact, resolveConflict, ReviewError } from '../../domain/facts';
import { finalizeNote, renderNote } from '../../domain/note';
import type { Patient } from '../../domain/types';
import { allergyStatus, currentMedications } from '../../domain/views';
import { extract, seg, visit } from '../helpers';

const P = (t: string) => seg('PATIENT', t);
const D = (t: string) => seg('DOCTOR', t);
const patient: Patient = {
  schemaVersion: 1,
  patientId: 'P',
  patientReference: 'P-900001',
  name: 'Demo Patient',
  isDemo: true,
  problems: [],
  visitIds: [],
  createdAt: '',
  updatedAt: '',
};

function v(id: string, startedAt: string, lines: ReturnType<typeof seg>[]) {
  const vis = visit({ visitId: id, visitCode: `V-${id}`, startedAt, segments: lines });
  vis.facts = extract(lines).map((f) => ({ ...f, visitId: id }));
  return vis;
}

describe('contradictions (CS-14, CS-27, CS-28)', () => {
  test('CS-27 blanket denial then specific medication: both kept, BLANKET_VS_SPECIFIC open', () => {
    const vis = v('1', '2026-10-01T09:00:00Z', [P("I don't take any medications."), P('I take metformin.')]);
    const c = detectConflicts(vis, []);
    expect(c.length).toBe(1);
    expect(c[0].conflictType).toBe('BLANKET_VS_SPECIFIC');
    expect(c[0].status).toBe('OPEN');
    expect(vis.facts.filter((f) => f.category === 'MEDICATION').length).toBe(2);
    const note = renderNote('SOAP', { patient, visit: vis, allVisits: [vis] });
    expect(note).toContain('Conflict — review');
  });

  test('CS-28 allergy contradiction keeps the positive allergy visible; never NKDA', () => {
    const vis = v('1', '2026-10-01T09:00:00Z', [P('No allergies.'), P('I am allergic to penicillin.')]);
    detectConflicts(vis, []);
    const st = allergyStatus([vis]);
    expect(st.positives.map((p) => p.fact.attributes.substance)).toContain('penicillin');
    expect(st.conflict).toBe(true);
    expect(st.statusLine).not.toBe('No known allergies');
    expect(renderNote('SOAP', { patient, visit: vis, allVisits: [vis] })).not.toMatch(/NKDA|No known allergies/);
  });

  test('CS-14 self-correction of duration: both kept, conflict open, resolution keeps history', () => {
    const vis = v('1', '2026-10-01T09:00:00Z', [P('I have had a cough for two weeks.'), P('Actually the cough is about a month.')]);
    const [c] = detectConflicts(vis, []);
    expect(c?.conflictType).toBe('SELF_CORRECTION');
    resolveConflict(vis, c.conflictId, c.proposedCurrentFactId as string, [vis]);
    expect(vis.facts.filter((f) => f.category === 'SYMPTOM').length).toBe(2);
    expect(vis.facts.some((f) => f.resolvedAwayByConflictId === c.conflictId)).toBe(true);
  });
});

describe('derived views (CS-12, CS-41, ADR-045 allergy exception)', () => {
  test('CS-12 absence ≠ discontinued; patient "I stopped it" never silently removes a medication', () => {
    const v1 = v('1', '2026-09-01T09:00:00Z', [P('I take metformin 500 milligrams twice daily.')]);
    confirmFact(v1, v1.facts[0].factId);
    const v2 = v('2', '2026-10-01T09:00:00Z', [P('The cough is the same.')]);
    let meds = currentMedications([v1, v2]);
    expect(meds.map((m) => m.fact.conceptKey)).toEqual(['metformin']);
    expect(meds[0].notDiscussedSince).toBeTruthy();
    const v3 = v('3', '2026-10-05T09:00:00Z', [P('I stopped the metformin.')]);
    meds = currentMedications([v1, v2, v3]);
    expect(meds.map((m) => m.fact.conceptKey)).toEqual(['metformin']); // PROVISIONAL discontinuation does not remove it
    confirmFact(v3, v3.facts[0].factId);
    expect(currentMedications([v1, v2, v3]).length).toBe(0); // only a clinician-confirmed discontinuation
  });

  test('CS-41 provisional "no allergies" is never NKDA', () => {
    const vis = v('1', '2026-10-01T09:00:00Z', [P('No allergies.')]);
    expect(allergyStatus([vis]).statusLine).toBe('No allergies reported — needs review');
    confirmFact(vis, vis.facts[0].factId);
    expect(allergyStatus([vis]).statusLine).toBe('No known allergies');
  });

  test('S6-01: flagged conditional allergy stays visible and blocks NKDA', () => {
    const v1 = v('1', '2026-09-01T09:00:00Z', [P('No allergies.')]);
    confirmFact(v1, v1.facts[0].factId);
    const v2 = v('2', '2026-10-01T09:00:00Z', [P('If I take penicillin I get a rash.')]);
    const st = allergyStatus([v1, v2]);
    expect(st.positives.some((p) => p.contextUnclear && p.fact.attributes.substance === 'penicillin')).toBe(true);
    expect(st.statusLine).toBe('Allergy status unclear — needs clarification');
  });

  test('confirming a CONTEXT_UNCLEAR fact requires a category choice', () => {
    const vis = v('1', '2026-10-01T09:00:00Z', [P('If I climb stairs I get chest pain.')]);
    expect(() => confirmFact(vis, vis.facts[0].factId)).toThrow(ReviewError);
    confirmFact(vis, vis.facts[0].factId, { category: 'SYMPTOM' });
    expect(vis.facts[0].provenance).toBe('CLINICIAN_CONFIRMED');
    expect(vis.facts[0].originProvenance).toBe('PATIENT_REPORTED');
  });

  test('edit creates a new CONFIRMED version; the old version is kept', () => {
    const vis = v('1', '2026-10-01T09:00:00Z', [P('I have had a cough for three weeks.')]);
    const next = editFact(vis, vis.facts[0].factId, { value: 'cough for four weeks' });
    expect(vis.facts.length).toBe(2);
    expect(next.status).toBe('CONFIRMED');
    expect(next.rootOriginProvenance).toBe('PATIENT_REPORTED');
    expect(vis.facts[0].supersededByFactId).toBe(next.factId);
  });
});

describe('return-visit comparison is deterministic (owner test #74, CS-24)', () => {
  test('duration increased, weight changed, medication B added, nothing invented', () => {
    const v1 = v('1', '2026-09-01T09:00:00Z', [P('I have had a cough for 3 weeks.'), D('Weight 72 kg.'), P('I take metformin 500 milligrams twice daily.')]);
    const v2 = v('2', '2026-10-06T09:00:00Z', [
      P('I have had a cough for 5 weeks.'),
      D('Weight 70 kg.'),
      P('I take metformin 500 milligrams twice daily.'),
      P('I also take atorvastatin 20 mg at night.'),
    ]);
    const diff = compareVisits(v1, v2).map((d) => d.text);
    expect(diff).toContain('cough: stated duration increased from 3 weeks to 5 weeks');
    expect(diff).toContain('Weight changed from 72 kg to 70 kg (−2 kg)');
    expect(diff.some((t) => t.startsWith('atorvastatin: newly documented this visit (added)'))).toBe(true);
    expect(diff.join(' ')).not.toMatch(/improved|worsened|resolved|controlled/);
  });

  test('a symptom absent at the next visit is "not discussed", never resolved', () => {
    const v1 = v('1', '2026-09-01T09:00:00Z', [P('I have night sweats.')]);
    const v2 = v('2', '2026-10-01T09:00:00Z', [P('I have a cough.')]);
    const d = compareVisits(v1, v2).find((x) => x.previous?.conceptKey === 'night sweats');
    expect(d?.kind).toBe('NOT_DISCUSSED_NOW');
    expect(d?.text).toContain('not discussed this visit');
  });
});

describe('note rendering (CS-04, CS-20, CS-25, CS-32, ADR-045)', () => {
  test('no NKDA when allergies not discussed; no normal exam; possibilities never included', () => {
    const vis = v('1', '2026-10-01T09:00:00Z', [P('I have had a cough for three weeks.')]);
    vis.candidates.push({
      candidateId: 'c',
      generationRunId: 'r',
      topic: 'Tuberculosis — topic to review',
      reason: 'x',
      supportingFactIds: [],
      contradictingFactIds: [],
      conflictFactIds: [],
      missingInformation: [],
      evidenceIds: [],
      sourceFactVersionIds: [],
      evidenceStateAtGeneration: 'COMPLETED',
      outdated: false,
      status: 'PROVISIONAL',
      aiJobVersion: 'x',
    });
    const note = renderNote('SOAP', { patient, visit: vis, allVisits: [vis] });
    expect(note).toContain('Allergies: not discussed');
    expect(note).not.toMatch(/NKDA|no known allergies|examination normal|exam(ination)? (is )?normal/i);
    expect(note).toContain('Examination: not discussed');
    expect(note).not.toContain('Tuberculosis');
  });

  test('notDiscussed decided by code: a discarded allergy item yields "see transcript"', () => {
    const vis = v('1', '2026-10-01T09:00:00Z', [P('I have a cough.')]);
    vis.discarded.push({ itemId: 'd', category: 'ALLERGY', segmentIds: [], reasonCode: 'NOT_GROUNDED', createdAt: '' });
    expect(renderNote('SOAP', { patient, visit: vis, allVisits: [vis] })).toContain('Allergies: see transcript — needs review');
  });

  test('flagged items appear as placeholders, never as the patient finding', () => {
    const vis = v('1', '2026-10-01T09:00:00Z', [P('If I climb stairs I get chest pain.')]);
    const note = renderNote('SOAP', { patient, visit: vis, allVisits: [vis] });
    expect(note).toContain('Symptom: item needs review — see transcript');
    expect(note).not.toMatch(/- If I climb stairs/);
  });

  test('CS-25 finalize ≠ confirm', () => {
    const vis = v('1', '2026-10-01T09:00:00Z', [P('I have a cough.')]);
    finalizeNote(vis, renderNote('SOAP', { patient, visit: vis, allVisits: [vis] }));
    expect(vis.facts.every((f) => f.status === 'PROVISIONAL')).toBe(true);
    expect(vis.unreviewedFactCountAtFinalize).toBe(1);
    expect(vis.noteVersions.pop()?.source).toBe('CLINICIAN_FINALIZED');
  });
});

describe('evidence filtering (CS-33 A, CS-38 B, ADR-036 sanitizer)', () => {
  test('negative, not-discussed, rejected, family-history and unconfirmed AI facts produce no query', () => {
    const vis = v('1', '2026-10-01T09:00:00Z', [
      P('I have had a cough for three weeks.'),
      P('No fever.'),
      P('My father had lung cancer.'),
      P('I have night sweats.'),
    ]);
    rejectFact(vis, vis.facts.find((f) => f.conceptKey === 'night sweats')!.factId);
    vis.facts.push({ ...vis.facts[0], factId: 'ai', conceptKey: 'tuberculosis', value: 'possible tuberculosis', originProvenance: 'AI_EXTRACTED', provenance: 'AI_EXTRACTED', rootOriginProvenance: 'AI_EXTRACTED', derivationMethod: 'AI_INFERENCE' });
    const { planned } = buildAutomaticQueries(vis, patient);
    const terms = planned.flatMap((p) => p.query.concepts.map((c) => c.term));
    expect(terms).toContain('cough');
    expect(terms).not.toContain('fever');
    expect(terms).not.toContain('lung cancer');
    expect(terms).not.toContain('night sweats');
    expect(terms).not.toContain('tuberculosis');
    expect(planned.some((p) => p.query.route === 'CANCER_INFO')).toBe(false);
    expect(planned.every((p) => !['TRIALS', 'CHEMICAL', 'PUBLIC_HEALTH'].includes(p.query.route))).toBe(true);
  });

  test('sanitizer rejects identifiers, dates and transcript wording; allows disease names with places', () => {
    expect(sanitizeTerm('P-000001 cough').ok).toBe(false);
    expect(sanitizeTerm('cough 2026-10-01').ok).toBe(false);
    expect(sanitizeTerm("I've had a cough").ok).toBe(false);
    expect(sanitizeTerm('Demo cough', patient).ok).toBe(false);
    expect(sanitizeTerm('Lyme disease').ok).toBe(true);
    expect(sanitizeTerm('West Nile virus').ok).toBe(true);
  });
});
