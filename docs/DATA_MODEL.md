# ClinNote AI — Data Model

This document defines the domain model: entities, fields, relationships, enumerations, state machines, provenance, fact derivation, contradictions and validation. Field names are logical. The physical SQLite schema is created in BUILD_PLAN Phase 4 and must match this document.

All entities live in the on-device Local Clinical Store (ADR-005, ADR-013). The backend stores none of them.

**This document is the single authoritative definition of the provenance model (§3.2), the fact derivation lifecycle (§8) and the contradiction model (§9)** (ADR-021, ADR-022). Other documents refer here rather than restating these rules.

Conventions:

- IDs are locally generated UUIDs. The exceptions are `patientReference` (`P-000001`) and segment display codes (`T-0043`).
- Timestamps are ISO-8601 with a timezone offset. Segment times are durations from the start of the visit.
- `value` fields keep the original wording and numbers exactly. Normalized values are stored separately.
- All examples use synthetic data.

---

## 1. Entities

Patient · Visit · TranscriptSegment · ClinicalFact · Symptom · Medication · Allergy · Investigation · Assessment · Plan · FollowUp · Appointment · EvidenceQuery · EvidenceSource · ClinicalCandidate · Note · NoteVersion · ConsentRecord · AuditEvent · ProviderExecution · FactConflict · ProblemListEntry · ProfileUpdateProposal · AppSettings

"Encounter" (product language) means `Visit` (data model).

`Appointment` is defined but **not implemented in V1**. Scheduling is covered by FollowUp due dates; there is no V1 FR or BUILD_PLAN task for appointments (minor finding, Stage A).

## 2. Relationships

```text
Patient 1 ── * Visit
Patient 1 ── * Medication            (across visits; see derived view §10.2)
Patient 1 ── * Allergy
Patient 1 ── * FollowUp
Patient 1 ── * ProblemListEntry      (active problems; clinician-curated, §10.1)
Patient 1 ── * ProfileUpdateProposal (proposals from visits; provisional until decided)
Patient 1 ── timeline (derived view over Visits, Symptoms, Medications, Investigations, Assessments, FollowUps, ProblemListEntries)

Visit 1 ── 0..* ConsentRecord        (latest record governs)
Visit 1 ── * TranscriptSegment       (visit → transcript)
Visit 1 ── * ClinicalFact            (visit → facts)
Visit 1 ── * Symptom / Medication / Allergy / Investigation / Assessment / Plan / FollowUp
Visit 1 ── * FactConflict
Visit 1 ── * EvidenceQuery 1 ── * EvidenceSource   (visit → evidence)
Visit 1 ── * ClinicalCandidate
Visit 1 ── * Note                     (visit → notes)
Note  1 ── * NoteVersion              (notes → versions, append-only)
Visit 1 ── * ProviderExecution

ClinicalFact * ── 1..* TranscriptSegment  (sourceSegmentIds; empty only for MANUAL_ENTRY / EXTERNAL_LOOKUP)
ClinicalFact 0..1 ── 0..1 ClinicalFact    (supersedesFactId: edit/correction chain)
FactConflict * ── 2..* ClinicalFact       (factIds)
EvidenceQuery * ── * ClinicalFact         (sourceFactIds: which facts the query was built from)
ClinicalCandidate * ── * ClinicalFact     (supportingFactIds / contradictingFactIds)
ClinicalCandidate * ── * EvidenceSource   (evidenceIds: subset of the visit's evidence bundle)
Assessment 0..1 ── 0..1 ClinicalCandidate (when confirmed from a candidate)
ProblemListEntry 0..1 ── 0..1 Assessment / ClinicalFact (originating record)
ProfileUpdateProposal * ── * ClinicalFact (sourceFactIds)
AuditEvent * ── 1 any entity             (entityType + entityId)
```

Typed entities (Symptom, Medication, …) are category-specific detail records. Each one has a matching ClinicalFact that carries the shared attributes: information state, provenance, status, source, derivation and clarification. Manual entries also create both records.

Deleting a Patient cascades to every related record and file (`PRIVACY.md` §12).

## 3. Shared Enumerations

Enumerations used by several entities. **Information state (§3.1), provenance (§3.2) and review status (§3.3) are three independent attributes and are never merged into one enum** (ADR-015).

**Layered fact model (summary; the sections below are authoritative).** Other documents may use the plain-language names on the left; they always mean the field on the right. There is no `AI_INFERRED` value: AI inference is derivation AI_INFERENCE with provenance AI_EXTRACTED.

| Layer (plain name) | Field(s) | Values | Set by |
|---|---|---|---|
| Source type | `originProvenance` (immutable), `rootOriginProvenance`, `provenance` (§3.2) | PATIENT_REPORTED · CLINICIAN_STATED · MEASURED · TRANSCRIPTION · AI_EXTRACTED · EXTERNAL_SOURCE · CLINICIAN_CONFIRMED · UNKNOWN | code, from the clinician-confirmed speaker role and the derivation; CLINICIAN_CONFIRMED only by a clinician action |
| How it was derived | `derivationMethod` (§3.9) | VERBATIM_EXTRACTION · NORMALIZED_EXTRACTION · AI_INFERENCE · MANUAL_ENTRY · CLINICIAN_EDIT · EXTERNAL_LOOKUP · DETERMINISTIC_RULE | code / validators |
| Information status | `informationState` (§3.1) | NOT_DISCUSSED · NEGATIVE · POSITIVE · UNKNOWN | extraction, validated by code; never upgraded by AI |
| Confirmation status | `status` (§3.3) | PROVISIONAL · CONFIRMED · REJECTED · UNKNOWN | CONFIRMED and REJECTED only by a clinician action |
| Lifecycle (derived, not stored as an enum) | `supersededByFactId`, `resolvedAwayByConflictId`, `status`, `needsClarification` (§3.3a) | CURRENT · SUPERSEDED (by edit, correction or re-extraction) · RESOLVED_AWAY (conflict resolved in favor of another fact) · REJECTED · SOURCE_CHANGED (current but ineligible) | code; supersession by a later statement only after clinician conflict resolution (§9) |
| Historical | the fact's `visitId` | facts from earlier visits | never modified by a later visit; a later visit adds facts or opens a CROSS_VISIT conflict (§9 rule 7) |
| Traceability | `sourceSegmentIds`, `sourceSpeakerId`, `sourceSpeakerRole`, `sourceStartTime`, `confidence`, `aiJobVersion`, `providerExecutionId`, `confirmedAt`/`confirmedBy` (§4.5) | — | code at creation; never lost on later versions (history is kept) |

Example: "I've had a cough for three weeks" (PATIENT segment) → source type PATIENT_REPORTED, derivation VERBATIM_EXTRACTION, information status POSITIVE, confirmation PROVISIONAL, lifecycle CURRENT.

### 3.1 InformationState — what was said about the finding

| Value | Meaning |
|---|---|
| NOT_DISCUSSED | not raised in the visit |
| NEGATIVE | stated as absent ("no", "denies", "never", "negative for") |
| POSITIVE | stated as present |
| UNKNOWN | raised, but the answer was unclear or uncertain ("not sure", "maybe") |

NOT_DISCUSSED and NEGATIVE are never conflated. UNKNOWN is never upgraded to POSITIVE or NEGATIVE by AI.

### 3.2 Provenance — where the information came from (authoritative model)

Each ClinicalFact has three provenance fields:

| Field | Mutability | Meaning |
|---|---|---|
| `originProvenance` | **immutable** once the fact version is created | how this fact version entered ClinNote |
| `rootOriginProvenance` | **immutable**; copied forward to later versions of the same fact, **reset by a source correction** (ADR-035, ADR-043) | how the information first entered ClinNote since its source was last corrected, before any edit |
| `provenance` | changes only through a clinician action | the current authority of the fact |

Values:

| Value | Definition | Created by |
|---|---|---|
| PATIENT_REPORTED | Spoken in a segment whose speaker role is **PATIENT**, under a clinician-confirmed speaker mapping, and extracted near-verbatim | extraction (derivation VERBATIM_EXTRACTION or NORMALIZED_EXTRACTION) |
| CLINICIAN_STATED | Spoken in a segment whose speaker role is **DOCTOR**, under a clinician-confirmed speaker mapping, and extracted near-verbatim. Always PROVISIONAL until reviewed | extraction |
| MEASURED | A measurement the clinician enters in the app's structured measurement fields (e.g. vitals). **Never assigned by AI.** A spoken value ("BP 142 over 91") is CLINICIAN_STATED, not MEASURED | manual entry only (derivation MANUAL_ENTRY) |
| TRANSCRIPTION | Content from a segment whose speaker role is UNKNOWN or OTHER, or whose speaker mapping is not yet confirmed | extraction |
| AI_EXTRACTED | Content **not stated verbatim in a single segment**, i.e. an AI inference that combines, interprets or summarizes several segments. Labeled "AI INFERENCE — VERIFY" | extraction (derivation AI_INFERENCE) |
| EXTERNAL_SOURCE | From an evidence or terminology provider response (e.g. an RxNorm normalization or a label section) | adapter (derivation EXTERNAL_LOOKUP) |
| CLINICIAN_CONFIRMED | The clinician has **personally asserted** this value in the app: by entering it manually, by editing it, or by confirming a fact that had another provenance | clinician action only |
| UNKNOWN | Cannot be determined. V1 pipelines must never produce it; a validator flags any occurrence | — |

Rules:

1. `originProvenance` and `rootOriginProvenance` are set at creation and never change. The UI always shows the root origin using the canonical labels in `UI-UX.md` §2, e.g. "Confirmed by clinician · originally patient-reported" or "Edited by clinician · originally patient-reported".
2. On clinician **confirmation**, `provenance` becomes CLINICIAN_CONFIRMED and `status` becomes CONFIRMED. `originProvenance` keeps the original source.
3. **Manual entry** by the clinician creates a fact with `originProvenance = provenance = CLINICIAN_CONFIRMED` and `status = CONFIRMED`. Manual measurement fields create MEASURED / MEASURED / CONFIRMED.
4. A clinician **edit of the value** creates a new fact version (`supersedesFactId` points to the old version) with origin and provenance CLINICIAN_CONFIRMED, status CONFIRMED, and the chain's `rootOriginProvenance`. The old version keeps its last status, gains `supersededByFactId`, and an AuditEvent with action SUPERSEDED_BY_EDIT is written. It is never deleted.
5. Speaker role → provenance applies only after the clinician confirms the speaker mapping (`Visit.speakerMappingState = COMPLETED`). Before that, extraction does not run (§5.2). OTHER (companion, interpreter) maps to TRANSCRIPTION. There is no per-fact reattribution: a wrong source is fixed by correcting the segment (rule 8) or by a clinician edit (rule 4).
6. AI may produce only PATIENT_REPORTED, CLINICIAN_STATED, TRANSCRIPTION or AI_EXTRACTED, always with status PROVISIONAL. AI never produces MEASURED, EXTERNAL_SOURCE, CLINICIAN_CONFIRMED or UNKNOWN.
7. A fact whose content is not supported verbatim by a single source segment must be AI_EXTRACTED with derivation AI_INFERENCE, even when every input segment came from one speaker.
8. **Correction after extraction (ADR-035, ADR-038).** When the clinician corrects a segment after facts were extracted from it:
   - **Role-only correction that keeps the category valid:** code recomputes the provenance with the §8.3 mapping for the corrected role and **keeps the original derivation method**. An AI_INFERENCE fact therefore stays AI_EXTRACTED. A new PROVISIONAL version is created with `sourceSpeakerRole` recomputed and `rootOriginProvenance` **reset** to the new origin (ADR-043). The old version gets `supersededByFactId`.
   - **Text correction, or a role change that makes the category invalid** (e.g. an Assessment whose segment is now PATIENT, or a PATIENT segment now DOCTOR, which needs jobs 7–8): the affected PROVISIONAL facts get `needsClarification` SOURCE_CHANGED, which makes them ineligible for automatic input (§3.3a). **Every segment the affected fact cites** is re-extracted through jobs 2–9 and all validators. Re-extracted facts are matched to the flagged facts by category + conceptKey (for UNMAPPED keys: category + identical normalized value, ADR-045): a match supersedes the flagged fact (root origin reset), and an unmatched new fact is added as PROVISIONAL. A flagged fact with no match stays flagged until the clinician confirms, edits or rejects it. Code never edits a value or a negation itself.
   - **CONFIRMED facts** are never changed. They get `needsClarification = true` with reason SOURCE_CHANGED and return to review.
   - An AuditEvent (ROLE_MAPPING_CHANGED or UPDATED) is written in every case.

### 3.3 ReviewStatus

PROVISIONAL · CONFIRMED · REJECTED · UNKNOWN

All AI output starts PROVISIONAL. Manual clinician entries start CONFIRMED. A version replaced by a clinician edit, a re-derivation or a conflict resolution keeps its last status and gains `supersededByFactId` (or `resolvedAwayByConflictId`). An AuditEvent records the supersession. "Superseded" is never a ReviewStatus value.

### 3.3a Current fact and eligibility (ADR-038, ADR-043)

A fact version is **current** when `supersededByFactId` is null, `status` is not REJECTED, and `resolvedAwayByConflictId` is null. Non-current versions stay visible as history.

A fact is **eligible for automatic input** when it is current **and** not flagged `needsClarification` SOURCE_CHANGED or CONTEXT_UNCLEAR (ADR-045). Every automatic input set uses eligible facts only: note drafting (job 15), evidence concepts (job 11, with the extra rules in §4.15), candidate generation (job 12), visit comparison (job 14 and the diff), derived views (§10) and the conflict detector (§9). Facts flagged SOURCE_CHANGED or CONTEXT_UNCLEAR are listed for clinician review and in the note editor's indicator, and they are counted in `unreviewedFactCountAtFinalize`. **Allergy safety exception (S6-01):** an ALLERGY item flagged CONTEXT_UNCLEAR, other than one whose experiencer is another person, is still shown in the positive allergy list with "Needs clarification — context". The allergy status line is then "Allergy status unclear — needs clarification", and "No known allergies"/NKDA is never shown in a view or note while it exists. It remains ineligible for evidence and note statements. (ADR-045) Extraction items rejected by validation are not facts; they are listed as "Not extracted — check transcript" (segment link, category, reason code; `AI.md` §5.1 rule 20).

### 3.4 ConfidenceLevel

HIGH · MEDIUM · LOW · UNKNOWN. This is extraction or transcription confidence only, never clinical likelihood. Raw provider values are kept in `rawConfidence`.

### 3.5 SpeakerRole

DOCTOR · PATIENT · OTHER · UNKNOWN. DOCTOR denotes the clinician role regardless of profession. There is no civil-identity recognition and no voiceprints.

### 3.6 FactCategory

SYMPTOM · HISTORY_MEDICAL · HISTORY_SURGICAL · HISTORY_FAMILY · HISTORY_SOCIAL · MEDICATION · ALLERGY · VITAL_SIGN · EXAMINATION_FINDING · INVESTIGATION · ASSESSMENT · PLAN · FOLLOW_UP · DEMOGRAPHIC · OTHER

DEMOGRAPHIC (ADR-050): patient details stated in the consultation. Attributes `demographicKind` (NAME / AGE / DATE_OF_BIRTH / SEX / OCCUPATION / EDUCATION / LANGUAGE), `demographicValue` (the stated detail, a verbatim sub-span), `demographicQualifier` (CURRENT / PREVIOUS). conceptKey `demographic:<kind>`. Never searched, never sent to the R2 job, excluded from timeline and visit comparison. Never inferred (no sex from pronouns, no occupation from context).

### 3.7 EvidenceSourceType

REGULATORY · LITERATURE · GUIDELINE · PATIENT_EDUCATION · CLINICAL_TRIAL · TERMINOLOGY · CHEMICAL_INFORMATION · PUBLIC_HEALTH

### 3.8 StageState

NOT_STARTED · IN_PROGRESS · PARTIAL · COMPLETED · FAILED · SKIPPED

### 3.9 DerivationMethod — how the fact's value was produced

| Value | Meaning | Allowed provenance |
|---|---|---|
| VERBATIM_EXTRACTION | value is a contiguous span of one cited segment after deterministic normalization (numbers and negation exact; `AI.md` §5.1 rule 17, ADR-044) | PATIENT_REPORTED, CLINICIAN_STATED, TRANSCRIPTION |
| NORMALIZED_EXTRACTION | value is a contiguous span of one cited segment, with deterministic normalization by code stored in `normalizedValue` (`value` stays verbatim) | PATIENT_REPORTED, CLINICIAN_STATED, TRANSCRIPTION |
| AI_INFERENCE | value combines, interprets or summarizes content beyond one verbatim span | AI_EXTRACTED only |
| MANUAL_ENTRY | typed by the clinician | CLINICIAN_CONFIRMED, MEASURED |
| CLINICIAN_EDIT | clinician changed a value (new version) | CLINICIAN_CONFIRMED |
| EXTERNAL_LOOKUP | from a provider response | EXTERNAL_SOURCE |
| DETERMINISTIC_RULE | produced by tested code, e.g. conflict detection or a derived status | the provenance of the inputs (never upgraded; never CLINICIAN_CONFIRMED or MEASURED). A role-only correction (§3.2 rule 8) keeps the fact's original derivation method and does not use DETERMINISTIC_RULE |

### 3.10 ClarificationReason

UNCERTAIN_SPEECH (low ASR confidence or `[unclear]`) · HEDGED_STATEMENT ("maybe", "I think") · AMBIGUOUS_MEDICATION (several normalization candidates, or name uncertain) · UNIDENTIFIED_SUBJECT (e.g. "the medication was stopped" with no identifiable medication) · CONFLICT (fact is part of an OPEN FactConflict) · CONTEXT_UNCLEAR (a grounded statement whose clause is hypothetical/conditional or about another person and does not fit its category, e.g. "if I climb stairs I get chest pain", "my son has had a fever"; ineligible for automatic input until the clinician acts; ADR-045) · SOURCE_CHANGED (the source segment's text or speaker role was corrected after this fact was extracted: a CONFIRMED fact awaiting clinician review, or a PROVISIONAL fact awaiting re-extraction; ADR-038, ADR-043) · OTHER

## 4. Entity Definitions

Fields for each entity. Types are logical; physical column types are set in Phase 4.

### 4.1 Patient

| Field | Type | Required | Notes |
|---|---|---|---|
| patientId | UUID | yes | |
| patientReference | string | yes | unique, `P-` + 6 digits |
| name | string | no | optional identity |
| dateOfBirth | date | no | |
| age | integer | no | derived from DOB if present; 0–130 |
| sex | enum FEMALE/MALE/OTHER/UNKNOWN | no | |
| createdAt, updatedAt | timestamp | yes | |

### 4.2 Visit

| Field | Type | Required |
|---|---|---|
| visitId | UUID | yes |
| patientId | UUID | yes |
| startedAt | timestamp | yes |
| endedAt | timestamp | no |
| consentState | NOT_RECORDED / CONFIRMED / DECLINED / WITHDRAWN | yes |
| recordingState | NOT_STARTED / RECORDING / PAUSED / STOPPED / FAILED | yes |
| transcriptState | StageState | yes |
| speakerMappingState | StageState | yes |
| clinicalExtractionState | StageState | yes |
| evidenceState | StageState | yes |
| candidateState | StageState | yes |
| noteState | NONE / DRAFT / EDITED / FINALIZED | yes |
| mode | AMBIENT / MANUAL | yes |

### 4.3 ConsentRecord

| Field | Type | Notes |
|---|---|---|
| consentId | UUID | |
| visitId | UUID | |
| state | CONFIRMED / DECLINED / WITHDRAWN | |
| method | VERBAL_ATTESTED_BY_CLINICIAN / WRITTEN_ATTESTED_BY_CLINICIAN | |
| attestedByClinician | boolean | must be true for CONFIRMED |
| recordedAt | timestamp | |

### 4.4 TranscriptSegment

| Field | Type | Notes |
|---|---|---|
| segmentId | UUID | |
| displayCode | string | `T-0043` |
| visitId | UUID | |
| speakerId | string | anonymous provider label (A, B, …) |
| speakerRole | SpeakerRole | proposed, then clinician-confirmed |
| speakerRoleConfirmed | boolean | true after the clinician confirms the mapping |
| text | string | |
| startTime, endTime | duration from visit start | |
| confidence | ConfidenceLevel | |
| rawConfidence | number | optional |
| isFinal | boolean | live vs final |
| editedByClinician | boolean | |
| sourceProvider | string | adapter ID; `clinician-typed` for manual utterances |
| recordingSegmentId | UUID | v2: recording segment (§4.4a) |
| language | BCP-47 | v2: language recognised or selected; text is never translated in place |
| addedAt | timestamp | v2: when the utterance was appended |
| origin | LIVE / PARTIAL_COMMIT / FINAL / MANUAL / SPLIT / DEMO | v2 |
| clinicianMarkedUncertain | boolean | v2: extraction flags facts from it UNCERTAIN_SPEECH |
| excluded | { reason DUPLICATE / MERGED / ACCIDENTAL, at, mergedIntoSegmentId } | v2: left out of the canonical transcript; text kept as evidence |
| possibleRepeatOf | UUID | v2: display hint from reconciliation; nothing is deleted |

### 4.4a RecordingSegment, transcript versions and the canonical transcript (ADR-050)

A visit holds 1…n recording segments. Fields: recordingSegmentId, displayCode (`SEG-0001`), index, startedAt, endedAt, status (RECORDING / PAUSED / COMPLETED), transcriptionStatus (IN_PROGRESS / COMPLETED / PARTIAL / FAILED / EMPTY), language, provider, clockOffsetSec (visit recording clock at start), durationSec (pauses excluded), pauses [{pausedAt, resumedAt}], createdAt.

Visit v2 fields: `recordingSegments`, `consultationState` (OPEN / FINALIZED), `consultationFinalizedAt`, `transcriptVersion` (incremented on every append or change), `reconciledTranscriptVersion` (version the current facts were extracted from), `lastReconciledAt`, `segmentRevisions` [{segmentId, action, previousText, previousRole, transcriptVersion, at}], `reportVersions` (§4.25), `evidenceConceptSignature`.

**Canonical transcript:** all non-excluded utterances ordered by recording segment index, then clock time, then insertion order. Deterministic; contains no utterance twice. Extraction and reconciliation read it; only English utterances are auto-extracted (ADR-050 d11).

**Time policy:** timestamps are stored as UTC ISO-8601 and shown in device local time. `Visit.startedAt` is the encounter start and is never reset; `endedAt` follows the latest segment end; utterance `startTime`/`endTime` are seconds on the visit recording clock.

**Migration v1 → v2 (on read):** an ambient v1 visit gets one SEG-0001 covering all utterances (startedAt = visit start, durationSec = recordingDurationSec); an interrupted v1 recording becomes a PAUSED segment. Nothing else changes.

### 4.5 ClinicalFact

| Field | Type | Notes |
|---|---|---|
| factId | UUID | |
| patientId, visitId | UUID | |
| category | FactCategory | |
| conceptKey | string | **computed by code** from `value`/`normalizedValue` through the normalization table: normalized symptom name, normalized drug name (replaced by the RxCUI only once a single exact RxNorm match or a clinician selection sets it, Phase 11), allergen, test name, `ANY` for blanket statements ("no medications"). Derived from the fact's **own** value only; a model-proposed key is kept only if it equals the table output for that value; segment text never validates a key; no table entry → `UNMAPPED` (ADR-043, ADR-044) |
| value | string | original wording, exact numbers |
| normalizedValue | string | only from deterministic normalization |
| unit | string | as stated |
| informationState | InformationState | |
| originProvenance | Provenance | immutable (§3.2) |
| rootOriginProvenance | Provenance | immutable; origin of the first version in the chain since the last source correction (§3.2, ADR-035, ADR-043) |
| provenance | Provenance | current authority (§3.2) |
| status | ReviewStatus | |
| derivationMethod | DerivationMethod | §3.9 |
| sourceSegmentIds | UUID[] | ≥1 for conversation-derived facts; exactly 1 for VERBATIM/NORMALIZED extraction |
| sourceSpeakerId | string | copied from the primary segment |
| sourceSpeakerRole | SpeakerRole | copied from the primary segment's confirmed role when the version is created (recomputed for a role-only correction, §3.2 rule 8) |
| sourceStartTime | duration | start time of the primary segment |
| confidence | ConfidenceLevel | extraction confidence |
| needsClarification | boolean | |
| clarificationReason | ClarificationReason | required when needsClarification |
| supersedesFactId | UUID | previous version, for edits and corrections |
| supersededByFactId | UUID | set when a newer version exists |
| resolvedAwayByConflictId | UUID | set when a clinician resolved a conflict in favor of another fact (§5.7); the fact stays visible as history |
| conflictIds | UUID[] | OPEN or RESOLVED FactConflicts involving this fact |
| aiJobVersion | string | prompt/job version if AI-produced |
| providerExecutionId | UUID | the ProviderExecution that produced it, if AI-produced |
| confirmedAt, confirmedBy | timestamp, CLINICIAN | set on confirmation |
| createdAt, updatedAt | timestamp | |

### 4.6 Symptom

symptomId, factId, patientId, visitId, name, informationState, onset, duration, severity, frequency, location, character, triggers, relievingFactors, aggravatingFactors, associatedSymptoms, explicitNegation (boolean).

Unmentioned attributes remain null and are never inferred. Provenance, status and source come from the linked ClinicalFact.

### 4.7 Medication

medicationId, factId, patientId, visitId, rawName, normalizedName, rxcui, normalizationCandidates (list of {rxcui, name, source}), dose, route, frequency, duration, takingStatus (CURRENT / PREVIOUS / DISCONTINUED / UNKNOWN).

- `takingStatus` describes whether the patient takes the medication. It is distinct from the fact's `informationState`, which describes whether the medication was discussed or affirmed. Example: "maybe metformin?" → informationState UNKNOWN, takingStatus UNKNOWN, needsClarification true (AMBIGUOUS_MEDICATION or HEDGED_STATEMENT).
- DISCONTINUED requires an explicit statement that identifies the medication, or a clinician action. Absence from a later visit never changes the status (§10.2).
  - single-segment explicit statement ("I stopped the lisinopril two weeks ago") → VERBATIM_EXTRACTION, PROVISIONAL (CS-13)
  - question and answer across segments (DOCTOR "Still on amlodipine?" / PATIENT "No, I stopped it") → AI_EXTRACTED / AI_INFERENCE, PROVISIONAL, labeled "AI INFERENCE — VERIFY", only when the medication is named in the cited segments (CS-36, ADR-035)
  - no identifiable medication → no status change; needsClarification UNIDENTIFIED_SUBJECT (CS-26)
- `rawName` stays on the device. Only the sanitized drug term is sent for normalization (`ARCHITECTURE.md` §6.4, F-03).
- `rxcui` is set only from a single exact RxNorm match or the clinician's selection among `normalizationCandidates`. The RxNorm response is schema-validated and stored as a TERMINOLOGY EvidenceSource (`responseValidated = true`), which is the "stored, validated response" that later label lookups use (ADR-036, ADR-039).

### 4.8 Allergy

allergyId, factId, patientId, visitId, substance, reaction, severity, informationState.

"No known allergies" means informationState NEGATIVE with substance `ANY`, and only when explicitly stated. A patient with no Allergy records has allergy status NOT_DISCUSSED.

### 4.9 Investigation

investigationId, factId, patientId, visitId, testName, value, unit, date, investigationStatus (ORDERED / SCHEDULED / COMPLETED / RESULT_AVAILABLE / RESULT_DISCUSSED / PENDING / UNKNOWN), result.

### 4.10 Assessment

assessmentId, factId, patientId, visitId, text, linkedCandidateId.

An assessment exists only when the clinician stated it (CLINICIAN_STATED, PROVISIONAL until reviewed), entered it manually (CLINICIAN_CONFIRMED), or confirmed a candidate. A candidate-confirmed Assessment's ClinicalFact has originProvenance = rootOriginProvenance = AI_EXTRACTED, derivation AI_INFERENCE, `sourceSegmentIds` = the union of its supporting facts' segments, provenance CLINICIAN_CONFIRMED, status CONFIRMED, and `linkedCandidateId` set (ADR-038). A patient's report of a diagnosis ("My doctor told me I have asthma") is a HISTORY_MEDICAL fact, PATIENT_REPORTED, never an Assessment (CS-40).

### 4.11 Plan

planId, factId, patientId, visitId, text.

### 4.12 FollowUp

followUpId, factId, patientId, visitId, dueDate, reason, task, followUpStatus (PENDING / COMPLETED / CANCELLED / UNKNOWN), completedAt, completedBy (CLINICIAN only).

### 4.13 Appointment

appointmentId, patientId, scheduledAt, reason, status (SCHEDULED / COMPLETED / CANCELLED / UNKNOWN). **Not implemented in V1** (§1).

### 4.14 ClinicalCandidate

candidateId, visitId, generationRunId, topic, reason, supportingFactIds, contradictingFactIds, conflictFactIds (facts in an OPEN conflict, shown as "Conflict — review"), missingInformation (list of strings), evidenceIds, evidenceStateAtGeneration (COMPLETED / PARTIAL) and failedRoutes, sourceFactVersionIds (the exact fact versions used), outdated (boolean, set by code), supersededByRunId, status (PROVISIONAL / DISMISSED / CONFIRMED_BY_CLINICIAN), clinicianDecisionAt, aiJobVersion, providerExecutionId.

- There is no probability or rank field (ADR-016). Display order is alphabetical by topic, computed by code (ADR-034).
- `evidenceIds` must be a subset of the EvidenceSources retrieved for the same visit before candidate generation ran (§5.2 order; ADR-023).
- All referenced facts must be eligible for automatic input (§3.3a). `supportingFactIds` reference only POSITIVE facts (UNKNOWN only when labeled "uncertain") that are not in an OPEN conflict. Facts in an OPEN conflict appear only in `conflictFactIds`. NEGATIVE facts appear only in `contradictingFactIds`. NOT_DISCUSSED topics appear only in `missingInformation` (ADR-034, ADR-038, CS-33).
- `missingInformation` lists clinical information that was not discussed. It never names sources, guidelines or papers.
- `outdated` becomes true when any fact in `sourceFactVersionIds` is edited, rejected, superseded or resolved away, or becomes part of a newly detected conflict. Outdated candidates show "Outdated — facts changed since generation" and **cannot be confirmed** (nor can candidates with `supersededByRunId` set) (ADR-038, CS-43).
- Evidence citable by a candidate excludes CLINICAL_TRIAL and PUBLIC_HEALTH records and records that left the citable bundle (§4.16, ADR-039).
- ClinicalCandidates exist only when `possibilitiesEnabled` was ON when the run happened (ADR-025, ADR-034). They are never rendered in notes or exports. Only a CONFIRMED Assessment created from one can be.

### 4.15 EvidenceQuery

queryId, visitId, origin (AUTOMATIC / CLINICIAN_MANUAL), candidateId (optional; set when a CLINICIAN_MANUAL search is started from an existing candidate), sourceFactIds, sourceFactVersionIds, concepts (list of {term, informationState}; terms sanitized), productIdentifiers (optional typed public identifiers taken from stored validated responses, ADR-036), route, provider, createdAt, state (PENDING / COMPLETED / FAILED / NO_RESULTS).

AUTOMATIC queries are generated **by deterministic code** (job 11, ADR-039) from facts and concepts only, before candidates exist (ADR-023). Concepts are the `conceptKey` of facts that are eligible for automatic input (§3.3a), with informationState POSITIVE or UNKNOWN, conceptKey not UNMAPPED, not in an OPEN conflict, category not HISTORY_FAMILY or HISTORY_SOCIAL, and originProvenance not AI_EXTRACTED unless CONFIRMED (ADR-034, ADR-043). NEGATIVE and NOT_DISCUSSED facts never produce concepts (CS-33). Routes come from the code-owned route table; CANCER_INFO only from a HISTORY_MEDICAL or ASSESSMENT fact in the cancer concept list; AUTOMATIC queries on TRIALS, CHEMICAL or PUBLIC_HEALTH routes are rejected by a code constant (CS-38). `sourceFactVersionIds` records the exact fact versions used. Every path (automatic, manual, autocomplete) passes the on-device sanitizer (ADR-036).

**Fact participation in automatic evidence retrieval (authoritative; `AI.md` job 11, `EVIDENCE-SOURCES.md` §17, `CLINICAL-SAFETY.md` CS-33/CS-38 refer here).**

| Fact | Produces an AUTOMATIC query concept? | Other use in the evidence/candidate stage |
|---|---|---|
| ACTIVE: eligible (§3.3a), POSITIVE, mapped conceptKey, category not HISTORY_FAMILY/HISTORY_SOCIAL, not AI_EXTRACTED unless CONFIRMED, not in an OPEN conflict | yes | may be a supporting fact for a candidate (R2) |
| ACTIVE with informationState UNKNOWN | yes, labeled "(UNKNOWN)" in "Retrieved for" | supporting only labeled "uncertain" |
| NEGATIVE | **no** (never searched as if present) | contradicting fact only (CS-33 B); no "negative-finding" search in V1 |
| NOT_DISCUSSED | **no** | missing information only |
| REJECTED | **no** | none |
| SUPERSEDED or RESOLVED_AWAY | **no** | none; visible as history |
| SOURCE_CHANGED (awaiting re-extraction or review) or CONTEXT_UNCLEAR | **no** | none until re-extracted or acted on by the clinician |
| in an OPEN conflict | **no** | `conflictFactIds` only ("Conflict — review") |
| conceptKey UNMAPPED, HISTORY_FAMILY, HISTORY_SOCIAL, or unconfirmed AI_EXTRACTED | **no** | the clinician may run a manual search (CLINICIAN_MANUAL) |

A clinician manual search is never restricted by this table, but still passes the sanitizer.

### 4.16 EvidenceSource

evidenceId, queryId, provider, sourceType, tier (1–6, assigned per record by content type, see `EVIDENCE-SOURCES.md` §2), title, identifier, identifierType (PMID / PMCID / DOI / NCT / SETID / RXCUI / APPLICATION_NO / NDC / CID / URL), alternateIdentifiers (from deduplication), url, publishedAt, updatedAt, retrievedAt (the original provider fetch time, never a cache-read time), relevance (HIGH / MEDIUM / LOW: retrieval relevance, not clinical likelihood), excerpt, limitations, responseValidated (boolean), metadata.

`identifier` comes only from a schema-validated provider response (`responseValidated = true`). Records that fail validation are never stored.

Additional fields (ADR-039): `visitId` (the bundle is visit-scoped), `cachedFromEvidenceId` (set when copied from an earlier visit's cache hit; `retrievedAt` stays the original fetch time), `retrievedFor` (concept and information state, or "Clinician search"), `factsChangedSinceRetrieval` (boolean, set by code when any source fact of the record's query is edited, rejected, superseded, resolved away, flagged SOURCE_CHANGED or enters an OPEN conflict; the card shows "Based on facts that changed since retrieval"), `citable` (false when all of the query's source facts are REJECTED or resolved away, or when the sourceType is CLINICAL_TRIAL or PUBLIC_HEALTH).

### 4.17 Note

noteId, visitId, noteType (SOAP / GENERAL / PROGRESS), currentVersionId, finalized (boolean), finalizedByClinician (boolean), finalizedAt, unreviewedFactCountAtFinalize (integer, recorded for audit; includes PROVISIONAL facts and facts flagged SOURCE_CHANGED or CONTEXT_UNCLEAR).

### 4.18 NoteVersion

versionId, noteId, versionNumber, content, statements (for AI_DRAFT: the validated statements `{section, order, sourceFactIds | conflictId | notDiscussed}`; code rendered `content` from the referenced facts with fixed templates, and the model supplied no text, ADR-043), source (AI_DRAFT / MANUAL_DRAFT / CLINICIAN_EDIT / CLINICIAN_FINALIZED), createdAt, editedByClinician, aiJobVersion. Append-only.

`NoteVersion.source` describes how the note text was authored. It is a separate enum from fact provenance (§3.2). CLINICIAN_FINALIZED is deliberately not named "confirmed": finalizing a note confirms no fact (CS-25).

### 4.19 AuditEvent

eventId, entityType, entityId, action (CREATED / UPDATED / CONFIRMED / REJECTED / DISMISSED / DELETED / EXPORTED / CONSENT_RECORDED / RECORDING_STARTED / RECORDING_PAUSED / RECORDING_STOPPED / ROLE_MAPPING_CHANGED / SUPERSEDED_BY_EDIT / CONFLICT_DETECTED / CONFLICT_RESOLVED / PROPOSAL_ACCEPTED / PROPOSAL_REJECTED), actor (CLINICIAN / SYSTEM / AI), previousValue, newValue, createdAt.

Audit events are stored locally only and are never sent to logs or analytics. When a patient is deleted, their audit events are deleted too; a non-identifying deletion marker may remain.

### 4.20 ProviderExecution

Records each external provider call for reliability and debugging. Technical metadata only, no clinical content.

| Field | Type | Notes |
|---|---|---|
| executionId | UUID | |
| visitId | UUID | optional |
| providerKind | SPEECH / DIARIZATION / LLM / MEDICATION / EVIDENCE | |
| providerName | string | adapter ID |
| job | string | e.g. `clinical_fact_extraction` |
| jobVersion | string | prompt/schema version |
| model | string | model identifier from configuration |
| startedAt, endedAt | timestamp | |
| outcome | SUCCESS / VALIDATION_FAILED / PROVIDER_ERROR / TIMEOUT / FALLBACK_USED / CANCELLED | |
| attempt | integer | 1 or 2 (one retry) |
| errorCode | string | technical code only |

Never stores prompts, transcript text, responses or query text.

### 4.21 FactConflict

| Field | Type | Notes |
|---|---|---|
| conflictId | UUID | |
| patientId, visitId | UUID | visit in which the conflict was detected |
| factIds | UUID[] | ≥2 facts with the same `category` + `conceptKey` (or a blanket `ANY` fact and a specific fact) |
| conflictType | SELF_CORRECTION / SPEAKER_DISAGREEMENT / BLANKET_VS_SPECIFIC / VALUE_MISMATCH / CROSS_VISIT / PROFILE_MISMATCH | §9. PROFILE_MISMATCH (ADR-050): one DEMOGRAPHIC fact differs from the manual profile |
| profileField, profileValue | string | PROFILE_MISMATCH only: profile field (name / age / occupation / preferredLanguage) and its recorded value. The profile is changed only by an explicit clinician action |
| explicitCorrection | boolean | set by code when the later statement has a correction cue; the report shows it as current pending confirmation |
| detectedBy | DETERMINISTIC_RULE / AI_JOB | AI_JOB = flagged by job 2 as a correction; always re-checked by the deterministic detector |
| status | OPEN / RESOLVED_BY_CLINICIAN / DISMISSED_BY_CLINICIAN | |
| proposedCurrentFactId | UUID | system proposal (usually the later statement); **not authoritative** |
| resolvedCurrentFactId | UUID | set only by the clinician |
| resolutionNote | string | optional clinician text |
| detectedAt, resolvedAt | timestamp | |

### 4.22 ProblemListEntry

problemId, patientId, label, problemStatus (ACTIVE / RESOLVED / INACTIVE), originRecordType (ASSESSMENT / CLINICAL_FACT / MANUAL), originRecordId, provenance (always CLINICIAN_CONFIRMED), createdBy (CLINICIAN), createdAt, resolvedAt.

Only a clinician can create or change entries (§10.1).

### 4.23 ProfileUpdateProposal

proposalId, patientId, visitId, targetType (PROBLEM / MEDICATION / ALLERGY / HISTORY / FOLLOW_UP), changeType (ADD / UPDATE / STATUS_CHANGE), proposedValue (structured), sourceFactIds, producedBy (AI_JOB / DETERMINISTIC_RULE), aiJobVersion, status (PROVISIONAL / ACCEPTED / REJECTED), decidedAt.

Proposals are produced by AI job 10 and by deterministic rules. They never change the profile until the clinician accepts them. On acceptance the target record is created or updated with provenance CLINICIAN_CONFIRMED.

### 4.24a Patient profile additions (v2)

`occupation`, `preferredLanguage` (registry code) — optional, manual, on device only, never sent.

### 4.25 ReportVersion (ADR-051)

versionId, versionNumber, generatedAt, transcriptVersion, generator (`clinnote-report@1`), extractionProviders, clinicianEditedFactCount, confirmedFactCount, currentFactCount, unresolvedConflictCount, report (structured JSON built by code, `domain/report.ts`). Previous versions are kept. Generating a version confirms nothing.

### 4.24 AppSettings (local, non-clinical)

onboardingAcknowledgedAt, onboardingVersion, processingDisclosureShownAt, cloudProcessingEnabled (boolean, default false until onboarding acknowledged), defaultNoteType, appLockEnabled.

## 5. State Machines

Allowed transitions. Any transition not listed is rejected at the repository boundary.

### 5.1 Recording

```text
NOT_STARTED --start [consent CONFIRMED and cloudProcessingEnabled and clinician signed in]--> RECORDING
RECORDING --pause / interruption--> PAUSED
PAUSED --resume--> RECORDING
RECORDING|PAUSED --stop--> STOPPED
RECORDING|PAUSED --error--> FAILED
RECORDING|PAUSED --consent withdrawn--> STOPPED (consentState=WITHDRAWN)
```

v2 (ADR-050): the transitions apply **per recording segment**; `Visit.recordingState` mirrors the active segment. Finishing a segment (STOPPED) leaves the consultation OPEN. `OPEN --finalize [no active segment]--> FINALIZED`; `FINALIZED --add more conversation--> OPEN` (audited, new segment). UI phases (IDLE, REQUESTING_PERMISSION, RECORDING, PAUSED, PROCESSING_SEGMENT, SEGMENT_COMPLETE, CONSULTATION_OPEN, FINALIZING, FINALIZED, ERROR, RECOVERABLE) and the actions each offers are defined in `domain/consultation.ts` (`PHASE_ACTIONS`).

### 5.2 Pipeline Stages (canonical order, ADR-023, ADR-034)

```text
transcript → speakerMapping → clinicalExtraction (+ deterministic conflict detection)
           → evidence  (queries from facts/concepts; retrieval; validation; dedup; ranking; storage)
           → candidate (R2, flag-gated: possibilities from facts + stored evidence; synthesis)
note: depends on clinicalExtraction only (never on candidate); renders no candidates
```

Generic transitions:

```text
NOT_STARTED → IN_PROGRESS → COMPLETED | PARTIAL | FAILED
FAILED | PARTIAL --retry--> IN_PROGRESS
NOT_STARTED --manual mode / consent declined / cloud processing off--> SKIPPED
```

Stage-specific preconditions (each listed condition must hold; otherwise the stage is SKIPPED with a displayed reason, or waits):

| Stage | May start when |
|---|---|
| speakerMapping | transcript COMPLETED or PARTIAL |
| clinicalExtraction | speakerMapping COMPLETED (roles confirmed, §3.2 rule 5) |
| evidence (automatic) | clinicalExtraction COMPLETED or PARTIAL, cloud processing on, clinician signed in. A fully manual visit runs no automatic evidence stage (SKIPPED); clinician manual searches are always available when online |
| candidate | `possibilitiesEnabled` ON **and** evidence COMPLETED or PARTIAL **and** the citable bundle is non-empty. Otherwise `NOT_STARTED --precondition not met--> SKIPPED` ("Possibilities not generated: …"). Never from facts alone. (This full condition is the canonical gating wording; other documents refer here.) |
| note drafting | clinicalExtraction COMPLETED, PARTIAL or SKIPPED (manual) |

Clinician-only transitions:
- evidence: `COMPLETED | PARTIAL | FAILED | SKIPPED --clinician "Re-run evidence search" [cloud processing on, signed in]--> IN_PROGRESS`. A completed evidence stage never re-runs automatically (ADR-039). A stage that never completed (e.g. backend unavailable) may be retried from the cloud-stage queue (`ARCHITECTURE.md` §8)
- candidate: `COMPLETED --clinician regenerate--> IN_PROGRESS` (the earlier run's candidates are kept and marked `supersededByRunId`)
- candidate: `SKIPPED --clinician, after a successful "Re-run evidence search"--> IN_PROGRESS`

A fully manual visit has transcript, speakerMapping, clinicalExtraction, evidence and candidate SKIPPED; manual note drafting is always available.

### 5.3 Fact Review

```text
PROVISIONAL --clinician confirm--> CONFIRMED            (provenance → CLINICIAN_CONFIRMED; originProvenance unchanged)
PROVISIONAL --clinician reject--> REJECTED
PROVISIONAL --clinician edit--> new version CONFIRMED   (CLINICIAN_EDIT; old version superseded, kept)
CONFIRMED --clinician edit--> new version CONFIRMED     (CLINICIAN_EDIT; old version superseded, kept)
CONFIRMED --clinician reject--> REJECTED                (audited with reason)
REJECTED --clinician restore--> PROVISIONAL
PROVISIONAL --segment role-only correction, category still valid--> new version PROVISIONAL  (provenance recomputed, derivation kept, §3.2 rule 8; old version superseded, kept)
CONFIRMED --segment role/text corrected--> CONFIRMED + needsClarification SOURCE_CHANGED  (no silent change)
PROVISIONAL --segment text corrected, or role change invalidates category--> PROVISIONAL + needsClarification SOURCE_CHANGED (ineligible for automatic input)
   → superseded by a matching re-extracted fact (ADR-043), or
   → clinician confirm / edit / reject (explicit exit when nothing matches)
PROVISIONAL + needsClarification CONTEXT_UNCLEAR --clinician confirm with category confirmed or changed (e.g. "File as family history")--> CONFIRMED, flag cleared (ADR-045)
PROVISIONAL + needsClarification CONTEXT_UNCLEAR --clinician edit / reject--> as above
```

AI and SYSTEM actors cannot perform any transition out of PROVISIONAL. Finalizing a note performs no fact transition (§5.5).

### 5.4 Clinical Candidate

```text
PROVISIONAL --dismiss--> DISMISSED
PROVISIONAL --confirm [outdated = false and supersededByRunId null]--> CONFIRMED_BY_CLINICIAN (creates Assessment per §4.10: originProvenance AI_EXTRACTED, provenance CLINICIAN_CONFIRMED, status CONFIRMED)
DISMISSED --restore--> PROVISIONAL
```

### 5.5 Note

```text
NONE → DRAFT (AI_DRAFT or MANUAL_DRAFT) → EDITED (CLINICIAN_EDIT)* → FINALIZED (clinician action)
DRAFT | EDITED --clinician regenerate--> DRAFT (new AI_DRAFT version; earlier versions kept, ADR-040)
FINALIZED --clinician amend--> EDITED (new version; previous finalized version retained)
```

Finalizing records `unreviewedFactCountAtFinalize` and leaves every PROVISIONAL fact PROVISIONAL (FR-23.2, CS-25).

### 5.6 Follow-Up

```text
PENDING --clinician--> COMPLETED | CANCELLED
```

### 5.7 Fact Conflict

```text
(detected) → OPEN
OPEN --clinician selects current fact--> RESOLVED_BY_CLINICIAN (resolvedCurrentFactId set; the other facts remain visible as history with resolvedAwayByConflictId set)
OPEN --clinician dismisses (not a real conflict)--> DISMISSED_BY_CLINICIAN
RESOLVED_BY_CLINICIAN | DISMISSED_BY_CLINICIAN --clinician reopen--> OPEN
```

### 5.8 Profile Update Proposal

```text
PROVISIONAL --clinician accept--> ACCEPTED (target updated with provenance CLINICIAN_CONFIRMED)
PROVISIONAL --clinician reject--> REJECTED
```

## 6. Validation Rules

1. Enum fields accept only the listed values.
2. `patientReference` is unique and matches `^P-\d{6}$`.
3. A Visit cannot enter RECORDING without a CONFIRMED ConsentRecord, `cloudProcessingEnabled = true` and a signed-in clinician account (FR-28.4).
4. Records created by actor AI must have status PROVISIONAL, a non-null `aiJobVersion` and a `providerExecutionId`. (A later clinician confirmation changes status and provenance only.)
5. Every `sourceSegmentIds` entry must reference a final segment of the same visit.
6. Every number in an extracted `value` must appear in the source segment text (`AI.md` §5.1).
7. `EvidenceSource.identifier` must originate from a schema-validated provider response.
8. ClinicalCandidate fact and evidence ID lists must reference existing records of the same visit. Evidence IDs must belong to the bundle that existed when the candidate was generated.
9. Only actor CLINICIAN can set CONFIRMED, CONFIRMED_BY_CLINICIAN, FINALIZED, COMPLETED, RESOLVED_BY_CLINICIAN, ACCEPTED, provenance CLINICIAN_CONFIRMED or MEASURED, or a CONFIRMED takingStatus DISCONTINUED. Extraction may produce a PROVISIONAL DISCONTINUED only as described in §4.7 (CS-13, CS-36).
10. Age is 0–130. Dates may not be in the future, except follow-up and appointment dates.
11. **`originProvenance`**/derivation pairs must match §3.9 (ADR-038; a confirmation changes only `provenance`). VERBATIM and NORMALIZED extraction require exactly one source segment. AI_INFERENCE requires originProvenance AI_EXTRACTED.
12. originProvenance PATIENT_REPORTED or CLINICIAN_STATED requires `sourceSpeakerRole` PATIENT or DOCTOR respectively, and `speakerRoleConfirmed = true` on the source segment.
13. `needsClarification = true` requires a `clarificationReason`.
14. A fact referenced by an OPEN FactConflict cannot be rendered in a note as settled (§9).
15. Provenance UNKNOWN is rejected for new records created by V1 pipelines.
16. `rootOriginProvenance` must equal the `originProvenance` of the first version in the `supersedesFactId` chain **since the last source correction** (ADR-043).
17. ClinicalCandidate fact references follow the information-state rules in §4.14; violations are rejected (CS-33).
18. No ClinicalCandidate may be created while `possibilitiesEnabled` is OFF (CS-37).
19. Job-2 output: `conceptKey` is computed by the normalization table from the fact's own `normalizedValue` (or `value`); a model-proposed key is kept only if it equals that output; segment text never validates a key; no table entry → UNMAPPED (ADR-043, ADR-044, CS-38).
20. Extraction items pass the deterministic context check (`AI.md` §5.1 rule 19): no POSITIVE fact from a hypothetical or conditional clause, no patient fact from a statement about another person, no fact grounded only in a question, and a conditional PLAN keeps its condition; a grounded item whose context does not fit its category is kept flagged CONTEXT_UNCLEAR, not accepted (ADR-044 decision 5, ADR-045, CS-46).

## 7. Example JSON (synthetic)

All values below are synthetic and illustrative.

### 7.1 Patient

```json
{
  "patientId": "6b1f2c1e-0000-4000-8000-000000000001",
  "patientReference": "P-900001",
  "name": null,
  "dateOfBirth": null,
  "age": 54,
  "sex": "FEMALE",
  "createdAt": "2026-10-08T09:00:00+05:30",
  "updatedAt": "2026-10-08T09:00:00+05:30"
}
```

### 7.2 TranscriptSegment

```json
{
  "segmentId": "9c0e-0000-4000-8000-000000000043",
  "displayCode": "T-0043",
  "visitId": "a1a1-0000-4000-8000-000000000010",
  "speakerId": "B",
  "speakerRole": "PATIENT",
  "speakerRoleConfirmed": true,
  "text": "I've had this cough for about three weeks, no fever though.",
  "startTime": "00:08:31",
  "endTime": "00:08:36",
  "confidence": "HIGH",
  "rawConfidence": 0.93,
  "isFinal": true,
  "editedByClinician": false,
  "sourceProvider": "speech-mock"
}
```

### 7.3 ClinicalFacts from that segment

```json
[
  {
    "factId": "f001",
    "category": "SYMPTOM",
    "conceptKey": "cough",
    "value": "cough for about three weeks",
    "normalizedValue": null,
    "unit": null,
    "informationState": "POSITIVE",
    "originProvenance": "PATIENT_REPORTED",
    "provenance": "PATIENT_REPORTED",
    "status": "PROVISIONAL",
    "derivationMethod": "VERBATIM_EXTRACTION",
    "sourceSegmentIds": ["9c0e-0000-4000-8000-000000000043"],
    "sourceSpeakerId": "B",
    "sourceSpeakerRole": "PATIENT",
    "sourceStartTime": "00:08:31",
    "confidence": "HIGH",
    "needsClarification": false,
    "aiJobVersion": "clinical_fact_extraction@1"
  },
  {
    "factId": "f002",
    "category": "SYMPTOM",
    "conceptKey": "fever",
    "value": "no fever",
    "informationState": "NEGATIVE",
    "originProvenance": "PATIENT_REPORTED",
    "provenance": "PATIENT_REPORTED",
    "status": "PROVISIONAL",
    "derivationMethod": "VERBATIM_EXTRACTION",
    "sourceSegmentIds": ["9c0e-0000-4000-8000-000000000043"],
    "sourceSpeakerRole": "PATIENT",
    "confidence": "HIGH",
    "needsClarification": false,
    "aiJobVersion": "clinical_fact_extraction@1"
  }
]
```

After the clinician confirms f001: `"provenance": "CLINICIAN_CONFIRMED"`, `"status": "CONFIRMED"`, `"originProvenance": "PATIENT_REPORTED"` (unchanged), `confirmedAt` set.

### 7.4 Medication with ambiguous normalization

```json
{
  "medicationId": "m001",
  "factId": "f010",
  "rawName": "metformin 500 twice a day",
  "normalizedName": null,
  "rxcui": null,
  "normalizationCandidates": [
    { "rxcui": "VERIFY-FROM-RXNORM", "name": "candidate returned by RxNorm", "source": "RxNorm" }
  ],
  "dose": "500",
  "route": null,
  "frequency": "twice a day",
  "takingStatus": "CURRENT"
}
```

The linked fact f010 has `needsClarification: true` and `clarificationReason: "AMBIGUOUS_MEDICATION"`. Candidate values come only from the RxNorm response; none are invented here.

### 7.5 FactConflict (blanket denial, then a specific medication)

```json
{
  "conflictId": "k001",
  "visitId": "a1a1-0000-4000-8000-000000000010",
  "factIds": ["f020", "f021"],
  "conflictType": "BLANKET_VS_SPECIFIC",
  "detectedBy": "DETERMINISTIC_RULE",
  "status": "OPEN",
  "proposedCurrentFactId": "f021",
  "resolvedCurrentFactId": null
}
```

f020: "I don't take any medications" (MEDICATION, conceptKey `ANY`, NEGATIVE, PATIENT_REPORTED, T-0012). f021: "I take metformin" (MEDICATION, conceptKey = metformin, POSITIVE, PATIENT_REPORTED, T-0057).

### 7.6 ClinicalCandidate

```json
{
  "candidateId": "c001",
  "topic": "Chronic cough — causes to review",
  "reason": "Cough reported for about three weeks",
  "supportingFactIds": ["f001"],
  "contradictingFactIds": [],
  "missingInformation": ["smoking history not discussed", "medication history not discussed"],
  "evidenceIds": ["e001"],
  "status": "PROVISIONAL"
}
```

### 7.7 ProviderExecution

```json
{
  "executionId": "x001",
  "visitId": "a1a1-0000-4000-8000-000000000010",
  "providerKind": "LLM",
  "providerName": "llm-mock",
  "job": "clinical_fact_extraction",
  "jobVersion": "1",
  "model": "configured-model-id",
  "startedAt": "2026-10-08T09:21:00+05:30",
  "endedAt": "2026-10-08T09:21:04+05:30",
  "outcome": "SUCCESS",
  "attempt": 1,
  "errorCode": null
}
```

## 8. Fact Derivation Lifecycle (authoritative)

```text
RAW TRANSCRIPT ──► EXTRACTION OUTPUT ──► PROVISIONAL FACT ──► CLINICIAN-CONFIRMED FACT
(TranscriptSegment)  (AI job JSON, not     (validated, stored,    (status CONFIRMED,
                      yet a fact)           status PROVISIONAL)     provenance CLINICIAN_CONFIRMED)
```

### 8.1 Raw transcript

These are final TranscriptSegments with a speaker label, a confirmed speaker role, start and end times, and ASR confidence. Extraction does not run until the speaker mapping is confirmed (§5.2).

### 8.2 Extraction output (transient)

AI jobs 2–9 (`AI.md` §3) return JSON items. Each item carries: category, conceptKey, value, unit, informationState, sourceSegmentIds, derivationMethod (VERBATIM_EXTRACTION / NORMALIZED_EXTRACTION / AI_INFERENCE), confidence, needsClarification, and clarificationReason. These items are not facts yet and are never shown to the user.

### 8.3 Promotion to PROVISIONAL fact

Deterministic code promotes an item to a fact only if all of the following hold:

1. it passes JSON Schema validation
2. it passes semantic validation (`AI.md` §5.1): segments exist, numbers are present in the source, negation is consistent, every text field is grounded in the cited segments (rule 17, ADR-044), the derivation and provenance pairing is allowed, and `conceptKey` is computed by code from the item's own value (rule 16)
3. its provenance is assigned **by code, not by the model**, from the confirmed `speakerRole` of the source segment and the derivation method (§3.2):
   - single PATIENT segment, verbatim or normalized → PATIENT_REPORTED
   - single DOCTOR segment, verbatim or normalized → CLINICIAN_STATED
   - UNKNOWN or OTHER segment → TRANSCRIPTION
   - AI_INFERENCE, or more than one segment → AI_EXTRACTED
4. `sourceSpeakerId`, `sourceSpeakerRole` and `sourceStartTime` are copied from the primary segment
5. it is stored with `status = PROVISIONAL`, `originProvenance = rootOriginProvenance = provenance`, `aiJobVersion` and `providerExecutionId`

The deterministic conflict detector (§9) then runs over the new facts and the patient's existing facts.

Items that fail validation after one retry are discarded. The stage becomes PARTIAL or FAILED. The transcript and manual entry remain available.

### 8.4 Promotion to CLINICIAN-CONFIRMED fact

Only an explicit clinician action can promote a fact: Confirm, Edit, or Accept proposal. The rules are in §3.2 and §5.3. Finalizing a note is not a confirmation.

### 8.5 Distinguishability guarantee

An AI inference (AI_EXTRACTED / AI_INFERENCE) can never look like a directly spoken fact:

- the provenance differs
- the derivation method differs
- the UI label differs ("AI INFERENCE — VERIFY")
- validation rule 11 rejects mislabeling

CS-29 tests this (`CLINICAL-SAFETY.md` §18).

## 9. Contradiction Model (authoritative, ADR-022)

**Definition.** A contradiction exists when two or more facts eligible for automatic input (§3.3a) about the same patient share a `category` and `conceptKey` (UNMAPPED facts: an identical normalized value) (or one of them is a blanket `ANY` fact in the same category), and they disagree in `informationState` or in value (dose, frequency, duration, result).

**Detection.** A deterministic detector runs after every extraction and every manual entry. It compares facts eligible for automatic input only (§3.3a): the current visit and the patient's current facts from earlier visits, CONFIRMED or PROVISIONAL, with each fact's review status shown (ADR-035, ADR-038). Versions of the same fact chain are never compared with each other. A pair whose conflict the clinician already resolved or dismissed is not re-opened unless one of the facts gets a new version. AI job 2 may flag a statement as a self-correction ("sorry, I meant…"), but conflicts are always created and checked by the deterministic detector.

**Types.**

| Type | Example (synthetic) |
|---|---|
| SELF_CORRECTION | "Cough for two weeks… actually about a month." |
| SPEAKER_DISAGREEMENT | Patient: "No chest pain." Clinician: "You mentioned chest pain earlier." |
| BLANKET_VS_SPECIFIC | "I don't take any medications." … "I take metformin." · "No allergies." … "I am allergic to penicillin." |
| VALUE_MISMATCH | "Metformin 500 twice a day" vs "metformin 1000 daily" |
| CROSS_VISIT | Visit 1 "no diabetes history" (CONFIRMED or PROVISIONAL) vs visit 2 "history of diabetes" |

**Rules.**

1. **Both observations are kept.** Nothing is overwritten or deleted. Each fact keeps its own provenance and source segment.
2. A FactConflict with status OPEN is created. Each involved fact gets `needsClarification = true` (reason CONFLICT) and the `conflictId`.
3. The system may set `proposedCurrentFactId`, usually the later statement, but this has **no effect** until the clinician resolves the conflict.
4. A later correction supersedes an earlier statement **only after** the conflict is recorded and the clinician resolves it (RESOLVED_BY_CLINICIAN with `resolvedCurrentFactId`). The other facts remain visible as history.
5. While a conflict is OPEN:
   - notes render it as a conflict for review (e.g. "Medication history conflicting: initially denied medications, later reported metformin. Clinician to verify"), never as a settled fact
   - profile update proposals that depend on it are not created
   - comparisons show it as conflicting
6. **Safety bias for allergies.** A POSITIVE allergy statement is always displayed prominently, even while it conflicts with a NEGATIVE statement. It is never hidden by a "no allergies" statement, whether earlier or later.
7. **Cross-visit conflicts** never change the earlier visit's records. They create a conflict on the current visit that references both facts.

CS-14, CS-27 and CS-28 test this model.

## 10. Derived Views (authoritative)

### 10.1 Active problems

The active problems view lists ProblemListEntries with `problemStatus = ACTIVE`. Entries are created only by the clinician, from:

- a CONFIRMED Assessment
- a CONFIRMED HISTORY_MEDICAL fact
- manual entry

PROVISIONAL items, including unconfirmed assessments and ProfileUpdateProposals, **never** appear as active problems. They appear in a separate "Proposed — needs review" list (§10.4). AI candidates (possibilities) never appear in the profile at all.

### 10.2 Current medications

Current medications are computed per medication identity (RxCUI if confirmed, otherwise normalized name, otherwise raw name):

1. take the most recent **CONFIRMED** Medication record across all visits
2. include it if `takingStatus = CURRENT`
3. if later visits do not mention it, it stays current, annotated "not discussed since <date>"
4. it leaves the list only through a CONFIRMED record with takingStatus DISCONTINUED or PREVIOUS
5. current PROVISIONAL medication mentions from **any** visit are shown in the separate "Proposed — needs review" list (§10.4)
6. a medication involved in an OPEN conflict is shown with a conflict marker

### 10.3 Allergy status

Computed over allergy facts eligible for automatic input across all visits (§3.3a), **plus** patient ALLERGY items flagged CONTEXT_UNCLEAR (ADR-045 allergy exception: they make the status "unclear" and appear in the positive list, but never become eligible). Two parts:

1. **Positive list (always shown when non-empty):** every POSITIVE allergy fact, CONFIRMED or PROVISIONAL, with its status, plus every ALLERGY item flagged CONTEXT_UNCLEAR whose experiencer is the patient (shown "Needs clarification — context"; ADR-045 allergy exception). It stays prominent even while a conflict is OPEN.
2. **Overall status line:** the first matching row.

| Condition | Status line |
|---|---|
| any current UNKNOWN allergy fact, or a patient ALLERGY item flagged CONTEXT_UNCLEAR | "Allergy status unclear — needs clarification" (this wins over an older "No known allergies") |
| a CONFIRMED NEGATIVE `ANY` fact, and no POSITIVE allergy | "No known allergies" |
| a PROVISIONAL NEGATIVE `ANY` fact, and no POSITIVE allergy | "No allergies reported — needs review" (never rendered as NKDA in a note; CS-41) |
| a POSITIVE allergy exists | "Other allergies: not established", or "No other known allergies (confirmed <date>)" when a CONFIRMED NEGATIVE `ANY` statement post-dates every POSITIVE fact and no conflict is OPEN. Never "No known allergies" while any current POSITIVE allergy exists (CS-41) |
| only specific-substance NEGATIVE facts | "No allergy to <substance> reported" for each, plus "General allergy status not discussed" |
| no allergy fact at all | "Not discussed" |

Any row involved in an OPEN allergy conflict shows "Conflict — review".

### 10.4 Proposed — needs review (ADR-038)

This list shows current PROVISIONAL items from **all** visits (medications, history, assessments, problems from ProfileUpdateProposals), dated and grouped "This visit" and "From earlier visits — not reviewed". An item leaves the list only by a clinician action (confirm, reject, edit, accept or reject the proposal). The one exception: a later CONFIRMED record of the same item removes an earlier PROVISIONAL mention, but only when no OPEN conflict links the two (CS-42).
