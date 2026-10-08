/** HTTP helper for public evidence APIs: timeout, per-host spacing (rate limits), typed errors. No logging of content. */
export type FetchLike = (url: string, init?: { signal?: AbortSignal; headers?: Record<string, string> }) => Promise<{ status: number; ok: boolean; text(): Promise<string> }>;

export class ProviderError extends Error {
  constructor(
    public readonly kind: 'OFFLINE' | 'TIMEOUT' | 'RATE_LIMITED' | 'HTTP' | 'INVALID_RESPONSE' | 'NO_RESULTS',
    message: string,
  ) {
    super(message);
  }
}

const lastCall = new Map<string, number>();
/** Minimum spacing per host (ms). NCBI allows 3 req/s without a key; MedlinePlus 85/min; openFDA 240/min. */
const SPACING: Record<string, number> = {
  'eutils.ncbi.nlm.nih.gov': 400,
  'wsearch.nlm.nih.gov': 800,
  'api.fda.gov': 300,
  'rxnav.nlm.nih.gov': 100,
  'dailymed.nlm.nih.gov': 200,
  'www.ebi.ac.uk': 200,
  'clinicaltrials.gov': 200,
  'pubchem.ncbi.nlm.nih.gov': 250,
  'clinicaltables.nlm.nih.gov': 100,
};

let fetchImpl: FetchLike = (url, init) => fetch(url, init as RequestInit) as unknown as ReturnType<FetchLike>;
export function setFetch(f: FetchLike) {
  fetchImpl = f;
}
let sleepImpl = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
export function setSleep(f: (ms: number) => Promise<void>) {
  sleepImpl = f;
}

export async function getText(url: string, timeoutMs = 12000): Promise<{ status: number; body: string }> {
  const host = url.split('/')[2];
  const gap = SPACING[host] ?? 0;
  const prev = lastCall.get(host) ?? 0;
  const wait = prev + gap - Date.now();
  if (wait > 0) await sleepImpl(wait);
  lastCall.set(host, Date.now());
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { signal: ctrl.signal, headers: { Accept: 'application/json, text/xml' } });
    const body = await res.text();
    if (res.status === 429) throw new ProviderError('RATE_LIMITED', 'The source is busy. Try again later.');
    return { status: res.status, body };
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    if ((e as Error)?.name === 'AbortError') throw new ProviderError('TIMEOUT', 'The source did not respond in time.');
    throw new ProviderError('OFFLINE', 'No internet connection or the source is unreachable.');
  } finally {
    clearTimeout(timer);
  }
}

export async function getJson(url: string, timeoutMs?: number): Promise<unknown> {
  const { status, body } = await getText(url, timeoutMs);
  if (status === 404) throw new ProviderError('NO_RESULTS', 'No matching records.');
  if (status < 200 || status >= 300) throw new ProviderError('HTTP', `The source returned an error (${status}).`);
  try {
    return JSON.parse(body);
  } catch {
    throw new ProviderError('INVALID_RESPONSE', 'The source returned an unexpected response.');
  }
}

export function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

export function stripTags(s: string): string {
  return decodeEntities(s).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}
