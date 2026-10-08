# ClinNote AI — Data Model

This document defines domain entities and enumerations. Field names are logical; physical schema (SQLite tables, column types) is defined during Phase 3 and must stay consistent with this document.

All entities are stored in the Local Clinical Store on the device (ADR-003). All timestamps are ISO-8601 with timezone. All IDs are locally generated UUIDs except `patientReference`, which is a human-readable reference (e.g. `P-000001`).

## Core Entities

Patients

Visits

TranscriptSegments

ClinicalFacts

Symptoms

Medications

Allergies

Investigations

Assessments

Plans

FollowUps

Appointments

EvidenceQueries

EvidenceSources

ClinicalCandidates

Notes

NoteVersions

ConsentRecords

AuditEvents

"Encounter" in product documents and "Visit" in this data model refer to the same entity.

## Shared Enumerations

### Information State

What was said about a finding.

NOT_DISCUSSED

NEGATIVE

POSITIVE

UNKNOWN

`UNKNOWN` means the finding was discussed but the answer was unclear or uncertain (e.g. "I'm not sure if I had a fever"). `NOT_DISCUSSED` means it was not raised. These states must never be conflated.

### Provenance Types

Where the information came from.

PATIENT_REPORTED — stated by the patient (or companion) in conversation

CLINICIAN_STATED — stated by the clinician in conversation

MEASURED — an instrument reading or measurement recorded as such

TRANSCRIPTION — raw transcript content not yet attributed

AI_EXTRACTED — produced by an AI transformation and not otherwise attributed

EXTERNAL_SOURCE — from an external evidence/terminology provider

CLINICIAN_CONFIRMED — explicitly confirmed by the clinician in the app

UNKNOWN

When a clinician confirms an AI_EXTRACTED fact, the original provenance is kept in history (via AuditEvent) and the current provenance becomes CLINICIAN_CONFIRMED.

### Status (Review Status)

PROVISIONAL

CONFIRMED

REJECTED

UNKNOWN

Every AI-produced item starts as PROVISIONAL.

### ConfidenceLevel

HIGH

MEDIUM

LOW

UNKNOWN

Describes extraction/transcription confidence only. It is never a clinical probability. Provider-numeric confidence values may be stored separately as `rawConfidence` but are mapped to this enum for display.

## Patient

Fields:

- patientId
- patientReference
- optional name
- optional dateOfBirth
- age
- sex
- createdAt
- updatedAt
- deletedAt (soft-delete marker before hard deletion, see `PRIVACY.md`)

## Visit

Fields:

- visitId
- patientId
- startedAt
- endedAt
- consentState
- recordingState
- transcriptState
- clinicalExtractionState
- evidenceState
- noteState

consentState:

NOT_RECORDED

CONFIRMED

DECLINED

WITHDRAWN

recordingState:

NOT_STARTED

RECORDING

PAUSED

STOPPED

FAILED

transcriptState, clinicalExtractionState, evidenceState:

NOT_STARTED

IN_PROGRESS

PARTIAL

COMPLETED

FAILED

SKIPPED

noteState:

NONE

DRAFT

EDITED

FINALIZED

## ConsentRecord

Fields:

- consentId
- visitId
- state (CONFIRMED / DECLINED / WITHDRAWN)
- method (e.g. VERBAL_ATTESTED_BY_CLINICIAN)
- attestedByClinician (boolean)
- recordedAt

Recording cannot start unless the visit has a ConsentRecord with state CONFIRMED. Withdrawal stops recording immediately.

## TranscriptSegment

Fields:

- segmentId (e.g. `T-0043`)
- visitId
- speakerId
- speakerRole
- text
- startTime
- endTime
- confidence (ConfidenceLevel)
- rawConfidence
- isFinal (live vs final transcript)
- sourceProvider

Speaker roles:

DOCTOR

PATIENT

OTHER

UNKNOWN

`DOCTOR` denotes the clinician role regardless of profession.

## ClinicalFact

Fields:

- factId
- patientId
- visitId
- category
- value
- normalizedValue
- unit
- informationState
- status
- provenance
- sourceSegmentId
- confidence
- createdAt
- updatedAt

Category values:

SYMPTOM

HISTORY_MEDICAL

HISTORY_SURGICAL

HISTORY_FAMILY

HISTORY_SOCIAL

MEDICATION

ALLERGY

VITAL_SIGN

EXAMINATION_FINDING

INVESTIGATION

ASSESSMENT

PLAN

FOLLOW_UP

OTHER

`value` preserves the original wording and numbers exactly. `normalizedValue` is only populated by explicit normalization logic and never replaces `value`.

## Symptom

Fields:

- symptomId
- patientId
- visitId
- name
- informationState
- onset
- duration
- severity
- frequency
- location
- character
- triggers
- relievingFactors
- aggravatingFactors
- associatedSymptoms
- explicitNegation
- provenance
- status
- sourceSegmentId

## Medication

Fields:

- medicationId
- patientId
- visitId
- rawName
- normalizedName
- rxcui
- normalizationCandidates (when ambiguous)
- dose
- route
- frequency
- duration
- status
- provenance
- sourceSegmentId
- clinicianConfirmation

Medication statuses:

CURRENT

PREVIOUS

DISCONTINUED

UNKNOWN

Do not assume discontinuation because a medication is absent from a later visit. DISCONTINUED requires an explicit statement.

## Allergy

Fields:

- allergyId
- patientId
- visitId
- substance
- reaction
- severity
- informationState
- provenance
- status
- sourceSegmentId

"No known allergies" is represented as informationState NEGATIVE with substance `ANY` only when explicitly stated. If allergies were not discussed, the patient's allergy status is NOT_DISCUSSED.

## Investigation

Fields:

- investigationId
- patientId
- visitId
- testName
- value
- unit
- date
- status
- result
- provenance
- sourceSegmentId

Statuses:

ORDERED

SCHEDULED

COMPLETED

RESULT_AVAILABLE

RESULT_DISCUSSED

PENDING

UNKNOWN

## Assessment

Fields:

- assessmentId
- visitId
- patientId
- text
- provenance
- status
- sourceSegmentId
- linkedCandidateId (optional, when confirmed from a ClinicalCandidate)

Only assessments explicitly stated by the clinician or confirmed by the clinician may be CONFIRMED.

## Plan

Fields:

- planId
- visitId
- patientId
- text
- provenance
- status
- sourceSegmentId

## ClinicalCandidate

Fields:

- candidateId
- visitId
- topic
- reason
- supportingFacts (factIds)
- contradictingFacts (factIds)
- missingInformation
- evidenceReferences (evidenceIds)
- status
- clinicianDecision

Statuses:

PROVISIONAL

DISMISSED

CONFIRMED_BY_CLINICIAN

There is no probability field (PRODUCT_SPEC Section 10).

## EvidenceQuery

Fields:

- queryId
- visitId
- candidateId (optional)
- provider
- queryText (clinical concepts only, no identifiers)
- createdAt
- state (PENDING / COMPLETED / FAILED / NO_RESULTS)

## EvidenceSource

Fields:

- evidenceId
- queryId
- provider
- sourceType
- tier (1–6, `EVIDENCE-SOURCES.md`)
- title
- identifier (e.g. PMID, set ID, NCT number, RxCUI)
- url
- publishedAt
- updatedAt
- retrievedAt
- relevance
- excerpt
- limitations
- metadata

sourceType values:

REGULATORY

LITERATURE

GUIDELINE

PATIENT_EDUCATION

CLINICAL_TRIAL

TERMINOLOGY

CHEMICAL_INFORMATION

PUBLIC_HEALTH

`identifier` must come from the provider response. It is never generated by an LLM.

## Note

Fields:

- noteId
- visitId
- noteType (SOAP / GENERAL / PROGRESS)
- currentVersionId
- finalized
- finalizedByClinician
- finalizedAt

## NoteVersion

Fields:

- versionId
- noteId
- content
- source
- createdAt
- editedByClinician

Sources:

AI_DRAFT

MANUAL_DRAFT

CLINICIAN_EDIT

CLINICIAN_CONFIRMED

Versions are append-only.

## FollowUp

Fields:

- followUpId
- patientId
- visitId
- date
- reason
- task
- status
- provenance

Statuses:

PENDING

COMPLETED

CANCELLED

UNKNOWN

AI may not mark a follow-up COMPLETED.

## Appointment

Fields:

- appointmentId
- patientId
- scheduledAt
- reason
- status (SCHEDULED / COMPLETED / CANCELLED / UNKNOWN)

## AuditEvent

Fields:

- eventId
- entityType
- entityId
- action (CREATED / UPDATED / CONFIRMED / REJECTED / DISMISSED / DELETED / EXPORTED / CONSENT_RECORDED / RECORDING_STARTED / RECORDING_STOPPED)
- actor (CLINICIAN / SYSTEM / AI)
- previousValue (optional)
- newValue (optional)
- createdAt

Audit events are stored locally only. They are never sent to analytics or logs.
