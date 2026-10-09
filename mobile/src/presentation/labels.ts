/** Canonical UI labels (UI-UX.md §2 — the only source for provenance and status labels). */
import type { ClinicalFact, InformationState, Provenance, ReviewStatus, Visit } from '../domain/types';

export const PROVENANCE_LABEL: Record<Provenance, string> = {
  PATIENT_REPORTED: 'Patient-reported',
  CLINICIAN_STATED: 'Clinician-stated',
  MEASURED: 'Measured',
  TRANSCRIPTION: 'Transcript',
  AI_EXTRACTED: 'AI inference — verify',
  EXTERNAL_SOURCE: 'Source',
  CLINICIAN_CONFIRMED: 'Confirmed by clinician',
  UNKNOWN: 'Unknown source',
};

export function provenanceText(f: ClinicalFact): string {
  if (f.provenance === 'CLINICIAN_CONFIRMED') {
    if (f.derivationMethod === 'MANUAL_ENTRY') return 'Entered by clinician';
    const origin = PROVENANCE_LABEL[f.rootOriginProvenance].toLowerCase();
    return f.derivationMethod === 'CLINICIAN_EDIT' ? `Edited by clinician · originally ${origin}` : `Confirmed by clinician · originally ${origin}`;
  }
  return PROVENANCE_LABEL[f.provenance];
}

export const STATE_LABEL: Record<InformationState, string> = {
  POSITIVE: 'present',
  NEGATIVE: 'denied / absent',
  UNKNOWN: 'unclear',
  NOT_DISCUSSED: 'not discussed',
};

export const STATUS_LABEL: Record<ReviewStatus, string> = {
  PROVISIONAL: 'Provisional',
  CONFIRMED: 'Confirmed',
  REJECTED: 'Rejected',
  UNKNOWN: 'Unknown',
};

export const CLARIFICATION_LABEL: Record<string, string> = {
  UNCERTAIN_SPEECH: 'Needs clarification — unclear audio',
  HEDGED_STATEMENT: 'Needs clarification — uncertain wording',
  AMBIGUOUS_MEDICATION: 'Needs clarification — several medication matches',
  UNIDENTIFIED_SUBJECT: 'Needs clarification — which medication?',
  CONFLICT: 'Conflict — review',
  CONTEXT_UNCLEAR: 'Needs clarification — context (conditional or about another person)',
  SOURCE_CHANGED: 'Needs clarification — source changed',
  OTHER: 'Needs clarification',
};

export const SOURCE_TYPE_LABEL: Record<string, string> = {
  REGULATORY: 'Regulatory',
  GUIDELINE: 'Guideline',
  LITERATURE: 'Literature',
  CLINICAL_TRIAL: 'Clinical trial registry',
  PATIENT_EDUCATION: 'Patient information',
  TERMINOLOGY: 'Terminology',
  CHEMICAL_INFORMATION: 'Chemical reference',
  PUBLIC_HEALTH: 'Public health',
};

export const CONSENT_TEXT =
  'ClinNote records this consultation to generate a transcript and assist with documentation and evidence review. Obtain the required patient consent according to applicable law, institutional policy, and clinical workflow.';

export const DEMO_BANNER = 'DEMO DATA — NOT A REAL PATIENT';
export const NOT_A_DOCTOR = 'ClinNote organizes documentation and public reference information. It does not diagnose, prescribe or triage.';

export const STAGE_LABEL: Record<string, string> = {
  NOT_STARTED: 'not started',
  IN_PROGRESS: 'in progress',
  PARTIAL: 'partial',
  COMPLETED: 'done',
  FAILED: 'failed',
  SKIPPED: 'skipped',
};

export const ROLE_LABEL: Record<string, string> = { DOCTOR: 'DOCTOR', PATIENT: 'PATIENT', OTHER: 'OTHER', UNKNOWN: 'UNKNOWN' };

export const NOTE_STATE_LABEL: Record<string, string> = { NONE: 'no note', DRAFT: 'note draft', EDITED: 'note edited', FINALIZED: 'note finalized' };

export const ONBOARDING_VERSION = 1;

/** One-line pipeline status in words (UI-UX Screen 21). */
export function visitStatusLine(v: Visit): string {
  if (v.recordingState === 'RECORDING' || v.recordingState === 'PAUSED') return 'recording interrupted — resume or finish the segment';
  const parts = [
    v.mode === 'AMBIENT' ? `${v.recordingSegments.length || 1} segment(s) · consultation ${v.consultationState === 'FINALIZED' ? 'finalized' : 'open'}` : 'manual visit',
    ...(v.reconciledTranscriptVersion !== undefined && v.reconciledTranscriptVersion !== v.transcriptVersion ? ['reconcile needed'] : []),
    v.mode === 'AMBIENT' ? `transcript ${STAGE_LABEL[v.transcriptState]}` : null,
    `facts ${STAGE_LABEL[v.clinicalExtractionState]}`,
    `evidence ${STAGE_LABEL[v.evidenceState]}`,
    NOTE_STATE_LABEL[v.noteState],
  ].filter(Boolean);
  return parts.join(' · ');
}
