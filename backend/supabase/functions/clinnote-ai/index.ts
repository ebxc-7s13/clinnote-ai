// ClinNote AI job endpoint (Supabase Edge Function). Actions: health, config, job.
// Holds no clinical state and logs no bodies (ADR-012, ADR-042). Only the job name, outcome and duration are logged.
import { env, freeOnly, GeminiError, generateJson, textModel } from '../_shared/gemini.ts';
import { checkInput, JOBS, userPayload } from '../_shared/jobs.ts';

const VERSION = '1.0.0';
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const fail = (status: number, kind: string) => json(status, { ok: false, error: { kind } });

// Per-isolate abuse control (non-clinical, in memory only). Persistent counters per ADR-042 are a Phase 7B item.
const hits = new Map<string, number[]>();
function limited(caller: string, perMinute = 12): boolean {
  const now = Date.now();
  const arr = (hits.get(caller) ?? []).filter((t) => now - t < 60_000);
  arr.push(now);
  hits.set(caller, arr);
  return arr.length > perMinute;
}

const possibilitiesEnabled = () => env('POSSIBILITIES_ENABLED') === 'true'; // R2 default OFF (ADR-025)

// deno-lint-ignore no-explicit-any
(globalThis as any).Deno?.serve(async (req: Request) => {
  if (req.method !== 'POST') return fail(405, 'REJECTED');
  const caller = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  let body: { action?: string; job?: string; jobVersion?: string; input?: unknown };
  try {
    body = await req.json();
  } catch {
    return fail(400, 'REJECTED');
  }
  if (body.action === 'health') return json(200, { ok: true, status: 'ok', version: VERSION });
  if (body.action === 'config') return json(200, { ok: true, config: { possibilitiesEnabled: possibilitiesEnabled(), freeOnlyMode: freeOnly() } });
  if (body.action !== 'job' || !body.job || !(body.job in JOBS)) return fail(400, 'REJECTED');
  const job = JOBS[body.job];
  if (job.r2 && !possibilitiesEnabled()) return fail(403, 'FEATURE_DISABLED'); // server-side R2 refusal (CS-37)
  if (!freeOnly()) return fail(503, 'REJECTED'); // this deployment only supports FREE_ONLY_MODE
  if (!checkInput(body.job, body.input)) return fail(400, 'REJECTED');
  if (limited(caller)) return fail(429, 'QUOTA_EXHAUSTED');
  const started = Date.now();
  try {
    const model = textModel();
    const output = await generateJson(model, job.system, userPayload(body.job, body.input), job.schema);
    console.log(JSON.stringify({ job: body.job, outcome: 'SUCCESS', ms: Date.now() - started }));
    return json(200, { ok: true, output, execution: { executionId: crypto.randomUUID(), provider: 'gemini', model, durationMs: Date.now() - started } });
  } catch (e) {
    const kind = e instanceof GeminiError ? e.kind : 'UNAVAILABLE';
    console.log(JSON.stringify({ job: body.job, outcome: kind, ms: Date.now() - started }));
    return fail(kind === 'QUOTA_EXHAUSTED' ? 429 : kind === 'REJECTED' ? 400 : 503, kind);
  }
});
