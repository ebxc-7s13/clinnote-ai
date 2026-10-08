// Final transcription with speaker diarization (Gemini transcribe model via Files API).
// Audio is held in memory only for the request, uploaded to the Files API, transcribed, and deleted immediately.
// Nothing is stored or logged except outcome and duration.
import { deleteFile, freeOnly, GeminiError, transcribeDiarized, transcribeModel, uploadFile } from '../_shared/gemini.ts';

const MAX_BYTES = 40 * 1024 * 1024; // ~20 min of 16 kHz mono PCM; diarization limit is 30 min per request
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const fail = (status: number, kind: string) => json(status, { ok: false, error: { kind } });

// deno-lint-ignore no-explicit-any
(globalThis as any).Deno?.serve(async (req: Request) => {
  if (req.method !== 'POST') return fail(405, 'REJECTED');
  if (!freeOnly()) return fail(503, 'REJECTED');
  const type = req.headers.get('content-type') ?? '';
  if (!type.startsWith('audio/')) return fail(415, 'REJECTED');
  const len = Number(req.headers.get('content-length') ?? '0');
  if (len > MAX_BYTES) return fail(413, 'REJECTED');
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_BYTES) return fail(413, 'REJECTED');
  const started = Date.now();
  let fileName: string | null = null;
  try {
    const f = await uploadFile(bytes, type.split(';')[0]);
    fileName = f.name;
    const segments = await transcribeDiarized(f.uri, type.split(';')[0]);
    console.log(JSON.stringify({ job: 'transcription', outcome: 'SUCCESS', ms: Date.now() - started }));
    return json(200, { ok: true, segments, execution: { executionId: crypto.randomUUID(), provider: 'gemini', model: transcribeModel(), durationMs: Date.now() - started } });
  } catch (e) {
    const kind = e instanceof GeminiError ? e.kind : 'UNAVAILABLE';
    console.log(JSON.stringify({ job: 'transcription', outcome: kind, ms: Date.now() - started }));
    return fail(kind === 'QUOTA_EXHAUSTED' ? 429 : kind === 'REJECTED' ? 400 : 503, kind);
  } finally {
    if (fileName) await deleteFile(fileName);
  }
});
