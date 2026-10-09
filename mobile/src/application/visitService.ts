/**
 * Visit pipeline orchestration (ARCHITECTURE §6, DATA_MODEL §5.2). Stages run in canonical order and every stage
 * persists its result before the next one starts, so a provider failure never loses the transcript, facts,
 * patient record or draft note (CLAUDE.md §11). AI usage per visit: at most one transcription call, one combined
 * extraction call and (R2, flag ON) one possibilities call.
 */
import { candidatePrecondition, refreshCandidateStaleness, validateCandidates } from '../domain/candidates';
import { detectConflicts, reconcileProfile } from '../domain/conflicts';
import {
  activeRecordingSegment,
  appendUtterance,
  beginRecordingSegment,
  canonicalTranscript,
  completeRecordingSegment,
  finalizeConsultation,
  markRepetitions,
  pauseRecordingSegment,
  replaceRecordingSegmentUtterances,
  resumeRecordingSegment,
} from '../domain/consultation';
import { languageEntry } from '../domain/languages';
import { refreshEvidenceStaleness } from '../domain/evidence';
import { extractDeterministic } from '../domain/extraction/deterministic';
import { AiExtractionOutput } from '../domain/extraction/item';
import { mergeFacts, validateAndPromote } from '../domain/extraction/validate';
import { audit, isEligible } from '../domain/facts';
import { addNoteVersion, provenanceLabel, renderNote } from '../domain/note';
import type { AppSettings, NoteType, Patient, ProviderExecution, SpeakerRole, TranscriptSegment, Visit } from '../domain/types';
import { newId, nowIso, pad } from '../domain/util';
import type { ClinicalStore } from '../infrastructure/storage/clinicalStore';
import { BackendError, type Backend, USER_MESSAGES } from '../providers/backend';
import type { EvidenceService } from './evidenceService';

export const JOB_EXTRACTION = 'clinical_fact_extraction';
export const JOB_EXTRACTION_VERSION = 'clinical_fact_extraction@1';
export const JOB_CANDIDATES = 'clinical_candidate_generation';
export const JOB_CANDIDATES_VERSION = 'clinical_candidate_generation@1';

/** Free-tier Gemini terms: submitted content may be used to improve the provider's products (pricing page, 2026-10-09). */
export const FREE_TIER_CONTENT_USED_FOR_TRAINING = true as const;
export const SYNTHETIC_ONLY_MESSAGE =
  "Cloud AI is used for synthetic demo patients only: the free AI tier may use submitted content to improve the provider's products, so real patient transcripts are never sent to it.";

export interface StageOutcome {
  ok: boolean;
  message?: string;
}

export class VisitService {
  constructor(
    private readonly store: ClinicalStore,
    private readonly backend: Backend,
    private readonly evidence: EvidenceService,
  ) {}

  private recordExecution(v: Visit, job: string, outcome: ProviderExecution['outcome'], started: number, provider = 'backend', model?: string) {
    v.executions.push({ executionId: newId(), job, provider, model, outcome, startedAt: new Date(started).toISOString(), durationMs: Date.now() - started });
  }

  /**
   * Backend AI (Gemini free tier) receives transcript text/audio. The free tier's terms allow submitted content to
   * be used to improve the provider's products (verified 2026-10-09), so it is used for synthetic demo visits only
   * (ADR-047, PRIVACY §6–7, ADR-006). Real-patient visits use on-device speech and rule-based extraction.
   */
  private cloudAllowed(settings: AppSettings, v: Visit) {
    return settings.cloudProcessingEnabled && this.backend.configured() && (v.isDemo || !FREE_TIER_CONTENT_USED_FOR_TRAINING);
  }

  private cloudReason(settings: AppSettings, v: Visit): string {
    if (!this.backend.configured()) return USER_MESSAGES.NOT_CONFIGURED;
    if (!settings.cloudProcessingEnabled) return 'Cloud processing is off.';
    return SYNTHETIC_ONLY_MESSAGE;
  }

  // ------------------------------------------------------------- consent and recording
  recordConsent(v: Visit, method: 'VERBAL_ATTESTED_BY_CLINICIAN' | 'WRITTEN_ATTESTED_BY_CLINICIAN') {
    v.consent = { state: 'CONFIRMED', method, attestedByClinician: true, recordedAt: nowIso() };
    audit(v, 'CONSENT', v.visitId, 'CONSENT_RECORDED');
  }

  /** Appends a recognised utterance to the active recording segment (duplicate-safe, ADR-050). */
  addLiveSegment(
    v: Visit,
    text: string,
    confidence: number,
    role: SpeakerRole,
    start: number,
    end: number,
    sourceProvider = 'android-speechrecognizer',
    opts: { origin?: TranscriptSegment['origin']; language?: string; recordingSegmentId?: string } = {},
  ): TranscriptSegment | null {
    return appendUtterance(v, { text, confidence, role, start, end, sourceProvider, origin: opts.origin ?? (sourceProvider === 'demo-script' ? 'DEMO' : undefined), language: opts.language, recordingSegmentId: opts.recordingSegmentId });
  }

  /** Starts (or returns the already active) recording segment. Never resets the visit start time. */
  startRecording(v: Visit, opts: { language?: string; provider?: string } = {}) {
    if (v.consent?.state !== 'CONFIRMED') throw new Error('Consent must be confirmed before recording.');
    const seg = beginRecordingSegment(v, { language: opts.language ?? 'en-US', provider: opts.provider ?? 'android-speechrecognizer' });
    audit(v, 'VISIT', v.visitId, 'RECORDING_STARTED', 'CLINICIAN', seg.displayCode);
    return seg;
  }

  pauseRecording(v: Visit, visitClockSec: number) {
    const s = activeRecordingSegment(v);
    if (s) pauseRecordingSegment(v, visitClockSec - s.clockOffsetSec);
  }

  resumeRecording(v: Visit) {
    resumeRecordingSegment(v);
  }

  /**
   * Finishes the current recording segment (not the consultation). Keeps every captured utterance; the live
   * transcript is the transcript until a validated final one exists. `visitClockSec` is the visit recording clock.
   */
  stopRecording(v: Visit, visitClockSec: number) {
    const s = activeRecordingSegment(v);
    const done = completeRecordingSegment(v, s ? visitClockSec - s.clockOffsetSec : undefined);
    if (done) audit(v, 'VISIT', v.visitId, 'RECORDING_STOPPED', 'CLINICIAN', done.displayCode);
    return done;
  }

  /** Explicit clinician action; confirms nothing. */
  finalizeConsultation(v: Visit) {
    finalizeConsultation(v);
  }

  /** Withdrawn consent: recording stops; nothing captured after this point. Existing text stays for the clinician to delete. */
  withdrawConsent(v: Visit) {
    if (v.consent) v.consent.state = 'WITHDRAWN';
    completeRecordingSegment(v);
    v.recordingState = 'STOPPED';
    audit(v, 'CONSENT', v.visitId, 'CONSENT_WITHDRAWN');
  }

  /**
   * Level 2 final transcript with diarization (Gemini via backend). Falls back to the live transcript on any
   * failure; the live transcript is never discarded before a validated replacement exists.
   */
  async finalTranscription(v: Visit, settings: AppSettings, mergedAudioUri: string | null, recordingSegmentId?: string): Promise<StageOutcome> {
    const rs = recordingSegmentId ? v.recordingSegments.find((s) => s.recordingSegmentId === recordingSegmentId) : v.recordingSegments[v.recordingSegments.length - 1];
    const live = v.segments.filter((s) => !rs || s.recordingSegmentId === rs.recordingSegmentId);
    const hasAny = v.segments.some((s) => !s.excluded);
    // the cloud final pass is verified for English only; other languages keep the on-device transcript (ADR-052)
    const englishOnly = !rs || languageEntry(rs.language)?.finalTranscriptionSupport === 'AVAILABLE_SYNTHETIC_ONLY';
    if (!mergedAudioUri || !this.cloudAllowed(settings, v) || !englishOnly) {
      v.transcriptState = hasAny ? 'COMPLETED' : 'FAILED';
      if (v.transcriptSource === 'NONE' && hasAny) v.transcriptSource = 'LIVE_DEVICE';
      const message = !this.cloudAllowed(settings, v)
        ? `${this.cloudReason(settings, v)} The on-device live transcript is used.`
        : !englishOnly
          ? 'The cloud final transcript is verified for English only. The on-device transcript in the selected language is kept unchanged.'
          : 'No recorded audio was available; the live transcript is used.';
      return { ok: hasAny, message };
    }
    v.transcriptState = 'IN_PROGRESS';
    const started = Date.now();
    try {
      const r = await this.backend.transcribe(mergedAudioUri);
      const clean = r.segments.filter((s) => typeof s.text === 'string' && s.text.trim());
      if (!clean.length) throw new BackendError('INVALID_RESPONSE', USER_MESSAGES.INVALID_RESPONSE);
      const roles = proposeRoles(live, clean);
      const offset = rs?.clockOffsetSec ?? 0;
      const prefix = rs ? `${rs.displayCode}:` : '';
      const ts = nowIso();
      const next = clean.map((s) => ({
        segmentId: newId(),
        speakerId: `${prefix}${s.speakerLabel || 'spk_?'}`,
        speakerRole: roles.map[s.speakerLabel] ?? 'UNKNOWN',
        speakerRoleConfirmed: false,
        text: s.text.trim(),
        startTime: Math.round((offset + s.start) * 10) / 10,
        endTime: Math.round((offset + s.end) * 10) / 10,
        confidence: 'HIGH' as const,
        isFinal: true,
        editedByClinician: false,
        sourceProvider: 'gemini-transcribe',
        recordingSegmentId: rs?.recordingSegmentId,
        language: rs?.language,
        addedAt: ts,
        origin: 'FINAL' as const,
      }));
      if (rs) replaceRecordingSegmentUtterances(v, rs.recordingSegmentId, next);
      else v.segments = next.map((s, i) => ({ ...s, displayCode: `T-${pad(i + 1, 4)}` }));
      if (v.speakerMappingState === 'COMPLETED') v.speakerMappingState = 'PARTIAL';
      v.speakerAssignmentUncertain = roles.uncertain;
      v.transcriptSource = 'GEMINI_FINAL';
      v.transcriptState = 'COMPLETED';
      if (rs) rs.provider = 'gemini-transcribe';
      this.recordExecution(v, 'transcription', 'SUCCESS', started, r.execution.provider, r.execution.model);
      audit(v, 'TRANSCRIPT', v.visitId, 'UPDATED', 'SYSTEM', `final transcript replaced ${live.length} live utterance(s)${rs ? ` of ${rs.displayCode}` : ''}`);
      return { ok: true };
    } catch (e) {
      const kind = e instanceof BackendError ? e.kind : 'UNAVAILABLE';
      this.recordExecution(v, 'transcription', kind === 'QUOTA_EXHAUSTED' ? 'QUOTA_EXHAUSTED' : kind === 'INVALID_RESPONSE' ? 'VALIDATION_FAILED' : 'UNAVAILABLE', started);
      v.transcriptState = hasAny ? 'PARTIAL' : 'FAILED';
      if (rs) rs.transcriptionStatus = live.length ? 'PARTIAL' : 'FAILED';
      if (v.transcriptSource === 'NONE' && hasAny) v.transcriptSource = 'LIVE_DEVICE';
      const msg = e instanceof BackendError ? USER_MESSAGES[kind as keyof typeof USER_MESSAGES] : e instanceof Error ? e.message : USER_MESSAGES.UNAVAILABLE;
      return { ok: false, message: `${msg ?? USER_MESSAGES.UNAVAILABLE} The on-device live transcript is kept.` };
    }
  }

  /** Clinician confirms the speaker mapping (DATA_MODEL §3.2 rule 5). Required before extraction. */
  confirmRoles(v: Visit, mapping: Record<string, SpeakerRole>) {
    for (const s of v.segments) {
      const r = mapping[s.speakerId];
      if (r) s.speakerRole = r;
      s.speakerRoleConfirmed = true;
    }
    v.speakerMappingState = 'COMPLETED';
    v.speakerAssignmentUncertain = false;
    audit(v, 'VISIT', v.visitId, 'ROLE_MAPPING_CHANGED');
  }

  // ------------------------------------------------------------- extraction
  /**
   * Extraction over the complete canonical transcript (every recording segment, chronological, excluded
   * utterances left out). Also the visit reconciliation: repetition marks, conflicts and patient-profile checks.
   */
  async runExtraction(v: Visit, settings: AppSettings, earlier: Visit[], patient?: Patient): Promise<StageOutcome> {
    if (v.speakerMappingState !== 'COMPLETED') return { ok: false, message: 'Confirm the speaker roles first.' };
    // negation, hedging and grounding rules are English-only: other languages are never auto-extracted (ADR-052)
    const all = canonicalTranscript(v);
    const canonical = all.filter((s) => !s.language || s.language.toLowerCase().startsWith('en'));
    v.clinicalExtractionState = 'IN_PROGRESS';
    // Re-run keeps every clinician-touched fact; only untouched provisional extraction output is replaced.
    const kept = v.facts.filter((f) => f.extractor === 'MANUAL' || f.status !== 'PROVISIONAL' || f.supersededByFactId);
    const removed = new Set(v.facts.filter((f) => !kept.includes(f)).map((f) => f.factId));
    v.conflicts = v.conflicts.filter((c) => !c.factIds.some((id) => removed.has(id)));
    v.facts = kept;
    v.discarded = [];

    const det = validateAndPromote(extractDeterministic(canonical), canonical, { patientId: v.patientId, visitId: v.visitId, extractor: 'DETERMINISTIC' });
    let facts = mergeFacts(v.facts, det.facts);
    const discarded = [...det.discarded];
    let message: string | undefined;
    let aiOk = true;

    if (this.cloudAllowed(settings, v) && canonical.length) {
      const started = Date.now();
      try {
        const input = { segments: canonical.map((s) => ({ id: s.segmentId, role: s.speakerRole, text: s.text })) };
        const r = await this.backend.runJob(JOB_EXTRACTION, JOB_EXTRACTION_VERSION, input);
        const parsed = AiExtractionOutput.safeParse(r.output);
        if (!parsed.success) throw new BackendError('INVALID_RESPONSE', USER_MESSAGES.INVALID_RESPONSE);
        const ai = validateAndPromote(parsed.data.items, canonical, { patientId: v.patientId, visitId: v.visitId, extractor: 'AI', aiJobVersion: JOB_EXTRACTION_VERSION, providerExecutionId: r.execution.executionId });
        facts = mergeFacts(facts, ai.facts);
        discarded.push(...ai.discarded);
        this.recordExecution(v, JOB_EXTRACTION, 'SUCCESS', started, r.execution.provider, r.execution.model);
      } catch (e) {
        aiOk = false;
        const kind = e instanceof BackendError ? e.kind : 'UNAVAILABLE';
        this.recordExecution(v, JOB_EXTRACTION, kind === 'QUOTA_EXHAUSTED' ? 'QUOTA_EXHAUSTED' : kind === 'INVALID_RESPONSE' ? 'VALIDATION_FAILED' : 'UNAVAILABLE', started);
        message = `${USER_MESSAGES[kind as keyof typeof USER_MESSAGES] ?? USER_MESSAGES.UNAVAILABLE} Rule-based extraction results are shown.`;
      }
    } else if (!this.backend.configured()) {
      message = 'Rule-based extraction only (cloud AI not configured).';
    } else if (!settings.cloudProcessingEnabled) {
      message = 'Rule-based extraction only (cloud processing is off).';
    } else if (!this.cloudAllowed(settings, v)) {
      message = `Rule-based extraction only. ${SYNTHETIC_ONLY_MESSAGE}`;
    }
    v.facts = facts;
    v.discarded = discarded;
    detectConflicts(v, earlier);
    if (patient) reconcileProfile(v, patient);
    const repeats = markRepetitions(v);
    refreshEvidenceStaleness(v);
    refreshCandidateStaleness(v);
    v.clinicalExtractionState = aiOk ? 'COMPLETED' : 'PARTIAL';
    v.reconciledTranscriptVersion = v.transcriptVersion;
    v.lastReconciledAt = nowIso();
    const nonEnglish = all.length - canonical.length;
    if (nonEnglish) message = [message, `${nonEnglish} utterance(s) are not in English. Automatic extraction supports English only; review them in the transcript and add facts manually.`].filter(Boolean).join(' ');
    audit(v, 'VISIT', v.visitId, 'UPDATED', 'SYSTEM', `extraction ${v.clinicalExtractionState} over ${canonical.length} of ${all.length} utterance(s), transcript v${v.transcriptVersion}${repeats ? `, ${repeats} possible repetition(s)` : ''}`);
    return { ok: true, message };
  }

  // ------------------------------------------------------------- evidence and possibilities
  async runEvidence(v: Visit, patient: Patient, settings: AppSettings): Promise<StageOutcome> {
    if (!settings.cloudProcessingEnabled) {
      v.evidenceState = 'SKIPPED';
      return { ok: false, message: 'Cloud processing is off, so nothing is sent for evidence search. Turn it on in Settings to search public sources.' };
    }
    if (v.clinicalExtractionState !== 'COMPLETED' && v.clinicalExtractionState !== 'PARTIAL') return { ok: false, message: 'Extract clinical facts first.' };
    const { failedRoutes } = await this.evidence.runAutomatic(v, patient);
    if (v.evidenceState === 'FAILED') return { ok: false, message: 'Evidence sources are unavailable (offline or busy). Cached and saved data remain available; retry later.' };
    return { ok: true, message: failedRoutes.length ? `Some sources did not respond (${failedRoutes.length}). Results are partial.` : undefined };
  }

  async runCandidates(v: Visit, settings: AppSettings, devBuild: boolean): Promise<StageOutcome> {
    const flagOn = devBuild && settings.devPossibilitiesEnabled;
    const pre = candidatePrecondition(v, flagOn);
    if (!pre.ok) {
      v.candidateState = 'SKIPPED';
      v.candidateSkipReason = pre.reason;
      return { ok: false, message: pre.reason };
    }
    if (!this.cloudAllowed(settings, v)) {
      v.candidateState = 'SKIPPED';
      v.candidateSkipReason = 'Possibilities not generated: cloud AI unavailable.';
      return { ok: false, message: v.candidateSkipReason };
    }
    v.candidateState = 'IN_PROGRESS';
    const started = Date.now();
    try {
      const facts = v.facts.filter((f) => isEligible(f) && f.category !== 'DEMOGRAPHIC').map((f) => ({ id: f.factId, category: f.category, value: f.value, informationState: f.informationState, source: provenanceLabel(f), reviewStatus: f.status }));
      const evidence = v.evidence.filter((e) => e.citable).map((e) => ({ id: e.evidenceId, title: e.title, sourceType: e.sourceType, excerpt: e.excerpt ?? '' }));
      const r = await this.backend.runJob(JOB_CANDIDATES, JOB_CANDIDATES_VERSION, { facts, evidence });
      const runId = newId();
      const { candidates, rejected } = validateCandidates(r.output, v, runId, JOB_CANDIDATES_VERSION);
      for (const c of v.candidates) if (!c.supersededByRunId) c.supersededByRunId = runId;
      v.candidates.push(...candidates);
      v.candidateState = 'COMPLETED';
      v.candidateSkipReason = undefined;
      this.recordExecution(v, JOB_CANDIDATES, 'SUCCESS', started, r.execution.provider, r.execution.model);
      return { ok: true, message: rejected ? `${rejected} generated item(s) failed validation and were not shown.` : undefined };
    } catch (e) {
      const kind = e instanceof BackendError ? e.kind : 'UNAVAILABLE';
      this.recordExecution(v, JOB_CANDIDATES, kind === 'FEATURE_DISABLED' ? 'FEATURE_DISABLED' : kind === 'QUOTA_EXHAUSTED' ? 'QUOTA_EXHAUSTED' : 'UNAVAILABLE', started);
      v.candidateState = 'FAILED';
      return { ok: false, message: USER_MESSAGES[kind as keyof typeof USER_MESSAGES] ?? USER_MESSAGES.UNAVAILABLE };
    }
  }

  // ------------------------------------------------------------- notes
  draftNote(v: Visit, patient: Patient, allVisits: Visit[], type: NoteType) {
    const content = renderNote(type, { patient, visit: v, allVisits });
    return addNoteVersion(v, type, content, 'SYSTEM_DRAFT');
  }

  async save(v: Visit) {
    await this.store.saveVisit(v);
  }
}

/** Proposes roles for diarized speaker labels from the clinician's live role tags. Never final: clinician confirms. */
export function proposeRoles(live: TranscriptSegment[], finalSegs: { speakerLabel: string; text: string }[]): { map: Record<string, SpeakerRole>; uncertain: boolean } {
  const labels = Array.from(new Set(finalSegs.map((s) => s.speakerLabel)));
  const words = (t: string) => new Set(t.toLowerCase().split(/\W+/).filter((w) => w.length > 3));
  const doctorWords = words(live.filter((s) => s.speakerRole === 'DOCTOR').map((s) => s.text).join(' '));
  const patientWords = words(live.filter((s) => s.speakerRole === 'PATIENT').map((s) => s.text).join(' '));
  const map: Record<string, SpeakerRole> = {};
  const score: Record<string, number> = {};
  for (const l of labels) {
    const w = words(finalSegs.filter((s) => s.speakerLabel === l).map((s) => s.text).join(' '));
    let d = 0;
    let p = 0;
    for (const x of w) {
      if (doctorWords.has(x)) d++;
      if (patientWords.has(x)) p++;
    }
    score[l] = d - p;
  }
  if (!doctorWords.size && !patientWords.size) {
    for (const l of labels) map[l] = 'UNKNOWN';
    return { map, uncertain: true };
  }
  const sorted = [...labels].sort((a, b) => score[b] - score[a]);
  sorted.forEach((l, i) => (map[l] = i === 0 ? 'DOCTOR' : i === 1 ? 'PATIENT' : 'OTHER'));
  const uncertain = labels.length < 2 || (labels.length >= 2 && Math.abs(score[sorted[0]] - score[sorted[1]]) < 2);
  return { map, uncertain };
}
