/** The synthetic walkthrough in README.md → "How to Use" must produce what the README says it produces. */
import { extract, seg } from './helpers';

const facts = extract([
  seg('DOCTOR', 'What brings you in today?'),
  seg('PATIENT', 'I have had a cough for about three weeks.'),
  seg('DOCTOR', 'Any fever?'),
  seg('PATIENT', 'No fever.'),
]);

test('cough is positive and patient-reported, with its duration', () => {
  const cough = facts.find((f) => f.conceptKey === 'cough');
  expect(cough?.informationState).toBe('POSITIVE');
  expect(cough?.provenance).toBe('PATIENT_REPORTED');
  expect(cough?.attributes?.duration).toBe('about 3 weeks') // the hedge is kept;
});

test('fever is negative (denied), patient-reported', () => {
  const fever = facts.find((f) => f.conceptKey === 'fever');
  expect(fever?.informationState).toBe('NEGATIVE');
  expect(fever?.provenance).toBe('PATIENT_REPORTED');
});

test('nothing is confirmed and allergies are not invented', () => {
  expect(facts.every((f) => f.status === 'PROVISIONAL')).toBe(true);
  expect(facts.some((f) => f.category === 'ALLERGY')).toBe(false);
});

test('README limitation: a bare answer to a question is not turned into a symptom', () => {
  const qa = extract([seg('DOCTOR', 'How long have you had the cough?'), seg('PATIENT', 'About three weeks.')]);
  expect(qa.find((f) => f.conceptKey === 'cough' && f.informationState === 'POSITIVE')).toBeUndefined();
});
