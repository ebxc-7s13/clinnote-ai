# ClinNote AI — Build Plan

This document defines implementation order. Phases are executed in sequence. A phase is complete only when its exit criteria are met and `PROJECT-STATUS.md` is updated.

## Cross-Phase Rules

These apply to every phase, not only to the phase where they are listed:

- **Tests accompany features.** Every phase writes the unit/integration tests for what it builds (`TESTING.md`). Phase 13 is a hardening and coverage phase, not the first time tests are written.
- **Security and privacy baseline from day one.** Secret scanning, `.gitignore` for `.env`/keys/recordings, and the no-clinical-data-in-logs rule apply from Phase 1. Phase 12 is a dedicated review, not the first time security is considered.
- **Synthetic data only.**
- **No model weight downloads.**
- **Verify before implementing.** Any provider item marked `VERIFY BEFORE IMPLEMENTATION` in `API_CATALOG.md` is verified at the start of the phase that uses it.
- **Open decisions.** A phase that depends on an OPEN DECISION in `DECISIONS.md` cannot complete until that decision is made.

## Phase 0 — Documentation

Create and review:

- product specification
- architecture
- data model
- API catalog
- speech architecture
- AI architecture
- evidence-source architecture
- privacy
- security
- clinical safety
- UI/UX
- testing
- deployment
- Google Play requirements

STATUS:

DOCUMENTATION INITIALIZATION

Exit criteria:

- all documents exist with complete content
- documentation consistency audit performed and contradictions fixed
- open decisions recorded in `DECISIONS.md`

## Phase 1 — Repository and Development Foundation

Tasks:

1. inspect environment
2. create Expo application (TypeScript template, current SDK at implementation time)
3. configure TypeScript (strict mode)
4. configure linting
5. configure formatting
6. configure testing
7. configure development environment
8. configure GitHub workflow (lint, typecheck, test, secret scanning)
9. add `.gitignore` and `.env.example` containing variable names only, no values

Exit criteria: CI passes on an empty app shell; secret scanning active.

## Phase 2 — Mobile Application Shell

Tasks:

1. navigation
2. theme
3. design system
4. Home
5. Patients
6. Visits
7. Settings

Exit criteria: navigation and accessibility basics tested (`UI-UX.md`).

## Phase 3 — Patient and Encounter Storage

Tasks:

1. local database
2. patient model
3. encounter (visit) model
4. symptom model
5. medication model
6. allergy model
7. investigation model
8. follow-up model
9. note and note-version model
10. timeline model
11. provenance, information state and review status
12. consent record and audit event model

Depends on: OD-003 (local storage encryption) must be resolved before Phase 14 production build; the schema can proceed before then.

Exit criteria: all `DATA_MODEL.md` entities persisted with schema tests.

## Phase 4 — Manual Clinical Workflow

Tasks:

1. create patient
2. search patient
3. create visit
4. manually enter notes
5. edit notes
6. save notes
7. export notes (with export warning, `SECURITY.md`)
8. delete patient / visit / note

Exit criteria: full manual workflow works offline.

## Phase 5 — Recording

Tasks:

1. microphone permission
2. consent
3. recording state
4. pause/resume
5. stop
6. recovery
7. temporary audio handling

Exit criteria: recording cannot start without a consent record; temporary audio deletion tested.

## Phase 6 — Speech

Tasks:

1. SpeechProvider interface
2. backend short-lived token / proxy endpoint (`ARCHITECTURE.md` Section 4)
3. primary cloud provider
4. streaming transcription
5. speaker diarization
6. speaker mapping
7. final transcript
8. provider fallback

Do not download model weights.

Depends on: OD-001 (primary speech provider), OD-004 (backend authentication).

## Phase 7 — Clinical Information Extraction

Tasks:

1. transcript normalization
2. fact extraction
3. symptom extraction
4. medication extraction
5. allergy extraction
6. history extraction
7. vital extraction
8. investigation extraction
9. assessment extraction
10. plan extraction
11. follow-up extraction
12. provenance

Phases 7 and 8 are built together: Phase 8 provides the LLM infrastructure, Phase 7 the clinical extraction modules and their deterministic post-processing (negation, numerical preservation). Implement the Phase 8 interface first.

## Phase 8 — AI Layer

Tasks:

1. LLM interface
2. structured output
3. schema validation
4. prompt modules
5. clinical extraction
6. note generation
7. visit comparison
8. patient explanation

Depends on: OD-002 (primary LLM model).

## Phase 9 — Evidence Layer

Tasks:

1. evidence interface
2. PubMed
3. Europe PMC
4. FDA/openFDA
5. Drugs@FDA
6. DailyMed
7. RxNorm
8. MedlinePlus
9. ClinicalTrials.gov
10. NLM Clinical Tables
11. PubChem
12. WHO
13. NCI

Only integrate services that are verified and appropriate.

Recommended order within the phase: RxNorm → DailyMed → openFDA → PubMed → MedlinePlus → Europe PMC → ClinicalTrials.gov → Clinical Tables → PubChem → WHO → NCI. Medication normalization is needed by the medication evidence path; PubMed is needed by the literature path.

## Phase 10 — Clinical Review

Tasks:

1. possibility generation
2. supporting facts
3. contradicting facts
4. missing information
5. citations
6. evidence cards
7. source tracing
8. clinician confirmation

## Phase 11 — Longitudinal Memory

Tasks:

1. visit timeline
2. medication timeline
3. symptom timeline
4. investigation timeline
5. previous/current comparison
6. unresolved items
7. follow-up

## Phase 12 — Security and Privacy

Tasks:

1. secret management
2. local storage security
3. logging review
4. analytics review
5. crash reporting review
6. API security
7. rate limiting
8. prompt injection defense
9. sensitive-data review
10. third-party provider data-flow table (`PRIVACY.md`)

## Phase 13 — Testing

Tasks:

1. unit tests
2. schema tests
3. integration tests
4. API tests
5. clinical safety tests
6. privacy tests
7. security tests
8. UI tests
9. end-to-end tests
10. offline tests

Exit criteria: all 20 synthetic test cases and all critical clinical tests in `TESTING.md` pass.

## Phase 14 — Android

Tasks:

1. development build
2. preview build
3. device testing
4. release signing
5. production AAB

## Phase 15 — Google Play

Tasks:

1. store listing
2. privacy policy
3. health-app declaration
4. data-safety review
5. permissions review
6. testing track
7. production release preparation

Depends on: OD-005 (target jurisdictions and regulatory classification), OD-006 (data retention), OD-010 (license).
