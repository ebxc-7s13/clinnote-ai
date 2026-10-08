/**
 * Deterministic text primitives used by extraction and validation (AI.md §5.1 rules 2, 3, 9, 17, 19).
 */
import {
  FAMILY_MEMBERS,
  HEDGE_CUES,
  HYPOTHETICAL_CUES,
  NEGATION_CUES,
  NUMBER_WORDS,
  QUESTION_OPENERS,
  STOPWORDS,
  SYNONYMS,
} from './lexicon';
import { normalizeText, tokens } from './util';

/** Replaces spelled-out numbers with digits ("five hundred" → "500", "twenty one" → "21"). Tested converter. */
export function wordsToDigits(text: string): string {
  const words = text.split(/(\s+)/);
  const out: string[] = [];
  let i = 0;
  while (i < words.length) {
    const w = words[i].toLowerCase().replace(/[^a-z-]/g, '');
    const parts = w.split('-');
    const isNum = (x: string) => x in NUMBER_WORDS && x !== 'a' && x !== 'an';
    if (w && parts.every(isNum)) {
      let total = 0;
      let current = 0;
      let j = i;
      let consumed = i;
      while (j < words.length) {
        const token = words[j].toLowerCase().replace(/[^a-z-]/g, '');
        if (/^\s+$/.test(words[j])) {
          j++;
          continue;
        }
        if (token === 'and' && j + 2 < words.length && isNum(words[j + 2].toLowerCase().replace(/[^a-z-]/g, ''))) {
          j++;
          continue;
        }
        const ps = token.split('-');
        if (!token || !ps.every(isNum)) break;
        for (const p of ps) {
          const v = NUMBER_WORDS[p];
          if (v === 100) current = (current || 1) * 100;
          else if (v === 1000) {
            total += (current || 1) * 1000;
            current = 0;
          } else current += v;
        }
        consumed = j;
        j++;
      }
      const trailing = words[consumed].match(/[^A-Za-z-]+$/)?.[0] ?? '';
      out.push(String(total + current) + trailing);
      i = consumed + 1;
      continue;
    }
    out.push(words[i]);
    i++;
  }
  return out.join('');
}

/** All numbers appearing in a string (digits, after number-word conversion). */
export function numbersIn(text: string): string[] {
  return (wordsToDigits(text).match(/\d+(?:\.\d+)?/g) ?? []).map((n) => String(Number(n)));
}

/** Normalized comparison form: number words → digits, then normalizeText. */
export function cmp(text: string): string {
  return normalizeText(wordsToDigits(text));
}

/** Clause splitting for cue scoping (rule 19). Splits on sentence punctuation, "but", and "and I/my" boundaries. */
export function splitClauses(text: string): string[] {
  return text
    .split(/(?<=[.;!?])\s+|\s+but\s+|,\s*but\s+|\s+(?=and (?:i|i'm|i've|my|we)\b)/i)
    .map((c) => c.replace(/^and\s+/i, '').trim())
    .filter(Boolean);
}

function hasCue(clauseNorm: string, cues: string[]): string | null {
  for (const cue of cues) {
    const re = new RegExp(`(^|\\s)${cue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`);
    if (re.test(clauseNorm)) return cue;
  }
  return null;
}

export interface ClauseContext {
  clause: string;
  negation: string | null;
  hedge: string | null;
  hypothetical: string | null;
  experiencer: string | null;
  question: boolean;
  notDiscussed: boolean;
}

export function clauseContext(clause: string): ClauseContext {
  const n = ` ${normalizeText(clause)} `.replace(/\s+/g, ' ');
  const trimmed = n.trim();
  const famRe = new RegExp(`\\b(my|his|her|their|our|your)\\s+(${FAMILY_MEMBERS.join('|')})\\b`);
  const fam = trimmed.match(famRe);
  const familyHistory = /\bfamily history\b|\bruns in the family\b/.test(trimmed);
  const question =
    /\?\s*$/.test(clause.trim()) || QUESTION_OPENERS.some((q) => trimmed === q || trimmed.startsWith(`${q} `));
  const notDiscussed = /\bnot (been )?(discussed|asked|mentioned|covered|reviewed)\b/.test(trimmed);
  return {
    clause,
    negation: notDiscussed ? null : hasCue(trimmed, NEGATION_CUES),
    hedge: hasCue(trimmed, HEDGE_CUES),
    hypothetical: hasCue(trimmed, HYPOTHETICAL_CUES),
    experiencer: fam ? fam[0] : familyHistory ? 'family history' : null,
    question,
    notDiscussed,
  };
}

const NEG_TERMINATORS = new Set(['but', 'has', 'have', 'had', 'reports', 'reported', 'complains', 'with', 'except', 'however', 'although', 'though', 'now', 'still', 'gets', 'get']);

/**
 * Term-scoped negation (NegEx-style): a negation cue within 6 tokens before the span, with no terminator word in
 * between, or a post-cue right after the span ("fever is absent"). Rule 3 / rule 19.
 */
export function isNegatedSpan(clause: string, span: string): boolean {
  const c = tokens(wordsToDigits(clause));
  const s = tokens(wordsToDigits(span));
  if (!s.length) return false;
  let pos = -1;
  for (let i = 0; i + s.length <= c.length; i++) {
    if (s.every((t, k) => c[i + k] === t)) {
      pos = i;
      break;
    }
  }
  if (pos < 0) return false;
  // a negation cue inside the span itself ("no fever") counts
  const singleCues = NEGATION_CUES.filter((x) => !x.includes(' '));
  if (s.some((t) => singleCues.includes(t))) return true;
  for (let k = pos - 1; k >= Math.max(0, pos - 6); k--) {
    const t = c[k];
    if (NEG_TERMINATORS.has(t)) {
      // "don't have", "never had": the terminator belongs to the negation
      if (k > 0 && singleCues.includes(c[k - 1])) return true;
      break;
    }
    if (singleCues.includes(t)) return true;
    if (k > 0 && `${c[k - 1]} ${t}` === 'negative for') return true;
    if (k > 0 && `${c[k - 1]} ${t}` === 'free of') return true;
  }
  const after = c.slice(pos + s.length, pos + s.length + 3).join(' ');
  return /^(is |was |are )?(absent|negative|none|nil)\b/.test(after);
}

/** Finds the clause of `segmentText` that contains `value` (normalized), or null. */
export function clauseContaining(segmentText: string, value: string): string | null {
  const v = cmp(value);
  if (!v) return null;
  for (const c of splitClauses(segmentText)) if (cmp(c).includes(v)) return c;
  return cmp(segmentText).includes(v) ? segmentText : null;
}

/** Rule 17a: value is a contiguous span of the segment after deterministic normalization (word-aligned). */
export function isSpan(segmentText: string, value: string): boolean {
  const v = cmp(value);
  if (!v) return false;
  return ` ${cmp(segmentText)} `.includes(` ${v} `);
}

export function contentTokens(text: string): string[] {
  return tokens(wordsToDigits(text)).filter((t) => !STOPWORDS.has(t));
}

/** Rule 17b: every content token appears in the cited texts or is a normalization-table form of a phrase there. */
export function tokensGrounded(value: string, sourceTexts: string[]): boolean {
  const src = sourceTexts.map((s) => ` ${cmp(s)} `).join(' ');
  const synonymsInSource = new Set<string>();
  for (const [phrase, canon] of Object.entries(SYNONYMS)) {
    if (src.includes(` ${phrase} `)) for (const t of canon.split(' ')) synonymsInSource.add(t);
  }
  return contentTokens(value).every((t) => src.includes(` ${t} `) || synonymsInSource.has(t));
}

/** Rule 17c helper: phrases from a list that occur (word-bounded) in text. */
export function phrasesIn(text: string, phrases: string[]): string[] {
  const n = ` ${cmp(text)} `;
  return phrases.filter((p) => n.includes(` ${cmp(p)} `));
}

/** Parses a stated duration into days for deterministic comparison (e.g. "3 weeks" → 21). Null if absent. */
export function durationDays(text: string): number | null {
  const m = wordsToDigits(text.toLowerCase()).match(/(\d+(?:\.\d+)?)\s*(day|days|week|weeks|month|months|year|years)\b/);
  if (m) {
    const n = Number(m[1]);
    const unit = m[2];
    if (unit.startsWith('day')) return n;
    if (unit.startsWith('week')) return n * 7;
    if (unit.startsWith('month')) return n * 30;
    return n * 365;
  }
  if (/\b(a|one) (day|week|month|year)\b/.test(text.toLowerCase())) {
    const u = text.toLowerCase().match(/\b(?:a|one) (day|week|month|year)\b/)?.[1];
    return u === 'day' ? 1 : u === 'week' ? 7 : u === 'month' ? 30 : 365;
  }
  return null;
}
