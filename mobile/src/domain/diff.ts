/**
 * Deterministic return-visit comparison (ARCHITECTURE §6.6, ADR-045 d5, FR-25.x). Text is rendered by code from
 * stated values; arithmetic on stated numbers is done by code; no trend/judgement words are invented.
 * Absence is "not discussed this visit", never "resolved" or "discontinued".
 */
import { isEligible } from './facts';
import { durationDays } from './text';
import type { ClinicalFact, Visit } from './types';
import { formatDate } from './util';

export type DiffKind = 'NEW' | 'CHANGED' | 'NOT_DISCUSSED_NOW' | 'STATE_CHANGED' | 'UNCHANGED';
export interface DiffItem {
  kind: DiffKind;
  category: ClinicalFact['category'];
  text: string;
  previous?: ClinicalFact;
  current?: ClinicalFact;
  provisional: boolean;
}

export const VITAL_LABEL: Record<string, string> = {
  BP: 'Blood pressure',
  PULSE: 'Pulse',
  TEMPERATURE: 'Temperature',
  SPO2: 'Oxygen saturation',
  WEIGHT: 'Weight',
  HEIGHT: 'Height',
  GLUCOSE: 'Glucose',
};

export function vitalText(f: ClinicalFact): string {
  const a = f.attributes;
  if (a.vitalKind === 'BP' && a.numericValue2 !== undefined) return `${a.numericValue}/${a.numericValue2} ${a.unit ?? ''}`.trim();
  return `${a.numericValue ?? f.value}${a.unit ? ` ${a.unit}` : ''}`;
}

function label(f: ClinicalFact): string {
  if (f.category === 'VITAL_SIGN') return VITAL_LABEL[f.attributes.vitalKind ?? ''] ?? f.value;
  if (f.category === 'MEDICATION') return f.attributes.rawName ?? f.normalizedValue ?? f.value;
  if (f.category === 'INVESTIGATION') return f.attributes.testName ?? f.value;
  return f.normalizedValue ?? (f.conceptKey !== 'UNMAPPED' ? f.conceptKey : f.value);
}

const keyOf = (f: ClinicalFact) => `${f.category}|${f.category === 'VITAL_SIGN' ? f.attributes.vitalKind : f.conceptKey === 'UNMAPPED' ? f.value.toLowerCase() : f.conceptKey}`;
const fmtNum = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export function compareVisits(previous: Visit, current: Visit): DiffItem[] {
  const take = (v: Visit) => {
    const m = new Map<string, ClinicalFact>();
    for (const f of v.facts.filter((x) => isEligible(x) && x.conceptKey !== 'ANY' && !['PLAN', 'OTHER', 'EXAMINATION_FINDING'].includes(x.category))) {
      m.set(keyOf(f), f); // last statement in the visit wins for display; conflicts are shown separately
    }
    return m;
  };
  const prev = take(previous);
  const cur = take(current);
  const pDate = formatDate(previous.startedAt);
  const out: DiffItem[] = [];
  const prov = (...fs: (ClinicalFact | undefined)[]) => fs.some((f) => f && f.status !== 'CONFIRMED');

  for (const [k, c] of cur) {
    const p = prev.get(k);
    const L = label(c);
    if (!p) {
      out.push({ kind: 'NEW', category: c.category, current: c, provisional: prov(c), text: c.category === 'MEDICATION' ? `${L}: newly documented this visit (added)` : `${L}: newly documented this visit` });
      continue;
    }
    if (p.informationState !== c.informationState) {
      out.push({ kind: 'STATE_CHANGED', category: c.category, previous: p, current: c, provisional: prov(p, c), text: `${L}: stated as ${p.informationState.toLowerCase()} on ${pDate}, ${c.informationState.toLowerCase()} this visit` });
      continue;
    }
    if (c.category === 'VITAL_SIGN') {
      const a = p.attributes.numericValue;
      const b = c.attributes.numericValue;
      if (a !== undefined && b !== undefined && (a !== b || p.attributes.numericValue2 !== c.attributes.numericValue2)) {
        const delta = c.attributes.vitalKind === 'BP' ? '' : ` (${b - a > 0 ? '+' : '−'}${fmtNum(Math.abs(b - a))}${c.attributes.unit ? ` ${c.attributes.unit}` : ''})`;
        out.push({ kind: 'CHANGED', category: c.category, previous: p, current: c, provisional: prov(p, c), text: `${L} changed from ${vitalText(p)} to ${vitalText(c)}${delta}` });
      } else out.push({ kind: 'UNCHANGED', category: c.category, previous: p, current: c, provisional: prov(p, c), text: `${L}: ${vitalText(c)} (same as ${pDate})` });
      continue;
    }
    if (c.category === 'SYMPTOM') {
      const a = p.attributes.duration;
      const b = c.attributes.duration;
      const da = a ? durationDays(a) : null;
      const db = b ? durationDays(b) : null;
      if (a && b && da !== null && db !== null && da !== db) {
        out.push({ kind: 'CHANGED', category: c.category, previous: p, current: c, provisional: prov(p, c), text: `${L}: stated duration ${db > da ? 'increased' : 'decreased'} from ${a} to ${b}` });
        continue;
      }
      if (p.attributes.severity !== c.attributes.severity && p.attributes.severity && c.attributes.severity) {
        out.push({ kind: 'CHANGED', category: c.category, previous: p, current: c, provisional: prov(p, c), text: `${L}: severity stated as "${p.attributes.severity}" on ${pDate}, "${c.attributes.severity}" this visit` });
        continue;
      }
    }
    if (c.category === 'MEDICATION') {
      const pd = p.attributes.dose;
      const cd = c.attributes.dose;
      if (pd && cd && pd !== cd) {
        out.push({ kind: 'CHANGED', category: c.category, previous: p, current: c, provisional: prov(p, c), text: `${L}: dose stated as ${pd} on ${pDate}, ${cd} this visit` });
        continue;
      }
      if (p.attributes.takingStatus !== c.attributes.takingStatus && c.attributes.takingStatus) {
        out.push({ kind: 'CHANGED', category: c.category, previous: p, current: c, provisional: prov(p, c), text: `${L}: status ${String(p.attributes.takingStatus ?? 'not stated').toLowerCase()} on ${pDate}, ${c.attributes.takingStatus.toLowerCase()} this visit` });
        continue;
      }
    }
    if (c.category === 'INVESTIGATION' && p.attributes.investigationStatus !== c.attributes.investigationStatus) {
      out.push({ kind: 'CHANGED', category: c.category, previous: p, current: c, provisional: prov(p, c), text: `${L}: ${String(p.attributes.investigationStatus ?? 'unknown').toLowerCase().replace('_', ' ')} on ${pDate}, ${String(c.attributes.investigationStatus ?? 'unknown').toLowerCase().replace('_', ' ')} this visit${c.attributes.result ? ` (result stated: ${c.attributes.result})` : ''}` });
      continue;
    }
    out.push({ kind: 'UNCHANGED', category: c.category, previous: p, current: c, provisional: prov(p, c), text: `${L}: documented again this visit` });
  }
  for (const [k, p] of prev) {
    if (cur.has(k)) continue;
    out.push({
      kind: 'NOT_DISCUSSED_NOW',
      category: p.category,
      previous: p,
      provisional: prov(p),
      text: p.category === 'MEDICATION' ? `${label(p)}: not discussed this visit (not discontinued)` : `${label(p)}: not discussed this visit (documented ${pDate})`,
    });
  }
  const order: DiffKind[] = ['CHANGED', 'STATE_CHANGED', 'NEW', 'NOT_DISCUSSED_NOW', 'UNCHANGED'];
  return out.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
}
