/**
 * Multi-segment consultations (ADR-050, DATA_MODEL §4.3a). A visit holds one or more recording segments
 * (SEG-0001, SEG-0002 …). Finishing a segment never finalizes the consultation; finalizing is a separate,
 * explicit clinician action, and "add more conversation" reopens it without touching earlier data.
 *
 * Time policy: every stored timestamp is a UTC ISO-8601 string; the UI shows device local time. The visit's
 * `startedAt` is the original encounter time and is never reset. Utterance start/end times are seconds on the
 * visit recording clock (pauses excluded), so the canonical order is deterministic.
 */
import { audit, isCurrent } from './facts';
import type { RecordingSegment, SegmentRevision, SpeakerRole, TranscriptSegment, Visit } from './types';
import { SCHEMA_VERSION } from './types';
import { newId, normalizeText, nowIso, pad } from './util';

export const activeRecordingSegment = (v: Visit): RecordingSegment | undefined =>
  v.recordingSegments.find((s) => s.status === 'RECORDING' || s.status === 'PAUSED');

export const lastRecordingSegment = (v: Visit): RecordingSegment | undefined => v.recordingSegments[v.recordingSegments.length - 1];

/** Total recorded seconds across all segments (pauses excluded). */
export function totalRecordedSec(v: Visit): number {
  return v.recordingSegments.length ? v.recordingSegments.reduce((a, s) => a + s.durationSec, 0) : v.recordingDurationSec;
}

/** True when extraction already ran and the transcript changed since (new conversation, corrections). */
export const needsReconciliation = (v: Visit): boolean =>
  v.reconciledTranscriptVersion !== undefined && v.reconciledTranscriptVersion !== v.transcriptVersion;

export function bumpTranscript(v: Visit, revision?: Omit<SegmentRevision, 'revisionId' | 'transcriptVersion' | 'at'>): void {
  v.transcriptVersion += 1;
  if (revision) v.segmentRevisions.push({ ...revision, revisionId: newId(), transcriptVersion: v.transcriptVersion, at: nowIso() });
}

/**
 * Starts a new recording segment. Idempotent: if a segment is already recording or paused it is returned
 * unchanged, so a double press never creates two segments. Reopens a finalized consultation (audited).
 */
export function beginRecordingSegment(v: Visit, opts: { language: string; provider: string }): RecordingSegment {
  if (v.consent?.state !== 'CONFIRMED') throw new Error('Consent must be confirmed before recording.');
  const open = activeRecordingSegment(v);
  if (open) return open;
  if (v.consultationState === 'FINALIZED') reopenConsultation(v);
  const ts = nowIso();
  const index = v.recordingSegments.length + 1;
  const seg: RecordingSegment = {
    recordingSegmentId: newId(),
    displayCode: `SEG-${pad(index, 4)}`,
    index,
    startedAt: ts,
    status: 'RECORDING',
    transcriptionStatus: 'IN_PROGRESS',
    language: opts.language,
    provider: opts.provider,
    clockOffsetSec: totalRecordedSec(v),
    durationSec: 0,
    pauses: [],
    createdAt: ts,
  };
  v.recordingSegments.push(seg);
  v.recordingState = 'RECORDING';
  v.transcriptState = 'IN_PROGRESS';
  audit(v, 'RECORDING_SEGMENT', seg.recordingSegmentId, 'RECORDING_STARTED', 'CLINICIAN', seg.displayCode);
  return seg;
}

export function pauseRecordingSegment(v: Visit, segmentDurationSec?: number): void {
  const s = activeRecordingSegment(v);
  if (!s || s.status === 'PAUSED') return;
  s.status = 'PAUSED';
  if (segmentDurationSec !== undefined) s.durationSec = Math.max(s.durationSec, Math.round(segmentDurationSec));
  s.pauses.push({ pausedAt: nowIso() });
  v.recordingState = 'PAUSED';
  audit(v, 'RECORDING_SEGMENT', s.recordingSegmentId, 'RECORDING_PAUSED');
}

export function resumeRecordingSegment(v: Visit): void {
  const s = activeRecordingSegment(v);
  if (!s || s.status !== 'PAUSED') return;
  s.status = 'RECORDING';
  const p = s.pauses[s.pauses.length - 1];
  if (p && !p.resumedAt) p.resumedAt = nowIso();
  v.recordingState = 'RECORDING';
  audit(v, 'RECORDING_SEGMENT', s.recordingSegmentId, 'RECORDING_RESUMED');
}

/**
 * Finishes the active segment and keeps every utterance. Returns null when no segment is active (idempotent).
 * Visit `startedAt` is untouched; `endedAt` moves to the end of the latest segment.
 */
export function completeRecordingSegment(v: Visit, segmentDurationSec?: number): RecordingSegment | null {
  const s = activeRecordingSegment(v);
  if (!s) return null;
  const ts = nowIso();
  const p = s.pauses[s.pauses.length - 1];
  if (p && !p.resumedAt) p.resumedAt = ts;
  if (segmentDurationSec !== undefined) s.durationSec = Math.max(s.durationSec, Math.round(segmentDurationSec));
  s.status = 'COMPLETED';
  s.endedAt = ts;
  const n = v.segments.filter((u) => u.recordingSegmentId === s.recordingSegmentId).length;
  s.transcriptionStatus = n ? 'COMPLETED' : 'EMPTY';
  v.recordingState = 'STOPPED';
  v.recordingDurationSec = totalRecordedSec(v);
  v.endedAt = ts;
  const any = v.segments.some((u) => !u.excluded);
  v.transcriptState = any ? 'COMPLETED' : 'FAILED';
  if (v.transcriptSource === 'NONE' && any) v.transcriptSource = 'LIVE_DEVICE';
  // new speech needs its speakers confirmed before it can be used for facts (DATA_MODEL §3.2 rule 5)
  if (n && v.speakerMappingState === 'COMPLETED' && v.segments.some((u) => u.recordingSegmentId === s.recordingSegmentId && !u.speakerRoleConfirmed)) v.speakerMappingState = 'PARTIAL';
  audit(v, 'RECORDING_SEGMENT', s.recordingSegmentId, 'RECORDING_STOPPED', 'CLINICIAN', `${s.displayCode}: ${n} utterance(s)`);
  return s;
}

/** Explicit clinician action. Requires no active segment. Confirms nothing (CS-25). */
export function finalizeConsultation(v: Visit): void {
  if (activeRecordingSegment(v)) throw new Error('Finish the current recording segment first.');
  if (v.consultationState === 'FINALIZED') return;
  v.consultationState = 'FINALIZED';
  v.consultationFinalizedAt = nowIso();
  audit(v, 'VISIT', v.visitId, 'CONSULTATION_FINALIZED');
}

export function reopenConsultation(v: Visit): void {
  if (v.consultationState !== 'FINALIZED') return;
  v.consultationState = 'OPEN';
  audit(v, 'VISIT', v.visitId, 'CONSULTATION_REOPENED', 'CLINICIAN', `previously finalized ${v.consultationFinalizedAt ?? ''}`.trim());
}

const DUP_WINDOW_SEC = 6;

/**
 * Appends one recognised utterance to the active (or given) recording segment. Guards against the two duplicate
 * paths of a streaming recognizer: the same final delivered twice, and a kept partial followed by its final
 * (the final replaces the kept partial instead of being appended). Returns null when nothing was appended.
 */
export function appendUtterance(
  v: Visit,
  u: { text: string; confidence: number; role: SpeakerRole; start: number; end: number; sourceProvider: string; origin?: TranscriptSegment['origin']; language?: string; recordingSegmentId?: string },
): TranscriptSegment | null {
  const text = u.text.trim();
  if (!text) return null;
  const rs = u.recordingSegmentId ? v.recordingSegments.find((s) => s.recordingSegmentId === u.recordingSegmentId) : activeRecordingSegment(v) ?? lastRecordingSegment(v);
  const prev = [...v.segments].reverse().find((s) => !s.excluded && s.recordingSegmentId === rs?.recordingSegmentId);
  const norm = normalizeText(text);
  if (prev && u.start - prev.endTime <= DUP_WINDOW_SEC) {
    const pn = normalizeText(prev.text);
    if (pn === norm) return null; // same words delivered twice
    if (prev.origin === 'PARTIAL_COMMIT' && !prev.editedByClinician && norm.startsWith(pn) && u.origin !== 'PARTIAL_COMMIT') {
      prev.text = text; // the recognizer's final for the speech we had kept as a partial
      prev.origin = 'LIVE';
      prev.endTime = Math.max(prev.endTime, u.end);
      prev.confidence = u.confidence <= 0 ? 'LOW' : u.confidence < 0.6 ? 'MEDIUM' : 'HIGH';
      prev.rawConfidence = u.confidence > 0 ? u.confidence : undefined;
      return prev;
    }
  }
  const s: TranscriptSegment = {
    segmentId: newId(),
    displayCode: nextDisplayCode(v),
    speakerId: u.role === 'DOCTOR' ? 'Live-D' : u.role === 'PATIENT' ? 'Live-P' : u.role === 'OTHER' ? 'Live-O' : 'Live-?',
    speakerRole: u.role,
    speakerRoleConfirmed: false,
    text,
    startTime: u.start,
    endTime: u.end,
    confidence: u.confidence <= 0 ? 'LOW' : u.confidence < 0.6 ? 'MEDIUM' : 'HIGH',
    rawConfidence: u.confidence > 0 ? u.confidence : undefined,
    isFinal: true,
    editedByClinician: false,
    sourceProvider: u.sourceProvider,
    recordingSegmentId: rs?.recordingSegmentId,
    language: u.language ?? rs?.language,
    addedAt: nowIso(),
    origin: u.origin ?? 'LIVE',
  };
  v.segments.push(s);
  v.transcriptVersion += 1;
  return s;
}

/** Display codes are never reused, so references stay stable after splits and replacements. */
export function nextDisplayCode(v: Visit): string {
  const max = v.segments.reduce((m, s) => Math.max(m, Number(s.displayCode.replace(/\D/g, '')) || 0), 0);
  return `T-${pad(max + 1, 4)}`;
}

/**
 * Canonical visit transcript: every non-excluded utterance, ordered by recording segment, then clock time,
 * then insertion order. Deterministic, and never contains the same utterance twice.
 */
export function canonicalTranscript(v: Visit): TranscriptSegment[] {
  const segIndex = new Map(v.recordingSegments.map((s) => [s.recordingSegmentId, s.index]));
  const seen = new Set<string>();
  return v.segments
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => !s.excluded && !seen.has(s.segmentId) && seen.add(s.segmentId))
    .sort((a, b) => (segIndex.get(a.s.recordingSegmentId ?? '') ?? 0) - (segIndex.get(b.s.recordingSegmentId ?? '') ?? 0) || a.s.startTime - b.s.startTime || a.i - b.i)
    .map(({ s }) => s);
}

/** Marks (never deletes) later utterances that repeat an earlier one by the same speaker. Returns the count. */
export function markRepetitions(v: Visit): number {
  const firstBy = new Map<string, string>();
  let n = 0;
  for (const s of canonicalTranscript(v)) {
    const k = `${s.speakerRole}|${normalizeText(s.text)}`;
    const first = firstBy.get(k);
    if (first && normalizeText(s.text).split(' ').length >= 3) {
      s.possibleRepeatOf = first;
      n++;
    } else {
      s.possibleRepeatOf = undefined;
      if (!first) firstBy.set(k, s.segmentId);
    }
  }
  return n;
}

/** Replaces the utterances of one recording segment (e.g. the cloud final pass) in place; others untouched. */
export function replaceRecordingSegmentUtterances(v: Visit, recordingSegmentId: string, next: Omit<TranscriptSegment, 'displayCode'>[]): void {
  const firstIdx = v.segments.findIndex((s) => s.recordingSegmentId === recordingSegmentId);
  const removed = v.segments.filter((s) => s.recordingSegmentId === recordingSegmentId);
  // utterances already cited by a current fact are kept (they are evidence); only uncited live text is replaced
  const cited = new Set(v.facts.filter(isCurrent).flatMap((f) => f.sourceSegmentIds));
  if (removed.some((s) => cited.has(s.segmentId))) throw new Error('Facts already cite this segment; the live transcript is kept.');
  v.segments = v.segments.filter((s) => s.recordingSegmentId !== recordingSegmentId);
  const withCodes: TranscriptSegment[] = [];
  for (const s of next) {
    const code = nextDisplayCode({ ...v, segments: [...v.segments, ...withCodes] } as Visit);
    withCodes.push({ ...s, displayCode: code });
  }
  v.segments.splice(firstIdx < 0 ? v.segments.length : firstIdx, 0, ...withCodes);
  bumpTranscript(v, { segmentId: recordingSegmentId, action: 'FINAL_REPLACED_LIVE', previousText: removed.map((s) => s.text).join(' ') });
}

// ------------------------------------------------------------------ recording state machine (UI)

export type ConsultationPhase =
  | 'IDLE'
  | 'REQUESTING_PERMISSION'
  | 'RECORDING'
  | 'PAUSED'
  | 'PROCESSING_SEGMENT'
  | 'SEGMENT_COMPLETE'
  | 'CONSULTATION_OPEN'
  | 'FINALIZING'
  | 'FINALIZED'
  | 'ERROR'
  | 'RECOVERABLE';

export type ConsultationAction = 'START' | 'PAUSE' | 'RESUME' | 'FINISH_SEGMENT' | 'CONTINUE' | 'FINALIZE' | 'ADD_MORE' | 'REVIEW_NEW' | 'RECONCILE' | 'REVIEW_TRANSCRIPT';

export interface PhaseFlags {
  /** this screen is driving the microphone/demo script right now */
  live: boolean;
  requesting?: boolean;
  processing?: boolean;
  finalizing?: boolean;
  error?: boolean;
  /** a segment was finished on this screen in this session */
  justCompleted?: boolean;
}

export function consultationPhase(v: Visit, f: PhaseFlags): ConsultationPhase {
  if (f.finalizing) return 'FINALIZING';
  if (f.processing) return 'PROCESSING_SEGMENT';
  if (f.requesting) return 'REQUESTING_PERMISSION';
  const active = activeRecordingSegment(v);
  if (active && !f.live) return f.error ? 'ERROR' : 'RECOVERABLE';
  if (f.error) return 'ERROR';
  if (active?.status === 'RECORDING') return 'RECORDING';
  if (active?.status === 'PAUSED') return 'PAUSED';
  if (v.consultationState === 'FINALIZED') return 'FINALIZED';
  if (!v.recordingSegments.length) return 'IDLE';
  return f.justCompleted ? 'SEGMENT_COMPLETE' : 'CONSULTATION_OPEN';
}

/** Which actions each phase offers. FINISH_SEGMENT and FINALIZE are never offered together with recording. */
export const PHASE_ACTIONS: Record<ConsultationPhase, ConsultationAction[]> = {
  IDLE: ['START'],
  REQUESTING_PERMISSION: [],
  RECORDING: ['PAUSE', 'FINISH_SEGMENT'],
  PAUSED: ['RESUME', 'FINISH_SEGMENT'],
  PROCESSING_SEGMENT: [],
  SEGMENT_COMPLETE: ['REVIEW_NEW', 'RECONCILE', 'CONTINUE', 'FINALIZE'],
  CONSULTATION_OPEN: ['CONTINUE', 'FINALIZE', 'REVIEW_TRANSCRIPT'],
  FINALIZING: [],
  FINALIZED: ['ADD_MORE', 'REVIEW_TRANSCRIPT'],
  ERROR: ['RESUME', 'FINISH_SEGMENT'],
  RECOVERABLE: ['RESUME', 'FINISH_SEGMENT'],
};

export const PHASE_LABEL: Record<ConsultationPhase, string> = {
  IDLE: 'READY TO RECORD',
  REQUESTING_PERMISSION: 'REQUESTING MICROPHONE',
  RECORDING: 'RECORDING',
  PAUSED: 'PAUSED',
  PROCESSING_SEGMENT: 'SAVING SEGMENT',
  SEGMENT_COMPLETE: 'SEGMENT SAVED',
  CONSULTATION_OPEN: 'CONSULTATION OPEN',
  FINALIZING: 'FINALIZING',
  FINALIZED: 'CONSULTATION FINALIZED',
  ERROR: 'MICROPHONE ERROR',
  RECOVERABLE: 'RECORDING INTERRUPTED',
};

// ------------------------------------------------------------------ migration (schema v1 → v2)

/**
 * v1 visits had one implicit recording. They get SEG-0001 covering every existing utterance; nothing else
 * changes. Applied on read; the next save persists schemaVersion 2.
 */
export function migrateVisit(v: Visit): Visit {
  if (v.schemaVersion >= 2 && v.recordingSegments.length) return v;
  if (!v.recordingSegments.length && (v.segments.length || v.recordingState !== 'NOT_STARTED') && v.mode === 'AMBIENT') {
    const open = v.recordingState === 'RECORDING' || v.recordingState === 'PAUSED';
    const seg: RecordingSegment = {
      recordingSegmentId: newId(),
      displayCode: 'SEG-0001',
      index: 1,
      startedAt: v.startedAt,
      endedAt: open ? undefined : v.endedAt,
      status: open ? 'PAUSED' : 'COMPLETED',
      transcriptionStatus: open ? 'IN_PROGRESS' : v.segments.length ? 'COMPLETED' : 'EMPTY',
      language: 'en-US',
      provider: v.transcriptSource === 'GEMINI_FINAL' ? 'gemini-transcribe' : 'android-speechrecognizer',
      clockOffsetSec: 0,
      durationSec: v.recordingDurationSec,
      pauses: open ? [{ pausedAt: v.updatedAt }] : [],
      createdAt: v.startedAt,
    };
    v.recordingSegments = [seg];
    for (const s of v.segments) if (!s.recordingSegmentId) s.recordingSegmentId = seg.recordingSegmentId;
    if (open) v.recordingState = 'PAUSED';
  }
  if (v.reconciledTranscriptVersion === undefined && (v.clinicalExtractionState === 'COMPLETED' || v.clinicalExtractionState === 'PARTIAL')) v.reconciledTranscriptVersion = v.transcriptVersion;
  v.schemaVersion = SCHEMA_VERSION;
  return v;
}

/** Languages used in the visit, in first-use order. */
export function visitLanguages(v: Visit): string[] {
  const out: string[] = [];
  for (const s of v.recordingSegments) if (!out.includes(s.language)) out.push(s.language);
  for (const u of v.segments) if (u.language && !out.includes(u.language)) out.push(u.language);
  return out;
}
