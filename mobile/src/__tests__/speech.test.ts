/**
 * Live speech controller failure modes with a mocked native module: microphone denied, interruption, restart
 * after silence, partial text never lost on stop.
 */
// jest.mock is hoisted above this import by babel-jest
import { LiveSpeechController, requestSpeechPermission } from '../infrastructure/speech/liveSpeech';

type Listener = (e: any) => void;
jest.mock('expo-speech-recognition', () => {
  const listeners: Record<string, ((e: any) => void)[]> = {};
  return {
    __listeners: listeners,
    ExpoSpeechRecognitionModule: {
      start: jest.fn(),
      stop: jest.fn(),
      isRecognitionAvailable: () => true,
      supportsOnDeviceRecognition: () => true,
      supportsRecording: () => false,
      requestPermissionsAsync: jest.fn(async () => ({ granted: false })),
      addListener: (name: string, fn: (e: any) => void) => {
        (listeners[name] ??= []).push(fn);
        return { remove: () => (listeners[name] = listeners[name].filter((x) => x !== fn)) };
      },
    },
  };
});
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mocked = require('expo-speech-recognition') as { __listeners: Record<string, Listener[]>; ExpoSpeechRecognitionModule: { start: jest.Mock } };
const listeners = mocked.__listeners;
const mockModule = mocked.ExpoSpeechRecognitionModule;

const emit = (name: string, e: unknown) => (listeners[name] ?? []).forEach((f) => f(e));

function make() {
  const finals: string[] = [];
  const statuses: { s: string; m?: string }[] = [];
  const c = new LiveSpeechController(
    { onFinal: (t) => finals.push(t), onPartial: () => undefined, onStatus: (s, m) => statuses.push({ s, m }), onAudioFile: () => undefined },
    { lang: 'en-US', filePrefix: 't', captureAudio: false },
  );
  return { c, finals, statuses };
}

beforeEach(() => {
  jest.useFakeTimers();
  for (const k of Object.keys(listeners)) delete listeners[k];
  mockModule.start.mockClear();
});
afterEach(() => jest.useRealTimers());

test('microphone permission denied → false, nothing recorded', async () => {
  expect(await requestSpeechPermission()).toBe(false);
});

test('permission revoked during recording: clear error, captured text kept', () => {
  const { c, finals, statuses } = make();
  c.start();
  emit('result', { isFinal: true, results: [{ transcript: 'I have had a cough', confidence: 0.9 }] });
  emit('result', { isFinal: false, results: [{ transcript: 'for three weeks', confidence: 0 }] });
  emit('error', { error: 'not-allowed' });
  expect(statuses.pop()).toEqual({ s: 'ERROR', m: expect.stringMatching(/permission was denied.*transcript so far is saved/i) });
  expect(finals).toEqual(['I have had a cough', 'for three weeks']);
});

test('silence / interruption restarts recognition automatically without losing text', () => {
  const { c, finals } = make();
  c.start();
  expect(mockModule.start).toHaveBeenCalledTimes(1);
  emit('result', { isFinal: true, results: [{ transcript: 'first part', confidence: 0.8 }] });
  emit('error', { error: 'no-speech' });
  emit('end', {});
  jest.advanceTimersByTime(5000);
  expect(mockModule.start.mock.calls.length).toBeGreaterThanOrEqual(2);
  emit('result', { isFinal: true, results: [{ transcript: 'second part', confidence: 0.8 }] });
  expect(finals).toEqual(['first part', 'second part']);
});

test('repeated failures stop with a manual-entry message instead of looping', () => {
  const { c, statuses } = make();
  c.start();
  for (let i = 0; i < 6; i++) emit('error', { error: 'server' });
  expect(statuses.some((s) => s.s === 'ERROR' && /manually/i.test(s.m ?? ''))).toBe(true);
});

test('stop commits a dangling partial exactly once', () => {
  const { c, finals } = make();
  c.start();
  emit('result', { isFinal: false, results: [{ transcript: 'worse at night', confidence: 0 }] });
  c.stop();
  jest.advanceTimersByTime(2000);
  expect(finals).toEqual(['worse at night']);
});
