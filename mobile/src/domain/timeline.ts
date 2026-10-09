/**
 * Longitudinal timeline (UI-UX Screen 5, DATA_MODEL §10). Built by code from eligible facts only (§3.3a).
 * Assessments appear only when clinician-confirmed; provisional items stay labeled. Nothing is inferred:
 * a symptom absent from a later visit is shown as "not discussed", never "resolved".
 */
import { isEligible } from './facts';
import { renderFact } from './note';
import type { ClinicalFact, FactCategory, Visit } from './types';

export type TimelineFilter = 'ALL' | 'SYMPTOM' | 'MEDICATION' | 'INVESTIGATION' | 'ASSESSMENT' | 'FOLLOW_UP' | 'VITAL_SIGN' | 'ALLERGY' | 'HISTORY';

const FILTER_CATS: Record<Exclude<TimelineFilter, 'ALL'>, FactCategory[]> = {
  SYMPTOM: ['SYMPTOM'],
  MEDICATION: ['MEDICATION'],
  INVESTIGATION: ['INVESTIGATION'],
  ASSESSMENT: ['ASSESSMENT'],
  FOLLOW_UP: ['FOLLOW_UP'],
  VITAL_SIGN: ['VITAL_SIGN'],
  ALLERGY: ['ALLERGY'],
  HISTORY: ['HISTORY_MEDICAL', 'HISTORY_SURGICAL', 'HISTORY_FAMILY', 'HISTORY_SOCIAL'],
};

export interface TimelineEvent {
  fact: ClinicalFact;
  text: string;
  provisional: boolean;
}

export interface TimelineVisit {
  visit: Visit;
  events: TimelineEvent[];
}

function included(f: ClinicalFact): boolean {
  if (!isEligible(f) || f.conceptKey === 'ANY' && f.category !== 'ALLERGY') return false;
  if (f.category === 'PLAN' || f.category === 'OTHER' || f.category === 'EXAMINATION_FINDING' || f.category === 'DEMOGRAPHIC') return false;
  // only clinician-confirmed assessments enter the longitudinal record view
  if (f.category === 'ASSESSMENT') return f.status === 'CONFIRMED';
  return true;
}

/** Newest visit first; events inside a visit in transcript order. */
export function patientTimeline(visits: Visit[], filter: TimelineFilter = 'ALL'): TimelineVisit[] {
  const cats = filter === 'ALL' ? null : new Set(FILTER_CATS[filter]);
  return [...visits]
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .map((visit) => ({
      visit,
      events: visit.facts
        .filter((f) => included(f) && (!cats || cats.has(f.category)))
        .sort((a, b) => (a.sourceStartTime ?? Infinity) - (b.sourceStartTime ?? Infinity) || a.createdAt.localeCompare(b.createdAt))
        .map((fact) => ({ fact, text: renderFact(fact), provisional: fact.status !== 'CONFIRMED' })),
    }));
}

export interface SymptomCourseEntry {
  visit: Visit;
  fact?: ClinicalFact;
  /** Code-rendered: the stated state and attributes, or "not discussed". */
  text: string;
}

export interface SymptomCourse {
  key: string;
  label: string;
  entries: SymptomCourseEntry[];
}

/** One row per symptom concept across all visits, oldest first. Visits without a mention say "not discussed". */
export function symptomCourse(visits: Visit[]): SymptomCourse[] {
  const sorted = [...visits].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const keyOf = (f: ClinicalFact) => (f.conceptKey === 'UNMAPPED' ? `#${f.value.toLowerCase()}` : f.conceptKey);
  const labels = new Map<string, string>();
  for (const v of sorted) for (const f of v.facts.filter((x) => x.category === 'SYMPTOM' && isEligible(x))) if (!labels.has(keyOf(f))) labels.set(keyOf(f), f.normalizedValue ?? f.value);
  const out: SymptomCourse[] = [];
  for (const [key, label] of labels) {
    const firstIdx = sorted.findIndex((v) => v.facts.some((f) => f.category === 'SYMPTOM' && isEligible(f) && keyOf(f) === key));
    const entries = sorted.slice(firstIdx).map((visit) => {
      const fs = visit.facts.filter((f) => f.category === 'SYMPTOM' && isEligible(f) && keyOf(f) === key);
      const fact = fs[fs.length - 1];
      if (!fact) return { visit, text: 'not discussed this visit' };
      const state = fact.informationState === 'POSITIVE' ? 'present' : fact.informationState === 'NEGATIVE' ? 'denied / absent' : fact.informationState === 'UNKNOWN' ? 'unclear' : 'not discussed';
      const a = fact.attributes;
      const details = [a.duration && `duration ${a.duration}`, a.timing, a.severity, a.progression].filter(Boolean).join(', ');
      return { visit, fact, text: `${state}${details ? ` · ${details}` : ''}${fact.status !== 'CONFIRMED' ? ' · provisional' : ''}` };
    });
    out.push({ key, label, entries });
  }
  return out.sort((a, b) => a.label.localeCompare(b.label));
}
