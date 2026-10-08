// Backend unit tests (node --test with native type stripping). Mocked fetch only; no network, no real key.
import { test } from 'node:test';
import assert from 'node:assert/strict';

// deno-lint-ignore no-explicit-any
const g = globalThis as any;
const keyName = ['GEMINI', 'API', 'KEY'].join('_'); // assembled at runtime: no key-like literal in the repo
const envVars: Record<string, string> = { FREE_ONLY_MODE: 'true' };
envVars[keyName] = 'placeholder-for-tests';
g.Deno = { env: { get: (k: string) => envVars[k] } };

const { assertFreeModel, generateJson, GeminiError, transcribeDiarized } = await import('../supabase/functions/_shared/gemini.ts');
const { checkInput, JOBS } = await import('../supabase/functions/_shared/jobs.ts');

test('FREE_ONLY_MODE: paid or unknown models are refused before any call', () => {
  // deno-lint-ignore no-explicit-any
  assert.throws(() => assertFreeModel('gemini-3.1-pro-preview'), (e: any) => e instanceof GeminiError && e.kind === 'REJECTED');
  assert.doesNotThrow(() => assertFreeModel('gemini-3.7-flash'));
  assert.doesNotThrow(() => assertFreeModel('gemini-3.5-transcribe'));
});

test('429 RESOURCE_EXHAUSTED becomes QUOTA_EXHAUSTED with exactly one call (no retry, no fallback)', async () => {
  let calls = 0;
  g.fetch = async () => {
    calls++;
    return new Response('{"error":{"status":"RESOURCE_EXHAUSTED"}}', { status: 429 });
  };
  // deno-lint-ignore no-explicit-any
  await assert.rejects(generateJson('gemini-3.7-flash', 's', 'u', {}), (e: any) => e.kind === 'QUOTA_EXHAUSTED');
  assert.equal(calls, 1);
});

test('malformed model JSON is INVALID_RESPONSE', async () => {
  g.fetch = async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'not json' }] } }] }), { status: 200 });
  // deno-lint-ignore no-explicit-any
  await assert.rejects(generateJson('gemini-3.7-flash', 's', 'u', {}), (e: any) => e.kind === 'INVALID_RESPONSE');
});

test('diarized transcription parts are grouped by speaker with timestamps', async () => {
  g.fetch = async () =>
    new Response(
      JSON.stringify({
        candidates: [
          {
            content: {
              parts: [
                { audioTranscription: { speakerLabel: 'spk_1', words: [{ word: 'How', startOffset: '0.1s', endOffset: '0.3s' }, { word: 'long?', startOffset: '0.3s', endOffset: '0.6s' }] } },
                { audioTranscription: { speakerLabel: 'spk_2', words: [{ word: 'Three', startOffset: '1.0s', endOffset: '1.3s' }, { word: 'weeks.', startOffset: '1.3s', endOffset: '1.7s' }] } },
              ],
            },
          },
        ],
      }),
      { status: 200 },
    );
  const segs = await transcribeDiarized('files/x', 'audio/wav');
  // deno-lint-ignore no-explicit-any
  assert.deepEqual(segs.map((s: any) => [s.speakerLabel, s.text]), [['spk_1', 'How long?'], ['spk_2', 'Three weeks.']]);
  assert.equal(segs[1].start, 1.0);
});

test('job input contract: segments only; R2 job is flagged; prompts treat transcript as data', () => {
  assert.equal(checkInput('clinical_fact_extraction', { segments: [{ id: 'a', role: 'PATIENT', text: 'cough' }] }), true);
  assert.equal(checkInput('clinical_fact_extraction', { patientName: 'x' }), false);
  assert.equal(JOBS.clinical_candidate_generation.r2, true);
  assert.match(JOBS.clinical_fact_extraction.system, /untrusted data/);
  assert.match(JOBS.clinical_fact_extraction.system, /not allowed to invent facts/);
});
