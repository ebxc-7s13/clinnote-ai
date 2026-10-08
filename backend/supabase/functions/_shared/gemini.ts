// Gemini adapter for Supabase Edge Functions (Deno). Holds the only reference to GEMINI_API_KEY.
// FREE_ONLY_MODE: only models verified as free-tier on https://ai.google.dev/gemini-api/docs/pricing (2026-10-08)
// may be called; a 429 RESOURCE_EXHAUSTED is reported as QUOTA_EXHAUSTED — no retry with another model, no paid
// fallback. Request and response bodies are never logged.

export type ErrorKind = 'QUOTA_EXHAUSTED' | 'UNAVAILABLE' | 'REJECTED' | 'NOT_CONFIGURED' | 'INVALID_RESPONSE' | 'FEATURE_DISABLED';

export class GeminiError extends Error {
  kind: ErrorKind;
  status: number;
  constructor(kind: ErrorKind, status: number) {
    super(kind);
    this.kind = kind;
    this.status = status;
  }
}

/** Verified free-tier model IDs (pricing page, 2026-10-08). Re-verify before changing. */
export const FREE_TIER_MODELS = new Set([
  'gemini-3.7-flash',
  'gemini-3.8-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.5-transcribe',
]);

const API = 'https://generativelanguage.googleapis.com';

export function env(name: string): string | undefined {
  // deno-lint-ignore no-explicit-any
  return (globalThis as any).Deno?.env.get(name) ?? undefined;
}

export const freeOnly = () => (env('FREE_ONLY_MODE') ?? 'true') !== 'false';

export function textModel(): string {
  return env('GEMINI_TEXT_MODEL') ?? 'gemini-3.7-flash';
}
export function transcribeModel(): string {
  return env('GEMINI_TRANSCRIBE_MODEL') ?? 'gemini-3.5-transcribe';
}

function key(): string {
  const k = env('GEMINI_API_KEY');
  if (!k) throw new GeminiError('NOT_CONFIGURED', 503);
  return k;
}

export function assertFreeModel(model: string) {
  // FREE_ONLY_MODE cannot be bypassed by configuration of a paid model.
  if (!FREE_TIER_MODELS.has(model)) throw new GeminiError('REJECTED', 400);
}

function mapStatus(status: number): ErrorKind {
  if (status === 429) return 'QUOTA_EXHAUSTED';
  if (status === 500 || status === 503 || status === 504) return 'UNAVAILABLE';
  return 'REJECTED';
}

async function call(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch {
    throw new GeminiError('UNAVAILABLE', 503);
  } finally {
    clearTimeout(t);
  }
}

/** Structured JSON generation. The schema is enforced by the API and again by the app's own validators. */
export async function generateJson(model: string, system: string, user: string, schema: unknown): Promise<unknown> {
  assertFreeModel(model);
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig: { temperature: 0, responseMimeType: 'application/json', responseJsonSchema: schema },
  };
  const res = await call(`${API}/v1beta/models/${model}:generateContent`, { method: 'POST', headers: { 'x-goog-api-key': key(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, 60000);
  if (!res.ok) throw new GeminiError(mapStatus(res.status), res.status);
  // deno-lint-ignore no-explicit-any
  const json: any = await res.json().catch(() => null);
  const text = json?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
  try {
    return JSON.parse(text);
  } catch {
    throw new GeminiError('INVALID_RESPONSE', 502);
  }
}

/** Files API resumable upload. The file is deleted right after transcription. */
export async function uploadFile(bytes: Uint8Array, mimeType: string): Promise<{ uri: string; name: string }> {
  const start = await call(
    `${API}/upload/v1beta/files`,
    {
      method: 'POST',
      headers: {
        'x-goog-api-key': key(),
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': String(bytes.length),
        'X-Goog-Upload-Header-Content-Type': mimeType,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ file: { display_name: 'consultation-audio' } }),
    },
    30000,
  );
  const uploadUrl = start.headers.get('x-goog-upload-url');
  if (!start.ok || !uploadUrl) throw new GeminiError(mapStatus(start.status), start.status);
  const up = await call(uploadUrl, { method: 'POST', headers: { 'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize', 'Content-Length': String(bytes.length) }, body: bytes as unknown as BodyInit }, 120000);
  if (!up.ok) throw new GeminiError(mapStatus(up.status), up.status);
  // deno-lint-ignore no-explicit-any
  const j: any = await up.json().catch(() => null);
  if (!j?.file?.uri || !j?.file?.name) throw new GeminiError('INVALID_RESPONSE', 502);
  // wait until the file is ACTIVE (audio processing), bounded
  for (let i = 0; i < 20 && j.file.state && j.file.state !== 'ACTIVE'; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const s = await call(`${API}/v1beta/${j.file.name}`, { headers: { 'x-goog-api-key': key() } }, 15000);
    // deno-lint-ignore no-explicit-any
    const sj: any = await s.json().catch(() => null);
    if (sj?.state) j.file.state = sj.state;
    if (sj?.state === 'FAILED') throw new GeminiError('INVALID_RESPONSE', 502);
  }
  return { uri: j.file.uri, name: j.file.name };
}

export async function deleteFile(name: string) {
  try {
    await call(`${API}/v1beta/${name}`, { method: 'DELETE', headers: { 'x-goog-api-key': key() } }, 15000);
  } catch {
    /* best effort; Files API also expires files automatically */
  }
}

export interface DiarizedSegment {
  speakerLabel: string;
  text: string;
  start: number;
  end: number;
}

const secs = (s: unknown) => (typeof s === 'string' ? Number(s.replace(/s$/, '')) : typeof s === 'number' ? s : 0);

/** gemini-3.5-transcribe with diarization (docs: generate-content/transcribe, verified 2026-10-08). */
export async function transcribeDiarized(fileUri: string, mimeType: string): Promise<DiarizedSegment[]> {
  const model = transcribeModel();
  assertFreeModel(model);
  const body = {
    contents: [{ parts: [{ fileData: { fileUri, mimeType } }] }],
    generationConfig: { audioTranscriptionConfig: { diarization: true, wordTimestamp: true } },
  };
  const res = await call(`${API}/v1beta/models/${model}:generateContent`, { method: 'POST', headers: { 'x-goog-api-key': key(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, 150000);
  if (!res.ok) throw new GeminiError(mapStatus(res.status), res.status);
  // deno-lint-ignore no-explicit-any
  const json: any = await res.json().catch(() => null);
  const parts: unknown[] = json?.candidates?.[0]?.content?.parts ?? [];
  const out: DiarizedSegment[] = [];
  for (const p of parts) {
    // deno-lint-ignore no-explicit-any
    const at = (p as any)?.audioTranscription;
    if (at && Array.isArray(at.words) && at.words.length) {
      const text = at.words.map((w: { word?: string }) => w.word ?? '').join(' ').replace(/\s+([.,?!])/g, '$1').trim();
      const seg = { speakerLabel: String(at.speakerLabel ?? 'spk_?'), text, start: secs(at.words[0].startOffset), end: secs(at.words[at.words.length - 1].endOffset) };
      const last = out[out.length - 1];
      if (last && last.speakerLabel === seg.speakerLabel && seg.start - last.end < 1.5) {
        last.text = `${last.text} ${seg.text}`;
        last.end = seg.end;
      } else out.push(seg);
    }
  }
  if (!out.length) {
    // deno-lint-ignore no-explicit-any
    const text = parts.map((p: any) => p?.text ?? '').join(' ').trim();
    if (text) out.push({ speakerLabel: 'spk_?', text, start: 0, end: 0 });
  }
  if (!out.length) throw new GeminiError('INVALID_RESPONSE', 502);
  return out;
}
