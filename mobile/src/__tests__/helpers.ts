/** Synthetic test helpers. All data is fictional (ADR-006). */
import { extractDeterministic } from '../domain/extraction/deterministic';
import { validateAndPromote } from '../domain/extraction/validate';
import type { ClinicalFact, SpeakerRole, TranscriptSegment, Visit } from '../domain/types';
import { pad } from '../domain/util';

let n = 0;
export function seg(role: SpeakerRole, text: string, opts: Partial<TranscriptSegment> = {}): TranscriptSegment {
  n += 1;
  return {
    segmentId: `S${n}`,
    displayCode: `T-${pad(n, 4)}`,
    speakerId: role === 'DOCTOR' ? 'A' : role === 'PATIENT' ? 'B' : 'C',
    speakerRole: role,
    speakerRoleConfirmed: true,
    text,
    startTime: n * 5,
    endTime: n * 5 + 4,
    confidence: 'HIGH',
    isFinal: true,
    editedByClinician: false,
    sourceProvider: 'test',
    ...opts,
  };
}

export function extract(segments: TranscriptSegment[]): ClinicalFact[] {
  return validateAndPromote(extractDeterministic(segments), segments, { patientId: 'P', visitId: 'V', extractor: 'DETERMINISTIC' }).facts;
}

export function extractFull(segments: TranscriptSegment[]) {
  return validateAndPromote(extractDeterministic(segments), segments, { patientId: 'P', visitId: 'V', extractor: 'DETERMINISTIC' });
}

export function visit(over: Partial<Visit> = {}): Visit {
  return {
    schemaVersion: 1,
    visitId: 'V',
    visitCode: 'V-000001',
    patientId: 'P',
    startedAt: '2026-10-08T09:00:00.000Z',
    mode: 'AMBIENT',
    isDemo: true,
    recordingState: 'STOPPED',
    recordingDurationSec: 0,
    transcriptState: 'COMPLETED',
    transcriptSource: 'LIVE_DEVICE',
    speakerMappingState: 'COMPLETED',
    speakerAssignmentUncertain: false,
    clinicalExtractionState: 'COMPLETED',
    evidenceState: 'NOT_STARTED',
    candidateState: 'NOT_STARTED',
    noteState: 'NONE',
    segments: [],
    facts: [],
    conflicts: [],
    discarded: [],
    evidenceQueries: [],
    evidence: [],
    candidates: [],
    noteVersions: [],
    executions: [],
    audit: [],
    pendingAudioUris: [],
    updatedAt: '2026-10-08T09:00:00.000Z',
    ...over,
  };
}

export const find = (facts: ClinicalFact[], pred: (f: ClinicalFact) => boolean) => facts.find(pred);
