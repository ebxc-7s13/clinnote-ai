# ClinNote AI — System Architecture

This document is the architecture authority. See `CLAUDE.md` for precedence rules.

## 1. Architecture Philosophy

Use:

LOCAL-FIRST

API-FIRST

PROVIDER-AGNOSTIC

SECURITY-FIRST

CLINICIAN-CONTROLLED

The mobile application should remain useful even when cloud services fail.

## 2. High-Level Architecture

```text
                     ANDROID APP
                          |
            +-------------+-------------+
            |                           |
            v                           v
     Local Clinical Store        Secure API Layer
                                 (serverless backend)
            |                           |
            |              +------------+-------------+
            |              |            |             |
            |              v            v             v
            |          Speech API     LLM API     Evidence APIs
            |                              |
            |                              v
            |                        Validation
            |                              |
            +------------------------------+
```

The Local Clinical Store on the device is the system of record for patient data (ADR-003). The backend is stateless with respect to clinical content: it forwards requests to providers and returns results, and does not persist transcripts, facts or notes.

## 3. Mobile Layers

### Presentation

Screens, navigation, UI states, accessibility.

### Domain

Patient, visit, symptom, medication, allergy, investigation, evidence, note, timeline. Pure TypeScript, no framework or provider imports.

### Services

Speech, AI, evidence, storage, export. Services depend on provider interfaces, never on concrete providers.

### Infrastructure

Database, networking, device permissions, secure storage, provider adapters.

Technology: React Native + Expo + TypeScript (ADR-009). Local database: SQLite (ADR-011).

## 4. Backend

Use a minimal serverless backend (Supabase Edge Functions by default, ADR-010).

Responsibilities:

- API key protection
- request validation
- authentication where necessary
- rate limiting
- provider routing
- response validation
- evidence retrieval
- AI calls
- issuing short-lived, scoped tokens for streaming speech providers where the provider supports them (so the device can stream audio without holding a long-lived key), or proxying the audio stream where it does not

The backend must not:

- persist transcripts, clinical facts, notes or audio
- log request bodies containing clinical content

Avoid unnecessary microservices.

The authentication model for calling the backend (to prevent anonymous abuse of paid provider keys) is OPEN DECISION OD-004.

Public, keyless evidence APIs (e.g. RxNorm) may still be called through the backend so that request identification (e.g. NCBI tool/email), caching and rate limiting are centralized. Direct device-to-provider calls are allowed only for keyless public APIs and only if an ADR records the reason.

## 5. Provider Abstraction

Interfaces:

SpeechProvider

DiarizationProvider

LLMProvider

EvidenceProvider

MedicationProvider

LiteratureProvider

HealthInformationProvider

ClinicalTrialProvider

ImageProvider

StorageProvider

`DiarizationProvider` exists separately because some speech providers return diarization together with transcription and others do not; when the speech provider includes diarization, a single adapter implements both interfaces.

`ImageProvider` is defined but not implemented until OD-008 (reference-image source) is resolved.

Every adapter maps provider responses into ClinNote domain types (`DATA_MODEL.md`) at the boundary; provider-specific types never leak into the domain or UI layers.

## 6. Processing Pipeline

```text
Audio
 ↓
Speech Provider
 ↓
Transcript
 ↓
Speaker Segments
 ↓
Clinical Extraction
 ↓
Structured Clinical Facts
 ↓
Patient Profile (provisional updates)
 ↓
Clinical Topic Generation (possibilities to review)
 ↓
Evidence Query Generator
 ↓
Evidence Providers
 ↓
Evidence Bundle
 ↓
LLM Evidence Synthesis
 ↓
Clinician Review
 ↓
Note Generation → Clinician Edit → Clinician Confirmation
```

Every stage persists its output to the Local Clinical Store before the next stage starts, so a failure at stage N never loses the output of stages 1..N-1.

## 7. Important Design Decision

Do not perform expensive evidence search for every sentence.

Use:

LIVE STAGE

- transcription
- basic lightweight extraction

POST-CONSULTATION STAGE

- final transcript
- full extraction
- evidence search
- note generation
- patient update

See ADR-008.

## 8. Provider Failure

If primary provider fails:

use configured fallback where safe.

If all providers fail:

retain:

- transcript
- extracted facts where available
- manual note entry

Never erase the encounter.

Each visit tracks the state of each pipeline stage (`Visit.*State` fields in `DATA_MODEL.md`) so failed stages can be retried individually.

## 9. Data Provenance

Clinical facts must contain provenance.

Example:

```text
Fact:
Cough for three weeks

Information state:
POSITIVE

Provenance:
PATIENT_REPORTED

Review status:
PROVISIONAL

Transcript segment:
T-0043

Timestamp:
00:08:31

Confidence:
HIGH
```

Confidence uses the `ConfidenceLevel` enum in `DATA_MODEL.md` (HIGH / MEDIUM / LOW / UNKNOWN). It describes extraction confidence, never clinical likelihood.

## 10. Data Flow

Never send more data than needed to an external API.

Separate:

raw transcript

structured clinical data

external evidence

generated explanation

final clinician-confirmed record

Evidence queries sent to external evidence APIs contain clinical concepts only (e.g. "metformin", "chronic cough adult"), never patient identifiers, names, dates of birth or transcript text.

Provider data-flow details are recorded per provider in `PRIVACY.md` (Third-Party Providers).
