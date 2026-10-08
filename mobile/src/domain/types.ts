/**
 * Canonical domain model (docs/DATA_MODEL.md). JSON is the canonical representation (ADR-046).
 * Information state, provenance and review status are independent attributes and never merged (ADR-015).
 */
import { z } from 'zod';

export const SCHEMA_VERSION = 1;

export const InformationState = z.enum(['NOT_DISCUSSED', 'NEGATIVE', 'POSITIVE', 'UNKNOWN']);
export type InformationState = z.infer<typeof InformationState>;

export const Provenance = z.enum([
  'PATIENT_REPORTED',
  'CLINICIAN_STATED',
  'MEASURED',
  'TRANSCRIPTION',
  'AI_EXTRACTED',
  'EXTERNAL_SOURCE',
  'CLINICIAN_CONFIRMED',
  'UNKNOWN',
]);
export type Provenance = z.infer<typeof Provenance>;

export const ReviewStatus = z.enum(['PROVISIONAL', 'CONFIRMED', 'REJECTED', 'UNKNOWN']);
export type ReviewStatus = z.infer<typeof ReviewStatus>;

export const ConfidenceLevel = z.enum(['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN']);
export type ConfidenceLevel = z.infer<typeof ConfidenceLevel>;

export const SpeakerRole = z.enum(['DOCTOR', 'PATIENT', 'OTHER', 'UNKNOWN']);
export type SpeakerRole = z.infer<typeof SpeakerRole>;

export const FactCategory = z.enum([
  'SYMPTOM',
  'HISTORY_MEDICAL',
  'HISTORY_SURGICAL',
  'HISTORY_FAMILY',
  'HISTORY_SOCIAL',
  'MEDICATION',
  'ALLERGY',
  'VITAL_SIGN',
  'EXAMINATION_FINDING',
  'INVESTIGATION',
  'ASSESSMENT',
  'PLAN',
  'FOLLOW_UP',
  'OTHER',
]);
export type FactCategory = z.infer<typeof FactCategory>;

export const DerivationMethod = z.enum([
  'VERBATIM_EXTRACTION',
  'NORMALIZED_EXTRACTION',
  'AI_INFERENCE',
  'MANUAL_ENTRY',
  'CLINICIAN_EDIT',
  'EXTERNAL_LOOKUP',
  'DETERMINISTIC_RULE',
]);
export type DerivationMethod = z.infer<typeof DerivationMethod>;

export const ClarificationReason = z.enum([
  'UNCERTAIN_SPEECH',
  'HEDGED_STATEMENT',
  'AMBIGUOUS_MEDICATION',
  'UNIDENTIFIED_SUBJECT',
  'CONFLICT',
  'CONTEXT_UNCLEAR',
  'SOURCE_CHANGED',
  'OTHER',
]);
export type ClarificationReason = z.infer<typeof ClarificationReason>;

export const StageState = z.enum(['NOT_STARTED', 'IN_PROGRESS', 'PARTIAL', 'COMPLETED', 'FAILED', 'SKIPPED']);
export type StageState = z.infer<typeof StageState>;

export const EvidenceSourceType = z.enum([
  'REGULATORY',
  'LITERATURE',
  'GUIDELINE',
  'PATIENT_EDUCATION',
  'CLINICAL_TRIAL',
  'TERMINOLOGY',
  'CHEMICAL_INFORMATION',
  'PUBLIC_HEALTH',
]);
export type EvidenceSourceType = z.infer<typeof EvidenceSourceType>;

export const TakingStatus = z.enum(['CURRENT', 'PREVIOUS', 'DISCONTINUED', 'UNKNOWN']);
export type TakingStatus = z.infer<typeof TakingStatus>;

export const InvestigationStatus = z.enum([
  'ORDERED',
  'SCHEDULED',
  'COMPLETED',
  'RESULT_AVAILABLE',
  'RESULT_DISCUSSED',
  'PENDING',
  'UNKNOWN',
]);
export type InvestigationStatus = z.infer<typeof InvestigationStatus>;

/** Category-specific structured attributes. Unmentioned attributes stay absent and are never inferred. */
export const FactAttributes = z
  .object({
    // medication (§4.7)
    rawName: z.string().optional(),
    normalizedName: z.string().optional(),
    rxcui: z.string().optional(),
    normalizationCandidates: z.array(z.object({ rxcui: z.string(), name: z.string() })).optional(),
    dose: z.string().optional(),
    route: z.string().optional(),
    frequency: z.string().optional(),
    duration: z.string().optional(),
    takingStatus: TakingStatus.optional(),
    // allergy (§4.8)
    substance: z.string().optional(),
    reaction: z.string().optional(),
    // symptom (§4.6)
    onset: z.string().optional(),
    severity: z.string().optional(),
    location: z.string().optional(),
    character: z.string().optional(),
    triggers: z.string().optional(),
    aggravatingFactors: z.string().optional(),
    relievingFactors: z.string().optional(),
    associatedSymptoms: z.string().optional(),
    progression: z.string().optional(),
    timing: z.string().optional(),
    // vital sign / investigation
    vitalKind: z.enum(['BP', 'PULSE', 'TEMPERATURE', 'SPO2', 'RESP_RATE', 'WEIGHT', 'HEIGHT', 'GLUCOSE']).optional(),
    numericValue: z.number().optional(),
    numericValue2: z.number().optional(),
    unit: z.string().optional(),
    testName: z.string().optional(),
    investigationStatus: InvestigationStatus.optional(),
    result: z.string().optional(),
    // follow-up (§4.12)
    dueDate: z.string().optional(),
    interval: z.string().optional(),
    task: z.string().optional(),
    followUpStatus: z.enum(['PENDING', 'COMPLETED', 'CANCELLED', 'UNKNOWN']).optional(),
  })
  .partial();
export type FactAttributes = z.infer<typeof FactAttributes>;

export const ClinicalFact = z.object({
  factId: z.string(),
  patientId: z.string(),
  visitId: z.string(),
  category: FactCategory,
  conceptKey: z.string(),
  value: z.string(),
  normalizedValue: z.string().optional(),
  informationState: InformationState,
  originProvenance: Provenance,
  rootOriginProvenance: Provenance,
  provenance: Provenance,
  status: ReviewStatus,
  derivationMethod: DerivationMethod,
  sourceSegmentIds: z.array(z.string()),
  sourceSpeakerId: z.string().optional(),
  sourceSpeakerRole: SpeakerRole.optional(),
  sourceStartTime: z.number().optional(),
  confidence: ConfidenceLevel,
  needsClarification: z.boolean(),
  clarificationReason: ClarificationReason.optional(),
  supersedesFactId: z.string().optional(),
  supersededByFactId: z.string().optional(),
  resolvedAwayByConflictId: z.string().optional(),
  conflictIds: z.array(z.string()),
  attributes: FactAttributes,
  /** Which extractor produced the original item (display only; provenance is separate). */
  extractor: z.enum(['DETERMINISTIC', 'AI', 'MANUAL']),
  aiJobVersion: z.string().optional(),
  providerExecutionId: z.string().optional(),
  confirmedAt: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ClinicalFact = z.infer<typeof ClinicalFact>;

export const TranscriptSegment = z.object({
  segmentId: z.string(),
  displayCode: z.string(),
  speakerId: z.string(),
  speakerRole: SpeakerRole,
  speakerRoleConfirmed: z.boolean(),
  text: z.string(),
  startTime: z.number(),
  endTime: z.number(),
  confidence: ConfidenceLevel,
  rawConfidence: z.number().optional(),
  isFinal: z.boolean(),
  editedByClinician: z.boolean(),
  sourceProvider: z.string(),
});
export type TranscriptSegment = z.infer<typeof TranscriptSegment>;

export const FactConflict = z.object({
  conflictId: z.string(),
  patientId: z.string(),
  visitId: z.string(),
  factIds: z.array(z.string()),
  conflictType: z.enum(['SELF_CORRECTION', 'SPEAKER_DISAGREEMENT', 'BLANKET_VS_SPECIFIC', 'VALUE_MISMATCH', 'CROSS_VISIT']),
  detectedBy: z.enum(['DETERMINISTIC_RULE', 'AI_JOB']),
  status: z.enum(['OPEN', 'RESOLVED_BY_CLINICIAN', 'DISMISSED_BY_CLINICIAN']),
  proposedCurrentFactId: z.string().optional(),
  resolvedCurrentFactId: z.string().optional(),
  detectedAt: z.string(),
  resolvedAt: z.string().optional(),
});
export type FactConflict = z.infer<typeof FactConflict>;

export const EvidenceSource = z.object({
  evidenceId: z.string(),
  queryId: z.string(),
  provider: z.string(),
  sourceType: EvidenceSourceType,
  tier: z.number().int().min(1).max(6),
  title: z.string(),
  identifier: z.string(),
  identifierType: z.enum(['PMID', 'PMCID', 'DOI', 'NCT', 'SETID', 'RXCUI', 'APPLICATION_NO', 'NDC', 'CID', 'URL']),
  alternateIdentifiers: z.array(z.string()),
  url: z.string(),
  authors: z.string().optional(),
  journal: z.string().optional(),
  publishedAt: z.string().optional(),
  retrievedAt: z.string(),
  relevance: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  excerpt: z.string().optional(),
  extra: z.record(z.string(), z.string()).optional(),
  jurisdictionLabel: z.string().optional(),
  retrievedFor: z.string(),
  responseValidated: z.literal(true),
  factsChangedSinceRetrieval: z.boolean(),
  citable: z.boolean(),
  sourceFactIds: z.array(z.string()),
});
export type EvidenceSource = z.infer<typeof EvidenceSource>;

export const EvidenceQuery = z.object({
  queryId: z.string(),
  origin: z.enum(['AUTOMATIC', 'CLINICIAN_MANUAL']),
  sourceFactIds: z.array(z.string()),
  sourceFactVersionIds: z.array(z.string()),
  concepts: z.array(z.object({ term: z.string(), informationState: InformationState })),
  route: z.string(),
  provider: z.string(),
  createdAt: z.string(),
  state: z.enum(['PENDING', 'COMPLETED', 'FAILED', 'NO_RESULTS']),
  errorKind: z.string().optional(),
});
export type EvidenceQuery = z.infer<typeof EvidenceQuery>;

export const ClinicalCandidate = z.object({
  candidateId: z.string(),
  generationRunId: z.string(),
  topic: z.string(),
  reason: z.string(),
  supportingFactIds: z.array(z.string()),
  contradictingFactIds: z.array(z.string()),
  conflictFactIds: z.array(z.string()),
  missingInformation: z.array(z.string()),
  evidenceIds: z.array(z.string()),
  sourceFactVersionIds: z.array(z.string()),
  evidenceStateAtGeneration: z.enum(['COMPLETED', 'PARTIAL']),
  outdated: z.boolean(),
  supersededByRunId: z.string().optional(),
  status: z.enum(['PROVISIONAL', 'DISMISSED', 'CONFIRMED_BY_CLINICIAN']),
  clinicianDecisionAt: z.string().optional(),
  aiJobVersion: z.string(),
});
export type ClinicalCandidate = z.infer<typeof ClinicalCandidate>;

export const NoteType = z.enum(['SOAP', 'GENERAL', 'PROGRESS']);
export type NoteType = z.infer<typeof NoteType>;

export const NoteVersion = z.object({
  versionId: z.string(),
  versionNumber: z.number().int(),
  noteType: NoteType,
  content: z.string(),
  source: z.enum(['SYSTEM_DRAFT', 'AI_DRAFT', 'MANUAL_DRAFT', 'CLINICIAN_EDIT', 'CLINICIAN_FINALIZED']),
  createdAt: z.string(),
  aiJobVersion: z.string().optional(),
});
export type NoteVersion = z.infer<typeof NoteVersion>;

export const AuditEvent = z.object({
  eventId: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  action: z.string(),
  actor: z.enum(['CLINICIAN', 'SYSTEM', 'AI']),
  createdAt: z.string(),
  detail: z.string().optional(),
});
export type AuditEvent = z.infer<typeof AuditEvent>;

export const DiscardedItem = z.object({
  itemId: z.string(),
  category: FactCategory,
  segmentIds: z.array(z.string()),
  reasonCode: z.string(),
  createdAt: z.string(),
});
export type DiscardedItem = z.infer<typeof DiscardedItem>;

export const ProviderExecution = z.object({
  executionId: z.string(),
  job: z.string(),
  provider: z.string(),
  model: z.string().optional(),
  outcome: z.enum(['SUCCESS', 'VALIDATION_FAILED', 'PROVIDER_ERROR', 'QUOTA_EXHAUSTED', 'UNAVAILABLE', 'FEATURE_DISABLED']),
  startedAt: z.string(),
  durationMs: z.number(),
});
export type ProviderExecution = z.infer<typeof ProviderExecution>;

export const Visit = z.object({
  schemaVersion: z.number(),
  visitId: z.string(),
  visitCode: z.string(),
  patientId: z.string(),
  startedAt: z.string(),
  endedAt: z.string().optional(),
  mode: z.enum(['AMBIENT', 'MANUAL']),
  isDemo: z.boolean(),
  consent: z
    .object({
      state: z.enum(['CONFIRMED', 'DECLINED', 'WITHDRAWN']),
      method: z.enum(['VERBAL_ATTESTED_BY_CLINICIAN', 'WRITTEN_ATTESTED_BY_CLINICIAN']),
      attestedByClinician: z.boolean(),
      recordedAt: z.string(),
    })
    .optional(),
  recordingState: z.enum(['NOT_STARTED', 'RECORDING', 'PAUSED', 'STOPPED', 'FAILED']),
  recordingDurationSec: z.number(),
  transcriptState: StageState,
  transcriptSource: z.enum(['NONE', 'LIVE_DEVICE', 'GEMINI_FINAL', 'MANUAL']),
  speakerMappingState: StageState,
  speakerAssignmentUncertain: z.boolean(),
  clinicalExtractionState: StageState,
  evidenceState: StageState,
  candidateState: StageState,
  candidateSkipReason: z.string().optional(),
  noteState: z.enum(['NONE', 'DRAFT', 'EDITED', 'FINALIZED']),
  segments: z.array(TranscriptSegment),
  facts: z.array(ClinicalFact),
  conflicts: z.array(FactConflict),
  discarded: z.array(DiscardedItem),
  evidenceQueries: z.array(EvidenceQuery),
  evidence: z.array(EvidenceSource),
  candidates: z.array(ClinicalCandidate),
  noteVersions: z.array(NoteVersion),
  finalizedAt: z.string().optional(),
  unreviewedFactCountAtFinalize: z.number().optional(),
  executions: z.array(ProviderExecution),
  audit: z.array(AuditEvent),
  pendingAudioUris: z.array(z.string()),
  updatedAt: z.string(),
});
export type Visit = z.infer<typeof Visit>;

export const ProblemListEntry = z.object({
  problemId: z.string(),
  label: z.string(),
  problemStatus: z.enum(['ACTIVE', 'RESOLVED', 'INACTIVE']),
  originRecordType: z.enum(['ASSESSMENT', 'CLINICAL_FACT', 'MANUAL']),
  originRecordId: z.string().optional(),
  provenance: z.literal('CLINICIAN_CONFIRMED'),
  createdAt: z.string(),
});
export type ProblemListEntry = z.infer<typeof ProblemListEntry>;

export const Patient = z.object({
  schemaVersion: z.number(),
  patientId: z.string(),
  patientReference: z.string().regex(/^P-\d{6}$/),
  name: z.string().optional(),
  dateOfBirth: z.string().optional(),
  age: z.number().int().min(0).max(130).optional(),
  sex: z.enum(['FEMALE', 'MALE', 'OTHER', 'UNKNOWN']).optional(),
  isDemo: z.boolean(),
  problems: z.array(ProblemListEntry),
  visitIds: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Patient = z.infer<typeof Patient>;

export const PatientIndexEntry = z.object({
  patientId: z.string(),
  patientReference: z.string(),
  name: z.string().optional(),
  age: z.number().optional(),
  sex: z.string().optional(),
  isDemo: z.boolean(),
  visitCount: z.number(),
  lastVisitAt: z.string().optional(),
  updatedAt: z.string(),
});
export type PatientIndexEntry = z.infer<typeof PatientIndexEntry>;

export const AppSettings = z.object({
  schemaVersion: z.number(),
  onboardingAcknowledgedAt: z.string().optional(),
  onboardingVersion: z.number().optional(),
  cloudProcessingEnabled: z.boolean(),
  defaultNoteType: NoteType,
  language: z.string(),
  theme: z.enum(['SYSTEM', 'LIGHT', 'DARK']),
  /** R2 development flag (ADR-025). Only selectable in development builds; release builds force OFF. */
  devPossibilitiesEnabled: z.boolean(),
  nextPatientNumber: z.number().int(),
  nextVisitNumber: z.number().int(),
});
export type AppSettings = z.infer<typeof AppSettings>;
