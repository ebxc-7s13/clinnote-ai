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

- authenticate the clinician (Supabase Auth clinician accounts, ADR-032; OD-004 resolved for planning)
- validate request size, types, enums, IDs
- rate limit per client and globally
- hold provider secrets
- issue short-lived, scoped streaming tokens for speech providers that support them, or proxy the audio stream
- route requests to primary/fallback providers per server-side configuration
- validate provider responses against schemas
- record technical metrics without content

The backend must not persist transcripts, facts, notes, evidence queries or results, or audio. It must not log request/response bodies, and it keeps **no response cache** (ADR-028). Evidence caching happens only on the device (§6.4). "Stateless" means stateless for clinical content: the only server-side state is non-clinical (rate-limit counters, the Supabase Auth account, routing and flag configuration) (ADR-042).

Endpoints (Phase 7B): unauthenticated `/health` returning only `{status, version}`; authenticated `/config` (R2 flags `possibilitiesEnabled`, `patientExplanationEnabled`; IC-019a); provider routes (speech token/proxy, LLM jobs, evidence, medication). The LLM endpoint refuses jobs 12, 13 and 16 with `FEATURE_DISABLED` when their flags are OFF (defense in depth, CS-37). There is also an authenticated mock provider route, disabled in production.

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
| ClinicalTrialProvider | trials (clinician request only) | ClinicalTrials.gov, NCI trials |
| TerminologyProvider | condition/term lookup | NLM Clinical Tables |
| ChemicalProvider | compound identity | PubChem |
| PublicHealthProvider | population data | WHO |
| ImageProvider | reference images | not implemented in V1 (ADR-029) |
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
| Provenance assignment, conflict detection, fact promotion | ✔ (deterministic code) | | |
| Evidence query sanitization (no patient identifiers or free transcript text, ADR-036) | ✔ | ✔ (re-check: length/charset) | |
| Evidence cache | ✔ (local EvidenceSource records) | | |
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
Final transcript + clinician-CONFIRMED speaker roles (speakerMappingState COMPLETED)
→ backend → LLMProvider (separate jobs 1–9)
→ extraction items (JSON) → schema validation → semantic validation (segment refs, numbers, negation, hedges, derivation, value grounding, context check, code-computed conceptKey: `AI.md` §5.1 rules 1–19, ADR-044)
→ retry once on failure
→ on device: deterministic promotion to ClinicalFacts (PROVISIONAL), with provenance assigned by code from speaker role + derivation
   (DATA_MODEL.md §8.3)
→ deterministic conflict detection over new + prior facts → FactConflicts (OPEN) (DATA_MODEL.md §9)
→ job 10 → ProfileUpdateProposals (PROVISIONAL)
```

Only the transcript of the current visit and minimal context (age, sex if stored; no name, no DOB, no reference) are sent.

### 6.4 Evidence Retrieval and Possibility Generation (canonical order, ADR-023)

```text
STRUCTURED CLINICAL FACTS (eligible for automatic input; POSITIVE or UNKNOWN; code-computed conceptKey not UNMAPPED; not in an OPEN
conflict; not HISTORY_FAMILY/SOCIAL; AI_EXTRACTED only if CONFIRMED — ADR-034, ADR-043; DATA_MODEL §4.15)
→ CLINICAL CONCEPTS = the facts' conceptKeys (each with informationState) + EVIDENCE SEARCH QUERIES
   (job 11 — deterministic code, no LLM, code-owned route table; no concept that is not a stated fact; ADR-039, CS-38)
→ on-device QUERY SANITIZER — one sanitizer for automatic, manual and autocomplete paths (ADR-036):
   allow-list: concept terms, drug names, strength/form tokens, and typed public product/record identifiers
   (RxCUI, set ID, NDC, application no., PMID, NCT, CID) whose values come from a stored, validated provider response;
   rejects patient identifiers by pattern (patient reference `P-\d{6}`, dates, phone/ID-like runs of ≥5 digits,
   e-mail, the patient's own stored name and DOB values, address-like patterns), untyped identifier-like strings, free
   transcript text, >120 chars; short numbers and place names inside normalized clinical concepts ("type 2 diabetes",
   "COVID-19", "Lyme disease", "West Nile virus") are allowed (ADR-043);
   a rejected query shows its reason to the clinician
→ backend (re-validates length/charset) → AUTHORITATIVE EVIDENCE RETRIEVAL per routing table (not all providers;
   no automatic trial retrieval)
→ adapter response-schema validation (fake/malformed responses rejected; CS-16a, CS-17)
→ deterministic DEDUPLICATION → TIER/GROUP → RANKING → per-group cap (EVIDENCE-SOURCES.md §14–§15)
→ EvidenceSources stored on device, visit-scoped (= evidence cache; a cross-visit cache hit is copied with cachedFromEvidenceId;
   retrievedAt = original fetch time; REGULATORY_SAFETY always refetched)                [evidenceState COMPLETED / PARTIAL]
   cards: "Retrieved for: <concept> (<state>)" or "Clinician search"; "Based on facts that changed since retrieval" when source facts change;
   no automatic re-run — clinician "Re-run evidence search" (ADR-039)
── R2 boundary: the steps below run only when the DATA_MODEL §5.2 candidate precondition holds (flag ON, evidence COMPLETED/PARTIAL,
   citable bundle non-empty; ADR-025, ADR-034) ──
→ CANDIDATE / POSSIBILITY GENERATION (job 12: facts + stored bundle)
→ SUPPORTING FINDINGS (POSITIVE) · CONTRADICTING FINDINGS (incl. NEGATIVE) · MISSING INFORMATION (not discussed)
→ SOURCE CITATIONS (evidence IDs ⊆ bundle; rendered from stored metadata; CS-16)
→ EVIDENCE SYNTHESIS per candidate (job 13)                                          [candidateState COMPLETED]
→ CLINICIAN REVIEW
```

With the flag OFF, or with evidence FAILED/SKIPPED or no citable record, `candidateState` is SKIPPED with a displayed reason, and jobs 12–13 are never called. The R1 evidence review (cards, disagreements, citations) works identically either way.

**Why evidence comes before candidates.** Possibilities must be grounded in retrieved authoritative sources. If queries depended on candidates, an un-grounded AI hypothesis would drive retrieval, and citations could be checked only after the fact. With this order:
- evidence retrieval and validation (Phases 11–12) can be completed and tested before any candidate generation exists (Phase 13)
- every candidate citation can be checked against an already-stored bundle

A clinician may start a **manual** search at any time, including from a candidate (EvidenceQuery origin CLINICIAN_MANUAL). Its results are added to the bundle. They can be cited only when the clinician triggers a regeneration; nothing re-runs automatically (ADR-023, ADR-034).

**Medication normalization (F-03).** Only the sanitized drug term (name, plus strength and form tokens if stated) leaves the device. `Medication.rawName` and transcript text never do. Label lookups then use the RxCUI or set ID returned by RxNorm/DailyMed as a typed public identifier (ADR-036).

### 6.5 Note Generation

```text
Current facts (with status/provenance) + OPEN conflicts + CONFIRMED assessments + clinician review decisions
(never ClinicalCandidates — ADR-034)
→ LLMProvider note job → statement selection only (section, order, fact references; no model text)
→ validation (rule 13: section/category; free text rejected; no candidate references)
→ code renders the note text from the referenced facts with fixed templates (ADR-040, ADR-043)
→ NoteVersion(AI_DRAFT) → clinician edits → NoteVersion(CLINICIAN_EDIT)
→ clinician finalizes → NoteVersion(CLINICIAN_FINALIZED), Note.finalized=true   (finalize confirms no fact, CS-25)
```

Note drafting depends only on clinical extraction; it never waits for evidence or possibilities.

### 6.6 Return-Visit Comparison

```text
Previous visit facts + current visit facts (local)
  input set: facts eligible for automatic input only (DATA_MODEL §3.3a: superseded, REJECTED, resolved-away and
  source-changed versions excluded); PROVISIONAL items included but labeled
  "Provisional — not reviewed"; facts in OPEN conflicts shown as conflicting (DATA_MODEL §9 rule 5)
→ deterministic structured diff (added / changed / unchanged / not discussed this visit)
→ optional LLM selection and ordering of diff items (job 14; no free text; code renders the text with templates; labels preserved, ADR-045)
→ Returning Patient / comparison view
```

## 7. Live vs Post-Consultation Stages (ADR-010)

LIVE STAGE: transcription only (live transcript with speaker labels where available). V1 performs no live extraction and shows no salient phrases, evidence or possibilities during recording (ADR-027, refining ADR-010).

POST-CONSULTATION STAGE: final transcript → role confirmation → full extraction + conflict detection → profile update proposals → evidence retrieval → possibilities (R2, only when the DATA_MODEL §5.2 candidate precondition holds); note generation needs only the extraction (§6.3–§6.5).

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
| Evidence stage FAILED/SKIPPED, or empty bundle | Candidate stage SKIPPED with the reason shown ("Possibilities not generated: evidence retrieval did not complete" / "no evidence retrieved"). Candidates are never generated from facts alone (ADR-034). Notes are unaffected |
| Backend unavailable | All local features work; cloud stages that have not completed are queued for retry (a completed evidence stage never re-runs automatically, ADR-039) |
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
