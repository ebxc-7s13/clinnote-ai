/**
 * UI tests: real Expo Router routes rendered with an in-memory encrypted store and mock providers (no network,
 * synthetic data). Covers onboarding gate, home empty state, demo patient creation, patient overview, start visit,
 * clinical facts (provenance + segment code), evidence empty state, review without R2, comparison and timeline.
 */
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { DEMO_VISIT_1, DEMO_VISIT_2 } from '../application/demo';
import type { Container } from '../application/container';

jest.mock('expo-speech-recognition', () => ({ ExpoSpeechRecognitionModule: { addListener: () => ({ remove() {} }), isRecognitionAvailable: () => false, supportsOnDeviceRecognition: () => false, supportsRecording: () => false } }));
jest.mock('expo-keep-awake', () => ({ useKeepAwake: () => undefined }));
jest.mock('expo-splash-screen', () => ({ preventAutoHideAsync: async () => undefined, hideAsync: async () => undefined }));

jest.mock('../application/container', () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { ClinicalStore } = require('../infrastructure/storage/clinicalStore');
  const { DocumentCipher } = require('../infrastructure/storage/crypto');
  const { MemoryFileBackend } = require('../infrastructure/storage/fileBackend');
  const { MockBackend } = require('../providers/backend');
  const { EvidenceService } = require('../application/evidenceService');
  const { VisitService } = require('../application/visitService');
  /* eslint-enable @typescript-eslint/no-require-imports */
  const rnd = (n: number) => Uint8Array.from({ length: n }, () => Math.floor(Math.random() * 256));
  let c: Container | null = null;
  const make = () => {
    const store = new ClinicalStore(new MemoryFileBackend(), new DocumentCipher(rnd(32), rnd));
    const backend = new MockBackend({ kind: 'NOT_CONFIGURED' });
    const evidence = new EvidenceService(store);
    return { store, backend, evidence, visits: new VisitService(store, backend, evidence) } as Container;
  };
  return {
    __reset: () => (c = make()),
    getContainer: async () => (c ??= make()),
    destroyDataKey: async () => undefined,
    mergeAudio: () => null,
    deleteAudio: () => undefined,
    APP_VARIANT: 'development',
    R2_SELECTABLE: true,
  };
});
// eslint-disable-next-line @typescript-eslint/no-require-imports
const containerMock = require('../application/container') as { __reset(): Container; getContainer(): Promise<Container> };

const APP = './src/app';
const press = async (label: string | RegExp) => {
  await fireEvent.press(screen.getByRole('button', { name: label }));
};

async function seedTwoVisits(): Promise<{ patientId: string; v1: string; v2: string }> {
  const c = await containerMock.getContainer();
  const s = await c.store.getSettings();
  await c.store.saveSettings({ ...s, onboardingAcknowledgedAt: '2026-10-09T00:00:00.000Z', cloudProcessingEnabled: true });
  const p = await c.store.createPatient({ age: 47, sex: 'MALE', isDemo: true });
  const ids: string[] = [];
  for (const [i, lines] of [DEMO_VISIT_1, DEMO_VISIT_2].entries()) {
    const v = await c.store.createVisit(p.patientId, 'AMBIENT');
    v.startedAt = `2026-10-0${1 + i * 7}T09:00:00.000Z`;
    c.visits.recordConsent(v, 'VERBAL_ATTESTED_BY_CLINICIAN');
    c.visits.startRecording(v);
    lines.forEach((l, j) => c.visits.addLiveSegment(v, l.text, 0.9, l.role, j * 6, j * 6 + 5, 'demo-script'));
    c.visits.stopRecording(v, lines.length * 6);
    c.visits.confirmRoles(v, {});
    const earlier = await c.store.listVisits(p.patientId);
    await c.visits.runExtraction(v, { ...s, cloudProcessingEnabled: true }, earlier.filter((x) => x.visitId !== v.visitId));
    v.evidenceState = 'FAILED';
    await c.store.saveVisit(v);
    ids.push(v.visitId);
  }
  return { patientId: p.patientId, v1: ids[0], v2: ids[1] };
}

beforeEach(() => {
  containerMock.__reset();
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});

test('first launch shows onboarding; acknowledgement is explicit and leads to Home', async () => {
  await renderRouter(APP, { initialUrl: '/' });
  expect(await screen.findByText('Documentation assistant, not a doctor')).toBeTruthy();
  for (let i = 0; i < 4; i++) await press('Continue');
  const ack = screen.getByRole('button', { name: 'Acknowledge — manual mode (cloud off)' });
  expect(ack).toBeDisabled();
  await fireEvent.press(screen.getByRole('checkbox'));
  await press('Acknowledge — manual mode (cloud off)');
  expect(await screen.findByText('No patients yet')).toBeTruthy();
  expect(screen.getByText('Manual mode')).toBeTruthy();
});

test('Home → create synthetic demo patient → overview shows P-000001 and DEMO label', async () => {
  const c = await containerMock.getContainer();
  await c.store.saveSettings({ ...(await c.store.getSettings()), onboardingAcknowledgedAt: '2026-10-09T00:00:00.000Z' });
  await renderRouter(APP, { initialUrl: '/' });
  await screen.findByText('Create synthetic demo patient');
  await press('Create synthetic demo patient');
  expect(await screen.findByText('P-000001', {}, { timeout: 3000 })).toBeTruthy();
  expect(screen.getAllByText('DEMO DATA — NOT A REAL PATIENT').length).toBeGreaterThan(0);
  expect(screen.getByText('Not discussed')).toBeTruthy(); // allergy status line, never NKDA
});

test('Start visit: Record conversation is unavailable with cloud off; manual visit opens Clinical facts', async () => {
  const c = await containerMock.getContainer();
  await c.store.saveSettings({ ...(await c.store.getSettings()), onboardingAcknowledgedAt: '2026-10-09T00:00:00.000Z', cloudProcessingEnabled: false });
  const p = await c.store.createPatient({ isDemo: true });
  await renderRouter(APP, { initialUrl: `/visit/start?patientId=${p.patientId}` });
  expect(await screen.findByText(/Record conversation is unavailable because cloud processing is off/)).toBeTruthy();
  await press('Continue');
  expect(await screen.findByText('No facts extracted — add manually', {}, { timeout: 3000 })).toBeTruthy();
});

test('Clinical facts show provenance, time and transcript segment; denied fever reads as denied', async () => {
  const { patientId, v1 } = await seedTwoVisits();
  await renderRouter(APP, { initialUrl: `/visit/${patientId}/${v1}/facts` });
  expect(await screen.findByText('Symptoms')).toBeTruthy();
  expect(screen.getAllByText('PATIENT_REPORTED').length).toBeGreaterThan(0);
  expect(screen.getAllByText(/Transcript T-0002/).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/SYMPTOM · denied \/ absent/).length).toBeGreaterThan(0);
  expect(screen.getAllByRole('button', { name: 'Confirm' }).length).toBeGreaterThan(0);
});

test('Evidence with failed retrieval says NO VERIFIED EVIDENCE FOUND (nothing generated)', async () => {
  const { patientId, v1 } = await seedTwoVisits();
  await renderRouter(APP, { initialUrl: `/visit/${patientId}/${v1}/evidence` });
  expect(await screen.findByText('NO VERIFIED EVIDENCE FOUND')).toBeTruthy();
});

test('Clinical review hides possibilities when the R2 flag is off', async () => {
  const { patientId, v1 } = await seedTwoVisits();
  await renderRouter(APP, { initialUrl: `/visit/${patientId}/${v1}/review` });
  expect(await screen.findByText('Facts')).toBeTruthy();
  expect(screen.queryByText(/POSSIBILITY TO REVIEW/)).toBeNull();
  expect(screen.queryByText(/Possibilities to review/i)).toBeNull();
});

test('Comparison shows what changed with both stated values; Timeline lists visits', async () => {
  const { patientId, v2 } = await seedTwoVisits();
  await renderRouter(APP, { initialUrl: `/visit/${patientId}/${v2}/compare` });
  expect(await screen.findByText('What changed since last visit?')).toBeTruthy();
  expect(screen.getByText(/Weight changed from 72 kg to 70 kg/)).toBeTruthy();
  expect(screen.getByText(/atorvastatin: newly documented this visit \(added\)/i)).toBeTruthy();
  expect(screen.queryByText(/improved|worsened|resolved/i)).toBeNull();
});

test('Patient overview of a returning patient shows what changed and the symptom course', async () => {
  const { patientId } = await seedTwoVisits();
  await renderRouter(APP, { initialUrl: `/patient/${patientId}` });
  expect(await screen.findByText('What changed since last visit')).toBeTruthy();
  await waitFor(() => expect(screen.getAllByText(/cough: stated duration increased/i).length).toBeGreaterThan(0));
  expect(screen.getByText('Symptom course')).toBeTruthy();
});

test('UI flow: consent → record (synthetic script) → stop → confirm roles → extract → note → finalize', async () => {
  const c = await containerMock.getContainer();
  await c.store.saveSettings({ ...(await c.store.getSettings()), onboardingAcknowledgedAt: '2026-10-09T00:00:00.000Z', cloudProcessingEnabled: true });
  const p = await c.store.createPatient({ age: 47, sex: 'MALE', isDemo: true });
  const v = await c.store.createVisit(p.patientId, 'AMBIENT');
  (Alert.alert as jest.Mock).mockImplementation((_t: string, _m?: string, buttons?: { text?: string; onPress?: () => void }[]) => {
    buttons?.find((b) => b.text === 'Finalize note')?.onPress?.();
  });
  await renderRouter(APP, { initialUrl: `/visit/${p.patientId}/${v.visitId}/consent` });
  expect(await screen.findByText('Recording consent')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Confirm and start recording' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('checkbox'));
  await press('Confirm and start recording');
  await screen.findByText('Run synthetic demo consultation (no microphone)');
  await press('Run synthetic demo consultation (no microphone)');
  expect(await screen.findByText('● RECORDING')).toBeTruthy();
  await act(async () => {
    jest.advanceTimersByTime(DEMO_VISIT_1.length * 1400 + 1000);
  });
  expect(await screen.findByText(/lost about 3 kg/)).toBeTruthy();
  await press('Stop');
  expect(await screen.findByText('Speaker roles', {}, { timeout: 5000 })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Continue to clinical fact extraction' })).toBeDisabled();
  await press('Confirm speaker roles');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Continue to clinical fact extraction' })).toBeEnabled());
  await press('Continue to clinical fact extraction');
  expect(await screen.findByText('Symptoms', {}, { timeout: 5000 })).toBeTruthy();
  const saved = await c.store.getVisit(p.patientId, v.visitId);
  expect(saved.segments.length).toBe(DEMO_VISIT_1.length);
  expect(saved.facts.some((f) => f.conceptKey === 'cough' && f.provenance === 'PATIENT_REPORTED')).toBe(true);
  await act(async () => router.push(`/visit/${p.patientId}/${v.visitId}/note`));
  await screen.findByText('Generate draft from documented facts');
  await press('Generate draft from documented facts');
  expect(await screen.findByText(/fact\(s\) not yet reviewed — finalizing does not confirm them/)).toBeTruthy();
  await press('Finalize note');
  expect(await screen.findByText('Note finalized — visit saved')).toBeTruthy();
  const done = await c.store.getVisit(p.patientId, v.visitId);
  expect(done.noteState).toBe('FINALIZED');
  expect(done.facts.every((f) => f.status !== 'CONFIRMED')).toBe(true); // finalize ≠ confirm
});
