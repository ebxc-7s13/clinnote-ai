/**
 * Transcript corrections (DATA_MODEL §3.2 rule 5, §5.3; ADR-038/043). A clinician text or speaker correction never
 * silently changes a fact: every current fact that cites the segment is flagged SOURCE_CHANGED (ineligible for
 * automatic input) and returns to review; re-extraction replaces untouched provisional facts only.
 */
import { refreshCandidateStaleness } from './candidates';
import { refreshEvidenceStaleness } from './evidence';
import { audit, isCurrent } from './facts';
import type { SpeakerRole, Visit } from './types';
import { nowIso } from './util';

export function correctSegment(v: Visit, segmentId: string, change: { text?: string; role?: SpeakerRole }, opts: { detach?: boolean } = { detach: true }): number {
  const s = v.segments.find((x) => x.segmentId === segmentId);
  if (!s) throw new Error('Segment not found.');
  const text = change.text?.trim();
  const textChanged = text !== undefined && text !== s.text;
  const roleChanged = change.role !== undefined && change.role !== s.speakerRole;
  if (!textChanged && !roleChanged) return 0;
  if (textChanged) {
    if (!text) throw new Error('A segment cannot be empty. Edit the words instead.');
    s.text = text;
    s.editedByClinician = true;
  }
  if (roleChanged) {
    s.speakerRole = change.role as SpeakerRole;
    // a per-segment relabel detaches the segment from its diarized speaker group
    if (opts.detach !== false) s.speakerId = `manual-${s.speakerRole}`;
  }
  let flagged = 0;
  const ts = nowIso();
  for (const f of v.facts) {
    if (!isCurrent(f) || !f.sourceSegmentIds.includes(segmentId)) continue;
    f.needsClarification = true;
    f.clarificationReason = 'SOURCE_CHANGED';
    f.updatedAt = ts;
    flagged++;
  }
  refreshEvidenceStaleness(v);
  refreshCandidateStaleness(v);
  audit(v, 'SEGMENT', segmentId, textChanged ? 'TEXT_CORRECTED' : 'ROLE_CHANGED', 'CLINICIAN', flagged ? `${flagged} fact(s) flagged source changed` : undefined);
  return flagged;
}

/** Index of the segment covering (or nearest after) the given time in seconds. */
export function segmentIndexAt(v: Visit, seconds: number): number {
  if (!v.segments.length) return -1;
  const i = v.segments.findIndex((s) => s.endTime >= seconds);
  return i === -1 ? v.segments.length - 1 : i;
}

/** "mm:ss", "h:mm:ss" or plain seconds → seconds; null when unparseable. */
export function parseTimestamp(input: string): number | null {
  const t = input.trim();
  if (!/^\d+(:\d{1,2}){0,2}$/.test(t)) return null;
  return t.split(':').reduce((acc, part) => acc * 60 + Number(part), 0);
}
