/**
 * Owner-required hallucination and correction tests (§16–§17). AI output is validated, never trusted: nothing
 * ungrounded in the transcript becomes a fact; citations must come from the retrieved bundle.
 */
import { validateCandidates } from '../../domain/candidates';
import { detectConflicts } from '../../domain/conflicts';
import { validateAndPromote } from '../../domain/extraction/validate';
import { renderNote } from '../../domain/note';
import type { ClinicalFact, EvidenceSource, FactCategory, Patient } from '../../domain/types';
import { extract, seg, visit } from '../helpers';

const ctxAI = { patientId: 'P', visitId: 'V', extractor: 'AI' as const, aiJobVersion: 'clinical_fact_extraction@1' };
const patient: Patient = { schemaVersion: 1, patientId: 'P', patientReference: 'P-900001', isDemo: true, problems: [], visitIds: ['V'], createdAt: '2026-10-08T09:00:00.000Z', updatedAt: '2026-10-08T09:00:00.000Z' };

describe('AI cannot invent clinical content (owner §17)', () => {
  const s1 = seg('PATIENT', "I've had a cough for three weeks and it's worse at night.");
  const s2 = seg('DOCTOR', "Let's see how you are doing.");
  const invented: { category: FactCategory; value: string; attributes?: ClinicalFact['attributes'] }[] = [
    { category: 'ASSESSMENT', value: 'pneumonia' },
    { category: 'MEDICATION', value: 'amoxicillin', attributes: { rawName: 'amoxicillin' } },
    { category: 'MEDICATION', value: 'cough syrup 10 ml', attributes: { rawName: 'cough syrup', dose: '10 ml' } },
    { category: 'ALLERGY', value: 'penicillin', attributes: { substance: 'penicillin' } },
    { category: 'INVESTIGATION', value: 'chest x-ray normal', attributes: { testName: 'chest x-ray', result: 'normal' } },
    { category: 'VITAL_SIGN', value: 'temperature 38.5', attributes: { vitalKind: 'TEMPERATURE', numericValue: 38.5, unit: '°C' } },
    { category: 'EXAMINATION_FINDING', value: 'crackles at the right base' },
    { category: 'HISTORY_MEDICAL', value: 'asthma' },
    { category: 'HISTORY_SOCIAL', value: 'smokes 20 cigarettes a day' },
  ];
  test.each(invented)('invented $category "$value" is discarded', (inv) => {
    const r = validateAndPromote(
      [{ category: inv.category, value: inv.value, informationState: 'POSITIVE', sourceSegmentIds: [s1.segmentId, s2.segmentId], derivationMethod: 'AI_INFERENCE', confidence: 'HIGH', needsClarification: false, attributes: inv.attributes ?? {} }],
      [s1, s2],
      ctxAI,
    );
    expect(r.facts).toHaveLength(0);
    expect(r.discarded).toHaveLength(1);
  });

  test('a grounded symptom is accepted but stays PROVISIONAL with code-assigned provenance', () => {
    const r = validateAndPromote(
      [{ category: 'SYMPTOM', value: 'cough for three weeks', informationState: 'POSITIVE', sourceSegmentIds: [s1.segmentId], derivationMethod: 'VERBATIM_EXTRACTION', confidence: 'HIGH', needsClarification: false, attributes: {} }],
      [s1],
      ctxAI,
    );
    expect(r.facts).toHaveLength(1);
    expect(r.facts[0].status).toBe('PROVISIONAL');
    expect(r.facts[0].provenance).toBe('PATIENT_REPORTED');
  });

  test('a dose different from the transcript is never accepted (no silent numeric change)', () => {
    const s = seg('PATIENT', 'I take metformin 500 mg twice daily.');
    const r = validateAndPromote(
      [{ category: 'MEDICATION', value: 'metformin 1000 mg twice daily', informationState: 'POSITIVE', sourceSegmentIds: [s.segmentId], derivationMethod: 'VERBATIM_EXTRACTION', confidence: 'HIGH', needsClarification: false, attributes: { rawName: 'metformin', dose: '1000 mg' } }],
      [s],
      ctxAI,
    );
    expect(r.facts).toHaveLength(0);
  });
});

describe('citations, PMIDs, FDA records and trials cannot be invented', () => {
  const v = visit();
  v.facts = extract([seg('PATIENT', "I've had a cough for three weeks.")]).map((f) => ({ ...f, visitId: 'V' }));
  v.evidenceState = 'COMPLETED';
  const ev: EvidenceSource = {
    evidenceId: 'E1', queryId: 'Q1', provider: 'PubMed', sourceType: 'LITERATURE', tier: 3, title: 'Chronic cough: a review.', identifier: '27409075', identifierType: 'PMID', alternateIdentifiers: [],
    url: 'https://pubmed.ncbi.nlm.nih.gov/27409075/', retrievedAt: '2026-10-08T09:00:00.000Z', relevance: 'HIGH', retrievedFor: 'cough (positive)', responseValidated: true, factsChangedSinceRetrieval: false, citable: true, sourceFactIds: [],
  };
  v.evidence = [ev];
  const fid = v.facts[0].factId;
  const base = { topic: 'Chronic cough evaluation', reason: 'Cough for several weeks.', supportingFactIds: [fid], contradictingFactIds: [], missingInformation: [], evidenceIds: ['E1'] };

  test.each([
    ['citation not in the retrieved bundle', { ...base, evidenceIds: ['E-FAKE'] }],
    ['PMID written into the text', { ...base, reason: 'See PMID 12345678.' }],
    ['clinical trial id invented', { ...base, reason: 'Eligible for NCT01234567.' }],
    ['FDA/dose statement', { ...base, reason: 'Start 500 mg dose per FDA label.' }],
    ['probability', { ...base, reason: 'Probability 80% of disease.' }],
    ['final diagnosis wording', { ...base, topic: 'Final diagnosis: asthma' }],
    ['invented fact id', { ...base, supportingFactIds: ['F-FAKE'] }],
    ['no evidence at all', { ...base, evidenceIds: [] }],
  ])('rejected: %s', (_name, cand) => {
    const r = validateCandidates({ candidates: [cand] }, v, 'run', 'job@1');
    expect(r.candidates).toHaveLength(0);
    expect(r.rejected).toBe(1);
  });

  test('control: a grounded, cited possibility is kept and labeled provisional', () => {
    const r = validateCandidates({ candidates: [base] }, v, 'run', 'job@1');
    expect(r.candidates).toHaveLength(1);
    expect(r.candidates[0].status).toBe('PROVISIONAL');
  });

  test('with no evidence there is nothing to cite and the note never contains possibilities', () => {
    const v2 = { ...v, evidence: [], candidates: [] };
    const r = validateCandidates({ candidates: [base] }, v2, 'run', 'job@1');
    expect(r.candidates).toHaveLength(0);
    const note = renderNote('SOAP', { patient, visit: { ...v, candidates: [{ ...base, candidateId: 'C', generationRunId: 'r', conflictFactIds: [], sourceFactVersionIds: [], evidenceStateAtGeneration: 'COMPLETED', outdated: false, status: 'PROVISIONAL', aiJobVersion: 'x' }] }, allVisits: [v] });
    expect(note).not.toMatch(/Chronic cough evaluation/);
  });
});

describe('patient corrects a medication (owner §16)', () => {
  test('both statements are kept and an open, reviewable conflict is created', () => {
    const segs = [seg('PATIENT', 'I take metformin 500 mg twice daily.'), seg('PATIENT', 'Sorry, I take metformin 1000 mg twice daily.')];
    const v = visit({ segments: segs });
    v.facts = extract(segs).map((f) => ({ ...f, visitId: 'V' }));
    const meds = v.facts.filter((f) => f.category === 'MEDICATION');
    expect(meds.map((m) => m.attributes.dose)).toEqual(expect.arrayContaining(['500 mg', '1000 mg']));
    detectConflicts(v, []);
    expect(v.conflicts.filter((c) => c.status === 'OPEN')).toHaveLength(1);
    expect(v.facts.filter((f) => f.category === 'MEDICATION').every((f) => f.status === 'PROVISIONAL' && !f.supersededByFactId)).toBe(true);
    const note = renderNote('SOAP', { patient, visit: v, allVisits: [v] });
    expect(note).toMatch(/Conflict — review/);
  });
});
