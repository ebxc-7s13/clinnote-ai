# ClinNote AI — Data Model

This document defines the domain model: entities, fields, relationships, enumerations, state machines, provenance and validation. Field names are logical; the physical SQLite schema is created in BUILD_PLAN Phase 4 and must match this document.

All entities live in the on-device Local Clinical Store (ADR-005, ADR-013). The backend stores none of them.

Conventions:

- IDs are locally generated UUIDs, except `patientReference` (`P-000001`) and `segmentId` display codes (`T-0043`).
- Timestamps are ISO-8601 with timezone offset.
- `value` fields keep original wording and numbers exactly; normalized values are stored separately.
- All examples use synthetic data.

---

## 1. Entities

Patient · Visit · TranscriptSegment · ClinicalFact · Symptom · Medication · Allergy · Investigation · Assessment · Plan · FollowUp · Appointment · EvidenceQuery · EvidenceSource · ClinicalCandidate · Note · NoteVersion · ConsentRecord · AuditEvent · ProviderExecution

"Encounter" (product language) = `Visit` (data model).

## 2. Relationships

```text
Patient 1 ── * Visit
Patient 1 ── * Medication        (across visits; patient medication list)
Patient 1 ── * Allergy
Patient 1 ── * FollowUp
Patient 1 ── * Appointment
Patient 1 ── timeline (derived view over Visits, Symptoms, Medications, Investigations, Assessments, FollowUps)

Visit 1 ── 0..* ConsentRecord     (latest record governs)
Visit 1 ── * TranscriptSegment    (visit → transcript)
Visit 1 ── * ClinicalFact         (visit → facts)
Visit 1 ── * Symptom / Medication / Allergy / Investigation / Assessment / Plan / FollowUp
Visit 1 ── * ClinicalCandidate
Visit 1 ── * EvidenceQuery 1 ── * EvidenceSource   (visit → evidence)
Visit 1 ── * Note                  (visit → notes)
Note  1 ── * NoteVersion           (notes → versions, append-only)
Visit 1 ── * ProviderExecution

ClinicalFact * ── 0..1 TranscriptSegment  (sourceSegmentId)
Symptom / Medication / Allergy / Investigation / Assessment / Plan / FollowUp 1 ── 1 ClinicalFact (factId)
ClinicalCandidate * ── * ClinicalFact     (supporting / contradicting)
ClinicalCandidate * ── * EvidenceSource
Assessment 0..1 ── 0..1 ClinicalCandidate (when confirmed from a candidate)
AuditEvent * ── 1 any entity             (entityType + entityId)
```

Typed entities (Symptom, Medication, …) are category-specific detail records; each has a corresponding ClinicalFact carrying the shared attributes (information state, provenance, status, source segment). Manual entries create both records too.

Deleting a Patient cascades to all related records (`PRIVACY.md`).

## 3. Shared Enumerations

Enumerations used by several entities.

### 3.1 InformationState

| Value | Meaning |
|---|---|
| NOT_DISCUSSED | not raised in the visit |
| NEGATIVE | explicitly absent ("no", "denies", "never", "negative for") |
| POSITIVE | explicitly present |
| UNKNOWN | raised, but unclear/uncertain |

NOT_DISCUSSED and NEGATIVE are never conflated (ADR-015).

### 3.2 Provenance

PATIENT_REPORTED · CLINICIAN_STATED · MEASURED · TRANSCRIPTION · AI_EXTRACTED · EXTERNAL_SOURCE · CLINICIAN_CONFIRMED · UNKNOWN

Rules:

- Provenance PATIENT_REPORTED / CLINICIAN_STATED requires a source segment whose speaker role is PATIENT / DOCTOR respectively.
- A fact from a segment with speaker role UNKNOWN or OTHER gets TRANSCRIPTION (or PATIENT_REPORTED only if role OTHER is a companion speaking for the patient and the clinician confirmed the mapping).
- CLINICIAN_CONFIRMED is set only by a clinician action. The prior provenance is preserved in the AuditEvent.

### 3.3 ReviewStatus

PROVISIONAL · CONFIRMED · REJECTED · UNKNOWN

All AI output starts PROVISIONAL. Manual clinician entries start CONFIRMED.

### 3.4 ConfidenceLevel

HIGH · MEDIUM · LOW · UNKNOWN — extraction/transcription confidence only, never clinical likelihood. Raw provider values are kept in `rawConfidence`.

### 3.5 SpeakerRole

DOCTOR · PATIENT · OTHER · UNKNOWN. DOCTOR denotes the clinician role regardless of profession.

### 3.6 FactCategory

SYMPTOM · HISTORY_MEDICAL · HISTORY_SURGICAL · HISTORY_FAMILY · HISTORY_SOCIAL · MEDICATION · ALLERGY · VITAL_SIGN · EXAMINATION_FINDING · INVESTIGATION · ASSESSMENT · PLAN · FOLLOW_UP · OTHER

### 3.7 EvidenceSourceType

REGULATORY · LITERATURE · GUIDELINE · PATIENT_EDUCATION · CLINICAL_TRIAL · TERMINOLOGY · CHEMICAL_INFORMATION · PUBLIC_HEALTH

### 3.8 StageState

NOT_STARTED · IN_PROGRESS · PARTIAL · COMPLETED · FAILED · SKIPPED

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
| speakerId | string | anonymous provider label |
| speakerRole | SpeakerRole | |
| text | string | |
| startTime, endTime | duration from visit start | |
| confidence | ConfidenceLevel | |
| rawConfidence | number | optional |
| isFinal | boolean | live vs final |
| editedByClinician | boolean | |
| sourceProvider | string | adapter ID |

### 4.5 ClinicalFact

| Field | Type | Notes |
|---|---|---|
| factId | UUID | |
| patientId, visitId | UUID | |
| category | FactCategory | |
| value | string | original wording, exact numbers |
| normalizedValue | string | only from deterministic normalization |
| unit | string | as stated |
| informationState | InformationState | |
| provenance | Provenance | |
| status | ReviewStatus | |
| sourceSegmentId | UUID | required unless provenance is CLINICIAN_STATED via manual entry |
| confidence | ConfidenceLevel | |
| aiJobVersion | string | prompt/job version if AI-produced |
| createdAt, updatedAt | timestamp | |

### 4.6 Symptom

symptomId, factId, patientId, visitId, name, informationState, onset, duration, severity, frequency, location, character, triggers, relievingFactors, aggravatingFactors, associatedSymptoms, explicitNegation (boolean), provenance, status, sourceSegmentId.

Unmentioned attributes remain null — never inferred.

### 4.7 Medication

medicationId, factId, patientId, visitId, rawName, normalizedName, rxcui, normalizationCandidates (list of {rxcui, name}), dose, route, frequency, duration, status (CURRENT / PREVIOUS / DISCONTINUED / UNKNOWN), provenance, sourceSegmentId, clinicianConfirmation (boolean).

DISCONTINUED requires an explicit statement in a source segment or a clinician action. Absence from a later visit never changes status.

### 4.8 Allergy

allergyId, factId, patientId, visitId, substance, reaction, severity, informationState, provenance, status, sourceSegmentId.

"No known allergies" = informationState NEGATIVE with substance `ANY`, only when explicitly stated. Patient allergy status with no Allergy records = NOT_DISCUSSED.

### 4.9 Investigation

investigationId, factId, patientId, visitId, testName, value, unit, date, status, result, provenance, sourceSegmentId.

### 4.10 Assessment

assessmentId, factId, patientId, visitId, text, provenance, status, sourceSegmentId, linkedCandidateId.

### 4.11 Plan

planId, factId, patientId, visitId, text, provenance, status, sourceSegmentId.

### 4.12 FollowUp

followUpId, factId, patientId, visitId, dueDate, reason, task, status (PENDING / COMPLETED / CANCELLED / UNKNOWN), provenance, completedAt, completedBy (CLINICIAN only).

### 4.13 Appointment

appointmentId, patientId, scheduledAt, reason, status (SCHEDULED / COMPLETED / CANCELLED / UNKNOWN).

### 4.14 ClinicalCandidate

candidateId, visitId, topic, reason, supportingFactIds, contradictingFactIds, missingInformation (list of strings), evidenceIds, status (PROVISIONAL / DISMISSED / CONFIRMED_BY_CLINICIAN), clinicianDecisionAt, aiJobVersion.

No probability or rank field exists (ADR-016).

### 4.15 EvidenceQuery

queryId, visitId, candidateId (optional), provider, queryText (concepts only), createdAt, state (PENDING / COMPLETED / FAILED / NO_RESULTS).

### 4.16 EvidenceSource

evidenceId, queryId, provider, sourceType, tier (1–6), title, identifier, identifierType (PMID / PMCID / DOI / NCT / SETID / RXCUI / APPLICATION_NO / NDC / CID / URL), url, publishedAt, updatedAt, retrievedAt, relevance (HIGH / MEDIUM / LOW — retrieval relevance, not clinical likelihood), excerpt, limitations, metadata.

`identifier` comes only from the provider response.

### 4.17 Note

noteId, visitId, noteType (SOAP / GENERAL / PROGRESS), currentVersionId, finalized (boolean), finalizedByClinician (boolean), finalizedAt.

### 4.18 NoteVersion

versionId, noteId, versionNumber, content, source (AI_DRAFT / MANUAL_DRAFT / CLINICIAN_EDIT / CLINICIAN_CONFIRMED), createdAt, editedByClinician, aiJobVersion. Append-only.

### 4.19 AuditEvent

eventId, entityType, entityId, action (CREATED / UPDATED / CONFIRMED / REJECTED / DISMISSED / DELETED / EXPORTED / CONSENT_RECORDED / RECORDING_STARTED / RECORDING_PAUSED / RECORDING_STOPPED / ROLE_MAPPING_CHANGED), actor (CLINICIAN / SYSTEM / AI), previousValue, newValue, createdAt.

Stored locally only; never sent to logs or analytics. When a patient is deleted, its audit events are deleted too (a non-identifying deletion marker may remain).

### 4.20 ProviderExecution

Records each external provider call for reliability and debugging — technical metadata only, no clinical content.

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

Never stores prompts, transcript, responses or query text.

## 5. State Machines

Allowed transitions. Any transition not listed is rejected at the repository boundary.

### 5.1 Recording

```text
NOT_STARTED --start [consent CONFIRMED]--> RECORDING
RECORDING --pause / interruption--> PAUSED
PAUSED --resume--> RECORDING
RECORDING|PAUSED --stop--> STOPPED
RECORDING|PAUSED --error--> FAILED
RECORDING|PAUSED --consent withdrawn--> STOPPED (consentState=WITHDRAWN)
```

### 5.2 Pipeline Stages (transcript, speakerMapping, clinicalExtraction, evidence)

```text
NOT_STARTED → IN_PROGRESS → COMPLETED | PARTIAL | FAILED
FAILED | PARTIAL --retry--> IN_PROGRESS
NOT_STARTED --manual mode / consent declined--> SKIPPED
```

Each stage may start only when the previous stage is COMPLETED, PARTIAL or SKIPPED.

### 5.3 Fact Review

```text
PROVISIONAL --clinician confirm--> CONFIRMED (provenance → CLINICIAN_CONFIRMED)
PROVISIONAL --clinician reject--> REJECTED
CONFIRMED --clinician edit--> CONFIRMED (new values, audited)
REJECTED --clinician restore--> PROVISIONAL
```

AI and SYSTEM actors cannot perform any transition out of PROVISIONAL.

### 5.4 Clinical Candidate

```text
PROVISIONAL --dismiss--> DISMISSED
PROVISIONAL --confirm--> CONFIRMED_BY_CLINICIAN (creates Assessment, provenance CLINICIAN_CONFIRMED)
DISMISSED --restore--> PROVISIONAL
```

### 5.5 Note

```text
NONE → DRAFT (AI_DRAFT or MANUAL_DRAFT) → EDITED (CLINICIAN_EDIT)* → FINALIZED (clinician action)
FINALIZED --clinician amend--> EDITED (new version; previous finalized version retained)
```

### 5.6 Follow-Up

```text
PENDING --clinician--> COMPLETED | CANCELLED
```

## 6. Validation Rules

1. Enum fields accept only listed values.
2. `patientReference` unique and matching `^P-\d{6}$`.
3. A Visit cannot enter RECORDING without a CONFIRMED ConsentRecord.
4. AI-produced records must have status PROVISIONAL and a non-null `aiJobVersion`.
5. `sourceSegmentId` must reference a segment of the same visit.
6. Every number in an AI-extracted `value` must appear in the source segment text (`AI.md` semantic validation).
7. `EvidenceSource.identifier` must originate from a provider response (checked by the adapter).
8. ClinicalCandidate fact/evidence ID lists must reference existing records of the same visit.
9. Only actor CLINICIAN can set CONFIRMED, CONFIRMED_BY_CLINICIAN, FINALIZED, COMPLETED or DISCONTINUED (unless DISCONTINUED is explicitly stated in a segment).
10. Age 0–130; dates not in the future except follow-up/appointment dates.

## 7. Example JSON (synthetic)

All values below are synthetic and illustrative.

### 7.1 Patient

```json
{
  "patientId": "6b1f2c1e-0000-4000-8000-000000000001",
  "patientReference": "P-000001",
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
    "value": "cough for about three weeks",
    "normalizedValue": null,
    "unit": null,
    "informationState": "POSITIVE",
    "provenance": "PATIENT_REPORTED",
    "status": "PROVISIONAL",
    "sourceSegmentId": "9c0e-0000-4000-8000-000000000043",
    "confidence": "HIGH",
    "aiJobVersion": "clinical_fact_extraction@1"
  },
  {
    "factId": "f002",
    "category": "SYMPTOM",
    "value": "no fever",
    "informationState": "NEGATIVE",
    "provenance": "PATIENT_REPORTED",
    "status": "PROVISIONAL",
    "sourceSegmentId": "9c0e-0000-4000-8000-000000000043",
    "confidence": "HIGH",
    "aiJobVersion": "clinical_fact_extraction@1"
  }
]
```

### 7.4 Medication with ambiguous normalization

```json
{
  "medicationId": "m001",
  "rawName": "metformin 500 twice a day",
  "normalizedName": null,
  "rxcui": null,
  "normalizationCandidates": [
    { "rxcui": "VERIFY-FROM-RXNORM", "name": "candidate returned by RxNorm" }
  ],
  "dose": "500",
  "route": null,
  "frequency": "twice a day",
  "status": "CURRENT",
  "provenance": "PATIENT_REPORTED",
  "clinicianConfirmation": false
}
```

(Candidate values come only from the RxNorm response; none are invented here.)

### 7.5 ClinicalCandidate

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

### 7.6 ProviderExecution

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
