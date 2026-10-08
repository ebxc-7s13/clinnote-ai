/** Small pure helpers shared by the domain layer. No platform imports. */

let idSource: () => string = () => {
  // RFC4122 v4 from Math.random is sufficient for local record IDs (not a security token).
  const h = '0123456789abcdef';
  let s = '';
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) s += '-';
    else if (i === 14) s += '4';
    else if (i === 19) s += h[(Math.random() * 4) | 8];
    else s += h[(Math.random() * 16) | 0];
  }
  return s;
};

export function newId(): string {
  return idSource();
}

/** Tests can make IDs deterministic. */
export function setIdSource(fn: () => string): void {
  idSource = fn;
}

let clock: () => Date = () => new Date();
export function nowIso(): string {
  return clock().toISOString();
}
export function setClock(fn: () => Date): void {
  clock = fn;
}

export function pad(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

/** Deterministic normalization used for grounding comparisons (AI.md §5.1 rule 17). */
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^\p{L}\p{N}'./ ]+/gu, ' ')
    .replace(/(?<!\d)\.|\.(?!\d)/g, ' ')
    .replace(/(^|\s)'+|'+(\s|$)/g, '$1$2')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokens(s: string): string[] {
  return normalizeText(s)
    .split(' ')
    .map((t) => t.replace(/^[.']+|[.']+$/g, ''))
    .filter(Boolean);
}

export function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h > 0 ? `${h}:${pad(m, 2)}:${pad(r, 2)}` : `${pad(m, 2)}:${pad(r, 2)}`;
}

export function formatDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${pad(d.getDate(), 2)} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatDateTime(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${formatDate(iso)} ${pad(d.getHours(), 2)}:${pad(d.getMinutes(), 2)}`;
}

export function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}
