# ClinNote AI — System Architecture

This is the architecture authority (`CLAUDE.md`, Section 2).

---

## 1. Architecture Principles

| Principle | Meaning in ClinNote |
|---|---|
| Local-first | The device database is the system of record for patient data (ADR-005). The app is useful offline. |
| API-first | AI and speech run through cloud APIs; no local model weights (ADR-002, ADR-003). |
| Provider-agnostic | Every external provider sits behind an interface; providers are swappable by configuration (ADR-004). |
| Clinician-controlled | AI output is PROVISIONAL until the clinician confirms it (ADR-007). |
| Privacy-minimized | Only the minimum necessary data leaves the device; the backend stores no clinical content. |
| Modular | Layers with one-directional dependencies; features in separate modules. |
| Testable | Every provider has a mock; domain logic is pure and unit-testable. |

## 2. High-Level Architecture

```text
┌──────────────────────────────────────────────┐
│ ANDROID APP (React Native + Expo, TypeScript)│
│  Presentation → Application → Domain         │
└───────────────┬──────────────────────────────┘
                ↓
┌──────────────────────────────────────────────┐
│ LOCAL DOMAIN / STORAGE                       │
│  SQLite Local Clinical Store (system of      │
│  record), temporary audio (app-private)      │
└───────────────┬──────────────────────────────┘
                ↓  HTTPS (authenticated, minimum data)
┌──────────────────────────────────────────────┐
│ SECURE API LAYER (serverless backend)        │
│  auth · validation · rate limiting · routing │
│  secret custody · response validation        │
│  stores NO clinical content                  │
└───────────────┬──────────────────────────────┘
                ↓
┌──────────────────────────────────────────────┐
│ PROVIDER ADAPTERS                            │
│  Speech · Diarization · LLM · Medication ·   │
│  Literature · Regulatory · Health info ·     │
│  Trials · Terminology · Chemical · Images    │
└──────────────────────────────────────────────┘
```

## 3. Layers

The app has four layers with one-directional dependencies; the backend and provider adapters form two more.

### 3.1 Presentation Layer (app)

Screens, navigation, components, view state, accessibility. Depends only on the application layer. Contains no provider calls and no business rules.

### 3.2 Application / Service Layer (app)

Use cases (e.g. `startVisit`, `recordConsent`, `runPostConsultationPipeline`, `confirmFact`, `generateNote`, `exportNote`). Orchestrates domain objects, repositories and provider clients. Owns pipeline stage state and retries.

### 3.3 Domain Layer (app)

Pure TypeScript: entities, enums, state machines, validation and safety rules from `DATA_MODEL.md` and `CLINICAL-SAFETY.md` (e.g. "absence is not discontinuation", negation checks, number preservation checks). No framework, storage or network imports.

### 3.4 Infrastructure Layer (app)

SQLite repositories (`StorageProvider`), secure key storage, audio recorder, file system, network client to the backend, device permissions.

### 3.5 Backend Layer

Serverless functions (Supabase Edge Functions, ADR-012). Responsibilities:

- authenticate the app (mechanism: OD-004)
- validate request size, types, enums, IDs
- rate limit per client and globally
- hold provider secrets
- issue short-lived, scoped streaming tokens for speech providers that support them, or proxy the audio stream
- route requests to primary/fallback providers per server-side configuration
- validate provider responses against schemas
- record technical metrics without content

The backend must not persist transcripts, facts, notes, evidence queries tied to patients, or audio, and must not log request/response bodies.

### 3.6 Provider Layer

Adapters implementing interfaces. Most adapters run in the backend. Interfaces:

| Interface | Purpose | Candidate providers |
|---|---|---|
| SpeechProvider | live + final transcription | AssemblyAI, Deepgram, OpenAI, Gemini |
| DiarizationProvider | speaker separation | usually same as speech |
| LLMProvider | AI jobs (`AI.md`) | Gemini, OpenAI, Anthropic |
| MedicationProvider | normalization | RxNorm |
| EvidenceProvider (regulatory) | labels, approvals, NDC | openFDA, Drugs@FDA, DailyMed, Orange Book |
| LiteratureProvider | literature | PubMed, Europe PMC |
| HealthInformationProvider | patient education | MedlinePlus, NCI |
| ClinicalTrialProvider | trials | ClinicalTrials.gov |
| TerminologyProvider | condition/term lookup | NLM Clinical Tables |
| ChemicalProvider | compound identity | PubChem |
| PublicHealthProvider | population data | WHO |
| ImageProvider | reference images | OD-008 — not implemented |
| StorageProvider | local persistence | SQLite |

Adapters map provider responses to domain types at the boundary. Provider types never reach the domain or presentation layers. Each provider call creates a `ProviderExecution` record (`DATA_MODEL.md`) with technical metadata only.

Different AI jobs may use different providers; nothing assumes a single provider for all AI functions.

## 4. Code Organization (app)

```text
src/
  presentation/   screens, components, navigation
  application/    use cases, pipeline orchestration
  domain/         entities, enums, rules, validators
  infrastructure/ sqlite, audio, files, secure storage, api client
  providers/      client-side provider interfaces + backend client implementations + mocks
backend/
  functions/      one function per endpoint group (speech-token, llm, evidence, medication)
  adapters/       provider adapters
  schemas/        request/response schemas
```

Exact paths are fixed in Phase 2 and recorded in `DECISIONS.md`.

## 5. Where Processing Happens

| Processing | On device | Backend | Third-party API |
|---|---|---|---|
| Patient/visit storage, search, timeline | ✔ | | |
| Consent recording, audit | ✔ | | |
| Audio capture, temporary audio | ✔ | | |
| Live/final transcription | | token/proxy | ✔ speech provider |
| Diarization | | proxy | ✔ speech provider |
| Speaker role proposal | ✔ (deterministic heuristic) | | |
| Fact extraction, note generation, candidates, synthesis | | ✔ validation | ✔ LLM provider |
| Deterministic safety checks (negation, numbers, IDs) | ✔ | ✔ | |
| Evidence retrieval | | ✔ | ✔ evidence providers |
| Visit comparison (structured diff) | ✔ | | |
| Comparison wording | | ✔ | ✔ LLM provider |
| Export | ✔ | | |

## 6. Data Flows

Each flow below shows where data moves and where it is stored.

### 6.1 Recording

```text
Clinician attests consent → ConsentRecord(CONFIRMED)
→ RECORD_AUDIO permission → Recorder (state machine)
→ audio chunks → app-private temp storage (≤24 h, ADR-014)
→ streamed to speech provider (via token/proxy)
```

### 6.2 Transcription

```text
Audio stream → SpeechProvider (live) → TranscriptSegment(isFinal=false) → UI
Stop → final pass (provider) → TranscriptSegment(isFinal=true) replaces live
→ DiarizationProvider → speaker labels → role proposal → clinician confirms roles
→ temp audio deleted after successful final pass
```

### 6.3 Clinical Extraction

```text
Final transcript (role-labeled) → backend → LLMProvider (separate jobs)
→ JSON → schema validation → semantic validation (segment refs, numbers, negation)
→ retry once on failure → ClinicalFacts (PROVISIONAL) stored locally
→ proposed profile updates (PROVISIONAL)
```

Only the transcript of the current visit and minimal context (age, sex if stored; no name, no DOB, no reference) are sent.

### 6.4 Evidence Retrieval

```text
Facts → evidence query generation (concepts only, identifier check)
→ backend → providers per routing table (not all providers)
→ responses validated → EvidenceSources (tier, dates, retrievedAt) stored locally
→ evidence synthesis (references evidence IDs only) → Evidence screen
```

### 6.5 Note Generation

```text
Facts + confirmed info + clinician review decisions
→ LLMProvider note job → validation (numbers, negation, no NOT_DISCUSSED as normal)
→ NoteVersion(AI_DRAFT) → clinician edits → NoteVersion(CLINICIAN_EDIT)
→ clinician finalizes → NoteVersion(CLINICIAN_CONFIRMED), Note.finalized=true
```

### 6.6 Return-Visit Comparison

```text
Previous visit facts + current visit facts (local)
→ deterministic structured diff (added / changed / unchanged / not discussed this visit)
→ optional LLM wording of the diff (no new facts allowed)
→ Returning Patient / comparison view
```

## 7. Live vs Post-Consultation Stages (ADR-010)

LIVE STAGE: transcription, lightweight display of salient phrases (provisional, no evidence, no possibilities).

POST-CONSULTATION STAGE: final transcript, role confirmation, full extraction, possibilities, evidence retrieval, note generation, profile updates.

Expensive evidence search is never run per sentence.

## 8. Failure and Fallback Paths

| Failure | Behavior |
|---|---|
| Microphone permission denied | Manual mode; explain how to grant |
| Network lost during recording | Banner; transcript so far preserved; audio buffered locally (≤24 h) for later final pass if possible; manual entry |
| Speech provider error / timeout | Retry; switch to configured fallback if available; otherwise manual |
| Diarization unavailable | All segments UNKNOWN role; clinician may assign |
| LLM schema/semantic validation fails | Retry once; then stage PARTIAL/FAILED, transcript and manual entry retained |
| LLM provider down | Fallback provider if configured and validated; otherwise retry later |
| Evidence provider error | Other providers still shown; failed provider marked; no AI filler |
| Backend unavailable | All local features work; cloud stages queued for retry |
| App killed mid-pipeline | Stage state persisted; resume or retry on reopen |

Every stage persists its output before the next stage starts. No failure erases the encounter.

## 9. Data Provenance

Example:

```text
Fact:              Cough for three weeks
Information state: POSITIVE
Provenance:        PATIENT_REPORTED
Review status:     PROVISIONAL
Transcript segment: T-0043
Timestamp:         00:08:31
Confidence:        HIGH   (extraction confidence, not clinical likelihood)
```

## 10. Data Separation

Stored separately and never merged without trace:

- raw transcript
- structured clinical data
- external evidence
- generated explanation
- final clinician-confirmed record

## 11. Configuration

Provider routing, model identifiers and AI feature flags are server-side configuration, changeable without an app release (`DEPLOYMENT.md`, Rollback).
