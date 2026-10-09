/**
 * Transcript corrections (DATA_MODEL §3.2 rule 5, §5.3; ADR-038/043). A clinician text or speaker correction never
 * silently changes a fact: every current fact that cites the segment is flagged SOURCE_CHANGED (ineligible for
 * automatic input) and returns to review; re-extraction replaces untouched provisional facts only.
 */
import { refreshCandidateStaleness } from './candidates';
import { bumpTranscript, nextDisplayCode } from './consultation';
import { refreshEvidenceStaleness } from './evidence';
import { audit, isCurrent } from './facts';
import type { SpeakerRole, TranscriptSegment, Visit } from './types';
import { newId, nowIso } from './util';

/** Every current fact citing one of the segments returns to review (SOURCE_CHANGED). Returns the count. */
function flagCitingFacts(v: Visit, segmentIds: string[]): number {
  let flagged = 0;
  const ts = nowIso();
  for (const f of v.facts) {
    if (!isCurrent(f) || !f.sourceSegmentIds.some((id) => segmentIds.includes(id))) continue;
    f.needsClarification = true;
    f.clarificationReason = 'SOURCE_CHANGED';
    f.updatedAt = ts;
    flagged++;
  }
  if (flagged) {
    refreshEvidenceStaleness(v);
    refreshCandidateStaleness(v);
  }
  return flagged;
}

function seg(v: Visit, segmentId: string): TranscriptSegment {
  const s = v.segments.find((x) => x.segmentId === segmentId);
  if (!s) throw new Error('Segment not found.');
  return s;
}

export function correctSegment(v: Visit, segmentId: string, change: { text?: string; role?: SpeakerRole }, opts: { detach?: boolean } = { detach: true }): number {
  const s = v.segments.find((x) => x.segmentId === segmentId);
  if (!s) throw new Error('Segment not found.');
  const text = change.text?.trim();
  const textChanged = text !== undefined && text !== s.text;
  const roleChanged = change.role !== undefined && change.role !== s.speakerRole;
  if (!textChanged && !roleChanged) return 0;
  if (textChanged && !text) throw new Error('A segment cannot be empty. Edit the words instead.');
  // the original wording and speaker are kept in the revision history (never lost)
  bumpTranscript(v, { segmentId, action: textChanged ? 'TEXT_CORRECTED' : 'ROLE_CHANGED', previousText: textChanged ? s.text : undefined, previousRole: roleChanged ? s.speakerRole : undefined });
  if (textChanged) {
    s.text = text as string;
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

/**
 * Splits one utterance at a character offset into two. The first part keeps the segment id; facts citing it
 * return to review. Both parts keep speaker, segment and language; times are divided by text length.
 */
export function splitSegment(v: Visit, segmentId: string, at: number): TranscriptSegment {
  const s = seg(v, segmentId);
  const a = s.text.slice(0, at).trim();
  const b = s.text.slice(at).trim();
  if (!a || !b) throw new Error('Choose a split point inside the text.');
  const mid = Math.round((s.startTime + ((s.endTime - s.startTime) * a.length) / s.text.length) * 10) / 10;
  bumpTranscript(v, { segmentId, action: 'SPLIT', previousText: s.text });
  const second: TranscriptSegment = { ...s, segmentId: newId(), displayCode: nextDisplayCode(v), text: b, startTime: mid, origin: 'SPLIT', addedAt: nowIso(), possibleRepeatOf: undefined };
  s.text = a;
  s.endTime = mid;
  s.editedByClinician = true;
  v.segments.splice(v.segments.indexOf(s) + 1, 0, second);
  flagCitingFacts(v, [segmentId]);
  audit(v, 'SEGMENT', segmentId, 'SPLIT', 'CLINICIAN', `${s.displayCode} → ${s.displayCode} + ${second.displayCode}`);
  return second;
}

/** Next non-excluded utterance in the same recording segment, or undefined. */
export function nextInSegment(v: Visit, segmentId: string): TranscriptSegment | undefined {
  const s = seg(v, segmentId);
  const i = v.segments.indexOf(s);
  return v.segments.slice(i + 1).find((x) => !x.excluded && x.recordingSegmentId === s.recordingSegmentId);
}

/** Merge is allowed only with the next utterance of the same speaker role in the same recording segment. */
export function canMergeWithNext(v: Visit, segmentId: string): boolean {
  const s = seg(v, segmentId);
  const n = nextInSegment(v, segmentId);
  return !!n && n.speakerRole === s.speakerRole && !s.excluded;
}

/** Merges the next utterance into this one. The merged-away utterance is kept, excluded (MERGED), as evidence. */
export function mergeWithNext(v: Visit, segmentId: string): void {
  if (!canMergeWithNext(v, segmentId)) throw new Error('Only adjacent utterances by the same speaker can be merged.');
  const s = seg(v, segmentId);
  const n = nextInSegment(v, segmentId) as TranscriptSegment;
  bumpTranscript(v, { segmentId, action: 'MERGED', previousText: s.text });
  s.text = `${s.text.replace(/\s+$/, '')} ${n.text}`.trim();
  s.endTime = Math.max(s.endTime, n.endTime);
  s.editedByClinician = true;
  n.excluded = { reason: 'MERGED', at: nowIso(), mergedIntoSegmentId: s.segmentId };
  flagCitingFacts(v, [s.segmentId, n.segmentId]);
  audit(v, 'SEGMENT', segmentId, 'MERGED', 'CLINICIAN', `${n.displayCode} merged into ${s.displayCode}`);
}

/** Clinician-confirmed exclusion (e.g. an accidental duplicate). The text stays in the record and can be restored. */
export function excludeSegment(v: Visit, segmentId: string, reason: 'DUPLICATE' | 'ACCIDENTAL'): number {
  const s = seg(v, segmentId);
  if (s.excluded) return 0;
  s.excluded = { reason, at: nowIso() };
  bumpTranscript(v, { segmentId, action: 'EXCLUDED' });
  audit(v, 'SEGMENT', segmentId, 'EXCLUDED', 'CLINICIAN', reason.toLowerCase());
  return flagCitingFacts(v, [segmentId]);
}

export function restoreSegment(v: Visit, segmentId: string): void {
  const s = seg(v, segmentId);
  if (!s.excluded) return;
  if (s.excluded.reason === 'MERGED') throw new Error('This utterance was merged into another one; edit that utterance instead.');
  s.excluded = undefined;
  bumpTranscript(v, { segmentId, action: 'RESTORED' });
  audit(v, 'SEGMENT', segmentId, 'RESTORED', 'CLINICIAN');
}

/** Marks speech as uncertain: facts from it return to review and new extraction flags it UNCERTAIN_SPEECH. */
export function markSegmentUncertain(v: Visit, segmentId: string, uncertain = true): number {
  const s = seg(v, segmentId);
  if (!!s.clinicianMarkedUncertain === uncertain) return 0;
  s.clinicianMarkedUncertain = uncertain;
  bumpTranscript(v, { segmentId, action: 'MARKED_UNCERTAIN' });
  audit(v, 'SEGMENT', segmentId, uncertain ? 'MARKED_UNCERTAIN' : 'UNCERTAIN_CLEARED', 'CLINICIAN');
  return flagCitingFacts(v, [segmentId]);
}

/** Clinician-typed utterance, appended to the given (or last) recording segment; speaker role confirmed. */
export function addManualSegment(v: Visit, input: { text: string; role: SpeakerRole; recordingSegmentId?: string; language?: string }): TranscriptSegment {
  const text = input.text.trim();
  if (!text) throw new Error('Type the words that were said.');
  const rs = input.recordingSegmentId ? v.recordingSegments.find((x) => x.recordingSegmentId === input.recordingSegmentId) : v.recordingSegments[v.recordingSegments.length - 1];
  const inSeg = v.segments.filter((x) => x.recordingSegmentId === rs?.recordingSegmentId);
  const t = inSeg.length ? Math.max(...inSeg.map((x) => x.endTime)) : (rs?.clockOffsetSec ?? 0);
  const s: TranscriptSegment = {
    segmentId: newId(),
    displayCode: nextDisplayCode(v),
    speakerId: `manual-${input.role}`,
    speakerRole: input.role,
    speakerRoleConfirmed: true,
    text,
    startTime: t,
    endTime: t,
    confidence: 'HIGH',
    isFinal: true,
    editedByClinician: true,
    sourceProvider: 'clinician-typed',
    recordingSegmentId: rs?.recordingSegmentId,
    language: input.language ?? rs?.language,
    addedAt: nowIso(),
    origin: 'MANUAL',
  };
  const lastIdx = v.segments.map((x) => x.recordingSegmentId).lastIndexOf(rs?.recordingSegmentId);
  v.segments.splice(lastIdx < 0 ? v.segments.length : lastIdx + 1, 0, s);
  if (v.transcriptSource === 'NONE') v.transcriptSource = 'MANUAL';
  if (v.transcriptState === 'NOT_STARTED' || v.transcriptState === 'FAILED') v.transcriptState = 'COMPLETED';
  bumpTranscript(v, { segmentId: s.segmentId, action: 'MANUAL_ADDED' });
  audit(v, 'SEGMENT', s.segmentId, 'MANUAL_ADDED', 'CLINICIAN');
  return s;
}
