/**
 * In-app reminders (ADR-053): computed on device from local records each time the app shows them. No system
 * notification, no notification permission, nothing leaves the device. Due dates come from stated follow-up
 * intervals (followUpDue); nothing is invented.
 */
import { activeRecordingSegment, needsReconciliation } from './consultation';
import type { PatientIndexEntry, Visit } from './types';
import { followUpDue, pendingFollowUps, unreviewedCount } from './views';

export type ReminderKind = 'RECORDING_INTERRUPTED' | 'FOLLOW_UP_OVERDUE' | 'FOLLOW_UP_SOON' | 'RECONCILE' | 'CONFLICTS' | 'CONSULTATION_OPEN' | 'UNREVIEWED' | 'NOTE_DRAFT' | 'FOLLOW_UP_UNDATED';

export interface Reminder {
  id: string;
  kind: ReminderKind;
  priority: number;
  title: string;
  detail: string;
  patientId: string;
  visitId: string;
  /** route to open */
  href: string;
  due?: string;
}

const PRIORITY: Record<ReminderKind, number> = {
  RECORDING_INTERRUPTED: 0,
  FOLLOW_UP_OVERDUE: 1,
  RECONCILE: 2,
  CONFLICTS: 3,
  FOLLOW_UP_SOON: 4,
  CONSULTATION_OPEN: 5,
  UNREVIEWED: 6,
  NOTE_DRAFT: 7,
  FOLLOW_UP_UNDATED: 8,
};

export function buildReminders(patients: PatientIndexEntry[], visitsByPatient: Record<string, Visit[]>, today: string): Reminder[] {
  const out: Reminder[] = [];
  const soon = new Date(new Date(`${today}T00:00:00Z`).getTime() + 7 * 86400000).toISOString().slice(0, 10);
  for (const p of patients) {
    const visits = visitsByPatient[p.patientId] ?? [];
    for (const v of visits) {
      const base = `/visit/${v.patientId}/${v.visitId}`;
      const push = (kind: ReminderKind, title: string, detail: string, href = base, due?: string) => out.push({ id: `${kind}|${v.visitId}|${title}`, kind, priority: PRIORITY[kind], title, detail, patientId: p.patientId, visitId: v.visitId, href, due });
      const tag = `${p.patientReference} · ${v.visitCode}`;
      const active = activeRecordingSegment(v);
      if (active) push('RECORDING_INTERRUPTED', `Recording ${active.status === 'PAUSED' ? 'paused' : 'interrupted'}`, `${tag} · ${active.displayCode}`, `${base}/record`);
      if (needsReconciliation(v)) push('RECONCILE', 'Reconcile visit', `${tag} · new conversation since facts were extracted`, `${base}/transcript?reconcile=1`);
      const conflicts = v.conflicts.filter((c) => c.status === 'OPEN').length;
      if (conflicts) push('CONFLICTS', `${conflicts} open conflict(s)`, tag, `${base}/facts`);
      if (!active && v.mode === 'AMBIENT' && v.recordingSegments.length && v.consultationState === 'OPEN' && v.consent?.state === 'CONFIRMED') push('CONSULTATION_OPEN', 'Consultation not finalized', tag, `${base}/record`);
      const n = unreviewedCount(v);
      if (n) push('UNREVIEWED', `${n} fact(s) to review`, tag, `${base}/facts`);
      if (v.noteState === 'DRAFT' || v.noteState === 'EDITED') push('NOTE_DRAFT', 'Note not finalized', tag, `${base}/note`);
    }
    for (const { fact, visit } of pendingFollowUps(visits)) {
      const due = followUpDue(fact, visit);
      const href = '/followups';
      const label = fact.value.length > 60 ? `${fact.value.slice(0, 57)}…` : fact.value;
      const base = { patientId: p.patientId, visitId: visit.visitId, href };
      if (!due) out.push({ ...base, id: `FU|${fact.factId}`, kind: 'FOLLOW_UP_UNDATED', priority: PRIORITY.FOLLOW_UP_UNDATED, title: 'Follow-up (no date stated)', detail: `${p.patientReference} · ${label}` });
      else if (due.date < today) out.push({ ...base, id: `FU|${fact.factId}`, kind: 'FOLLOW_UP_OVERDUE', priority: PRIORITY.FOLLOW_UP_OVERDUE, title: 'Follow-up overdue', detail: `${p.patientReference} · ${label}`, due: due.date });
      else if (due.date <= soon) out.push({ ...base, id: `FU|${fact.factId}`, kind: 'FOLLOW_UP_SOON', priority: PRIORITY.FOLLOW_UP_SOON, title: 'Follow-up due soon', detail: `${p.patientReference} · ${label}`, due: due.date });
    }
  }
  return out.sort((a, b) => a.priority - b.priority || (a.due ?? '').localeCompare(b.due ?? '') || a.detail.localeCompare(b.detail));
}
