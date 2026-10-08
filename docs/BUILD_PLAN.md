# ClinNote AI — Build Plan

This is the master sequential implementation plan. Execute phases in order. Within a phase, execute tasks in numbered order unless a task says otherwise.

---

## Cross-Phase Rules

These apply to every phase:

1. **Read first.** Before starting a phase, read every document listed in its Inputs.
2. **Tests accompany features.** Each phase writes the tests listed under Tests. Phase 21 is consolidation and coverage, not the first time tests are written.
3. **Security and privacy baseline from Phase 1.** `.gitignore`, secret scanning and the no-clinical-data-in-logs rule apply from the first commit. Phases 19–20 are dedicated reviews.
4. **Synthetic data only** (ADR-006).
5. **No model weights** (ADR-003).
6. **Verify providers** marked `VERIFY BEFORE IMPLEMENTATION` in `API_CATALOG.md` at the start of the phase that uses them, and record the verification.
7. **Open decisions** (`DECISIONS.md`) listed under Dependencies must be resolved before the phase can be marked complete. If unresolved, mark the phase BLOCKED in `PROJECT-STATUS.md` and continue with the next phase that does not depend on it.
8. **AI completion gate.** No phase that delivers AI jobs or AI-adjacent safety logic (10, 11, 12, 13, 15) completes until the safety test corpus (Phase 6, `TESTING.md` §13a) exists and the applicable CS parts pass, with Gate 6 PASS (ADR-024, ADR-040, `AI.md` §15). In every phase, the CS parts to run are those listed for that phase in `CLINICAL-SAFETY.md` §18a, plus all earlier ones.
9. **Regulatory gate.** R2 functionality (possibilities to review; the patient-friendly explanation) is built behind `possibilitiesEnabled` and `patientExplanationEnabled` (default OFF; when OFF, jobs 12, 13 and 16 are not executed and the backend refuses them, ADR-034, ADR-041, ADR-042). It is not released before the formal assessment, and R3 functionality is prohibited (ADR-025).
10. **Completion** requires: completion criteria met, tests passing, `PROJECT-STATUS.md` updated, `BUILD_REPORT.md` rewritten from actual state, work committed.
11. **Contract first.** An implementation task starts only when the specification it implements exists and every Integration Contract it produces or consumes (`INTEGRATION-CONTRACTS.md`) is at least ACKNOWLEDGED by its affected agents. If not, the task is BLOCKED.

## Phase Overview

| Phase | Name | Key open-decision dependencies |
|---|---|---|
| 0 | Documentation | — |
| 1 | Repository Foundation | — |
| 2 | Expo and Android Foundation | — |
| 3 | UI System | — |
| 4 | Local Database | — (OD-003 resolved for planning, ADR-031; re-verify) |
| 5 | Patient System | — |
| 6 | Visit System (+ safety test corpus, ADR-024) | — |
| 7 | Recording (+ backend foundation 7B, ADR-026) | — (OD-004 resolved for planning, ADR-032) |
| 8 | Speech | OD-001, OD-007 |
| 9 | Speaker Diarization | OD-001 |
| 10 | Clinical Extraction | OD-002 |
| 11 | Medication Intelligence (+ evidence foundation) | OD-011 (target markets) |
| 12 | Evidence Engine | — (no images in V1, ADR-029) |
| 13 | AI Reasoning | OD-002; R2 flag default OFF (ADR-025) |
| 14 | Clinical Review | R2 release requires formal regulatory assessment (ADR-025) |
| 15 | Note Generation | OD-002 |
| 16 | Longitudinal Memory | — |
| 17 | Follow-Up | — |
| 18 | Export | — |
| 19 | Security | — (OD-003/OD-009 resolved; verify) |
| 20 | Privacy | OD-006 |
| 21 | Testing | — |
| 22 | Performance | — |
| 23 | Android Build | OD-003 |
| 24 | Google Play | ADR-025 formal assessment, OD-006, OD-010, OD-011 |
| 25 | Final Release Audit | all |

---

## PHASE 0 — DOCUMENTATION

**Purpose:** Establish complete, consistent product, architecture, safety, privacy, security, testing and release documentation before any code.

**Tasks:**
1. Create `CLAUDE.md`, `README.md` and the 18 documents in `docs/`.
2. Record ADRs and open decisions in `DECISIONS.md`.
3. Perform the cross-document consistency audit and fix contradictions.
4. Verify file existence, content, placeholders and secrets from the filesystem.
5. Write `BUILD_REPORT.md` from actual state and commit.

**Inputs:** Project brief.

**Outputs:** 20 Markdown files; one documentation commit.

**Dependencies:** None.

**Tests:** Documentation consistency checks (`TESTING.md` §14).

**Completion criteria:** All 20 files exist in the correct paths, are non-empty, contain no unqualified placeholders or secrets, every ADR/OD reference resolves, and the audit is recorded.

**Potential blockers:** None.

## PHASE 1 — REPOSITORY FOUNDATION

**Purpose:** Prepare the repository for safe collaborative development.

**Tasks:**
1. Inspect environment (Node.js version, git, Codespaces configuration).
2. Add `.gitignore` covering `.env*` (except `.env.example`), keystores, `*.jks`, `*.keystore`, `*.pem`, recordings (`*.wav`, `*.m4a`, `*.mp3`, `*.webm`), build outputs, `node_modules`.
3. Add `.env.example` with variable names only (from `API_CATALOG.md` §30).
4. Add `.editorconfig`.
5. Add GitHub Actions workflow skeleton: secret scanning step (e.g. gitleaks or equivalent — verify current tool) on every push and pull request.
6. Add pull-request template with checklist: tests, no secrets, no patient data, docs updated.
7. Add `.devcontainer` configuration for Codespaces if needed (Node LTS only; no GPU, no Python ML stack).
8. Record Node version policy in `DEPLOYMENT.md`.

**Inputs:** `CLAUDE.md`, `SECURITY.md`, `DEPLOYMENT.md`.

**Outputs:** Repository configuration files; CI with secret scanning.

**Dependencies:** Phase 0.

**Tests:** CI runs on a test branch; a deliberately fake secret pattern in a throwaway branch is detected (then the branch is deleted).

**Completion criteria:** CI secret scan passes on `main`; `.gitignore` verified to exclude `.env`.

**Potential blockers:** GitHub Actions disabled on the repository; secret-scanning tool licensing.

## PHASE 2 — EXPO AND ANDROID FOUNDATION

**Purpose:** Create the React Native + Expo TypeScript application shell that builds and runs on Android (ADR-011).

**Tasks:**
1. Verify current Expo SDK and React Native versions in official Expo documentation.
2. Create the Expo app with the TypeScript template at the repository root (or `app/` — record the choice in `DECISIONS.md`).
3. Enable TypeScript strict mode.
4. Configure ESLint and Prettier; add scripts `lint`, `typecheck`, `format:check`, `test`.
5. Configure Jest (or the test runner recommended by current Expo docs) with React Native Testing Library.
6. Create folder structure per `ARCHITECTURE.md` §4 (`src/presentation`, `src/domain`, `src/application`, `src/infrastructure`, `src/providers`).
7. Set Android package name, app name, minimal permissions (none yet).
8. Configure `eas.json` profiles: development, preview, production (no secrets).
9. Extend CI: lint, typecheck, unit tests.
10. Produce a development build or run in an Android emulator/Expo Go equivalent to confirm launch.

**Inputs:** `ARCHITECTURE.md`, `DEPLOYMENT.md`, `TESTING.md`.

**Outputs:** Buildable Expo application; CI quality gates.

**Dependencies:** Phase 1.

**Tests:** App renders root component (unit); CI green.

**Completion criteria:** `lint`, `typecheck`, `test` pass locally and in CI; app launches on Android.

**Potential blockers:** Expo account needed for EAS builds (project owner action); emulator unavailable in Codespaces (use EAS development build or physical device).

## PHASE 3 — UI SYSTEM

**Purpose:** Build the design system and navigation shell for a calm, accessible clinical tool (`UI-UX.md`).

**Tasks:**
1. Define design tokens: color (light/dark, WCAG AA contrast), typography scale supporting font scaling, spacing, radii.
2. Build base components: Button, TextField, Card, ListItem, Banner (info/warning/error), StatusBadge (text + icon), EmptyState, LoadingState, ErrorState, ConfirmDialog, SectionHeader.
3. Build clinical components: ProvenanceTag, InformationStateLabel, ReviewStatusBadge, RecordingIndicator.
4. Implement navigation: tabs Home / Patients / Visits / Settings plus stack screens listed in `UI-UX.md`.
5. Create screen shells for all 21 screens (UI-UX §3, including Visits) with real empty, loading and error states.
6. Accessibility: labels, roles, minimum touch targets, focus order.
7. Onboarding acknowledgement and processing disclosure (FR-27.x); Settings cloud-processing toggle persisted in AppSettings (FR-28.x, default OFF until acknowledged).

**Inputs:** `UI-UX.md`, `CLINICAL-SAFETY.md` (labels for states).

**Outputs:** Component library; navigable shell.

**Dependencies:** Phase 2.

**Tests:** Component unit tests; accessibility label tests; navigation tests.

**Completion criteria:** All screens reachable; every component has an accessibility label test; no color-only meaning.

**Potential blockers:** None expected.

## PHASE 4 — LOCAL DATABASE

**Purpose:** Implement the on-device Local Clinical Store (ADR-005, ADR-013).

**Tasks:**
1. Re-verify the expo-sqlite SQLCipher (`useSQLCipher`) and expo-secure-store APIs in the official docs. Implement the encrypted database with a Keystore-backed random key (ADR-031). Development uses EAS development builds, not Expo Go.
2. Implement the schema for every entity in `DATA_MODEL.md` (24 entities, including FactConflict, ProblemListEntry, ProfileUpdateProposal and AppSettings), with foreign keys and indexes. Include originProvenance/provenance, derivation, clarification and supersession fields.
3. Implement migration mechanism (versioned, forward-only).
4. Implement repositories (one per aggregate) behind a `StorageProvider` interface.
5. Implement enum validation, state-machine guards (DATA_MODEL §5, including §5.7 conflicts and §5.8 proposals) and validation rules §6 (actor rules, provenance/derivation pairs) at the repository boundary.
6. Implement AuditEvent writing for create/update/confirm/delete.
7. Implement cascading delete for patient deletion.
8. Implement synthetic seed data generator (development builds only, clearly fictional).
9. Implement the deterministic conflict detector (DATA_MODEL §9) and derived views (§10: active problems, current medications, allergy status), with unit tests. Both use only facts eligible for automatic input (§3.3a: current and not flagged SOURCE_CHANGED, ADR-043).

**Inputs:** `DATA_MODEL.md`, `SECURITY.md`, `PRIVACY.md`.

**Outputs:** Database layer with repositories and migrations.

**Dependencies:** Phase 2. Encryption (ADR-031) is enabled in this phase, before any build is distributed.

**Tests:**
- schema tests
- repository CRUD tests
- invalid enum rejection
- illegal state transition rejection (actor rules)
- provenance/derivation validation
- conflict detector cases (CS-14 A, CS-27 A, CS-28 A; eligible facts only, ADR-038, ADR-043)
- derived views (CS-12 A, CS-41 A, CS-42 A: allergy status lines, all-visit "Proposed — needs review")
- cascade delete
- migration up from empty
- database file unreadable without the key

**Completion criteria:** All entities persist and reload; validation tests pass.

**Potential blockers:** SQLCipher behavior on target devices (measure; fallback requires an ADR).

## PHASE 5 — PATIENT SYSTEM

**Purpose:** Create, search, view, edit and delete patients (Features 1, 2, 9).

**Tasks:**
1. Patient creation flow with auto reference generation.
2. Optional identity fields.
3. Patient list and local search.
4. Patient Overview screen with sections and the allergy status lines of `DATA_MODEL.md` §10.3 ("Not discussed" only when no allergy fact exists).
5. Edit patient.
6. Delete patient with confirmation and cascade.

**Inputs:** `PRODUCT_SPEC.md` Features 1, 2, 9; `UI-UX.md` screens 3, 4, 17.

**Outputs:** Patient feature.

**Dependencies:** Phases 3, 4.

**Tests:** Unit (reference generation, validation); UI (create, search, edit, delete); offline.

**Completion criteria:** FR-1.x, FR-2.x, FR-9.1, FR-9.3 (all five allergy display states, DATA_MODEL §10.3) and FR-9.4 (derived views) pass tests.

**Potential blockers:** None.

## PHASE 6 — VISIT SYSTEM

**Purpose:** Create visits, record consent, and support a fully manual visit including manual note entry (Features 3, 4; manual path of 21–23).

**Tasks:**
1. Start Visit screen (select patient, note type).
2. Consent screen and ConsentRecord creation (CONFIRMED / DECLINED).
3. Manual fact entry (symptom, medication, allergy, investigation, assessment, plan, follow-up, problem-list entries): originProvenance = provenance = CLINICIAN_CONFIRMED, derivation MANUAL_ENTRY, status CONFIRMED. Manual vitals entry → MEASURED (ADR-021).
4. Manual note editor with NoteVersion history (MANUAL_DRAFT, CLINICIAN_EDIT).
5. Finalize note (clinician action).
6. Visit list and visit detail.
7. Delete visit.
8. **Safety test corpus (ADR-024; owners: clinical-safety-engineer + qa-test-engineer; separate files from the visit feature):**
   - synthetic scenario transcripts S1–S24 with expected structured outputs
   - the CS-01…CS-46 harness (including CS-16a), runnable against mock providers
   - fake-citation, fake-PMID and fake-FDA fixtures
   - harness self-tests
   - see `TESTING.md` §13a

**Inputs:** `PRODUCT_SPEC.md` Features 3, 4, 21–23; `DATA_MODEL.md`.

**Outputs:** Manual clinical workflow end to end.

**Dependencies:** Phase 5.

**Tests:**
- visit state machine
- consent gating
- note versioning
- CS-25 (finalize ≠ confirm) on the manual path
- offline manual visit E2E
- safety corpus harness self-tests

**Completion criteria:**
- A synthetic manual visit can be created, documented, finalized, reopened and deleted offline.
- The safety test corpus exists and its harness self-tests pass in CI.

**Potential blockers:** None.

## PHASE 7 — RECORDING

**Purpose:** Capture audio safely after consent (Feature 5; `SPEECH.md`).

**Tasks:**
1. Verify current Expo audio recording API and Android background/foreground-service requirements; record approach as an ADR.
2. Request RECORD_AUDIO with rationale.
3. Consent gate: block recording without CONFIRMED ConsentRecord.
4. Recording controller state machine (NOT_STARTED → RECORDING ⇄ PAUSED → STOPPED / FAILED).
5. Live Recording screen with RecordingIndicator and timer.
6. Interruption handling (call, background, device change).
7. Temporary audio storage in app-private directory with 24-hour maximum retention and deletion job (ADR-014).
8. Consent withdrawal handling.
9. Recording requires `cloudProcessingEnabled` (FR-28.2). If it is off, the app explains why and offers manual mode.

**Task group 7B — Backend foundation (backend-api-engineer, parallel; ADR-026):**
10. Verify the Supabase Edge Functions and Supabase Auth docs. Create the backend project.
11. Clinician sign-in (ADR-032), JWT verification on every function, per-user rate limits and quotas. App side (mobile-android-engineer): sign-in/out in Settings and the signed-out state "Sign in to use cloud processing" (FR-28.4, FR-28.5).
12. Request/response validation framework, routing configuration with the ADR-042 schema (IC-015), ProviderExecution transport (IC-013), unauthenticated `/health` returning only `{status, version}`, authenticated `/config` serving the R2 flags (IC-019a), authenticated mock provider route disabled in production, non-clinical rate-limit counters (ADR-042).

**Inputs:** `SPEECH.md`, `PRIVACY.md`, `GOOGLE-PLAY.md` (permissions).

**Outputs:** Recording feature producing temporary audio chunks.

**Dependencies:** Phase 6.

**Tests:**
- recording: state machine, consent gate, cloud-processing gate, permission denial, interruption, temporary audio deletion after processing, discard and 24 hours
- 7B backend: unauthenticated requests rejected, oversized/malformed requests rejected, rate limit, no body logging

**Completion criteria:**
- Recording cannot start without consent and cloud processing enabled.
- Audio files are deleted per policy in tests.
- The backend foundation passes its auth and validation tests.

**Potential blockers:** Foreground-service policy constraints.

## PHASE 8 — SPEECH

**Purpose:** Live and final transcription through a provider-agnostic SpeechProvider.

**Tasks:**
1. Owner resolves OD-007 (languages). Then evaluate the candidates with synthetic audio, and the owner resolves OD-001 (provider).
2. Verify the chosen provider in `API_CATALOG.md`.
3. (removed: OD-004 resolved for planning, ADR-032)
4. Add the speech token / audio proxy endpoint to the Phase 7B backend.
5. Implement `SpeechProvider` interface and the primary adapter; implement a mock adapter for tests.
6. Live transcript UI with low-confidence marking.
7. Final transcript pass after stop.
8. Fallback provider adapter (if selected) and failure handling: network loss, timeouts, empty transcript.
9. Transcript editing with audit.
10. ProviderExecution recording (no content).

**Inputs:** `SPEECH.md`, `API_CATALOG.md`, `ARCHITECTURE.md`, `SECURITY.md`.

**Outputs:** Transcription working end to end with synthetic audio.

**Dependencies:** Phase 7 (including 7B); OD-001, OD-007.

**Tests:** Adapter contract tests (mock); backend validation and auth tests; failure-mode tests; no key in app bundle.

**Completion criteria:** Synthetic consultation transcribed live and finally; provider failure preserves transcript.

**Potential blockers:** Provider account/key creation (project owner); provider terms unsuitable for health data.

## PHASE 9 — SPEAKER DIARIZATION

**Purpose:** Separate speakers and map them to roles (Feature 7).

**Tasks:**
1. Implement `DiarizationProvider` (may be the same adapter as speech).
2. Map anonymous speakers to segments.
3. Role-mapping heuristic proposal (e.g. question-asking pattern) — deterministic code first; AI only if needed and documented.
4. Speaker mapping confirmation UI.
5. Provenance rule (ADR-021): extraction is blocked until the speaker mapping is confirmed. UNKNOWN or OTHER role → TRANSCRIPTION. Never PATIENT_REPORTED or CLINICIAN_STATED without a confirmed PATIENT or DOCTOR role.

**Inputs:** `SPEECH.md`, `CLINICAL-SAFETY.md`.

**Outputs:** Role-labeled final transcript.

**Dependencies:** Phase 8.

**Tests:** Multi-speaker synthetic scenario; mapping confirmation blocks extraction until COMPLETED; UNKNOWN/OTHER role mapping at segment level. (Provenance assertions, including re-derivation after a correction, run in Phase 10 once facts exist: CS-15.)

**Completion criteria:** Scenario S10 passes (`TESTING.md`).

**Potential blockers:** Provider diarization quality.

## PHASE 10 — CLINICAL EXTRACTION

**Purpose:** Extract structured clinical facts with provenance (Features 8, 10–16) using the LLM layer.

**Tasks:**
1. Resolve OD-002 and verify the provider.
2. Implement `LLMProvider` interface, backend LLM endpoint, mock adapter.
3. Implement structured-output pipeline: schema validation → semantic validation → retry once → fallback (`AI.md`).
4. Implement AI jobs 1–10 (`AI.md` §3) as separate, versioned prompt modules.
5. Implement deterministic post-processors: negation check, number preservation check, segment reference check, value grounding for every extraction text field and the deterministic context check (negation, hedge, hypothetical, experiencer) (`AI.md` §5.1 rules 17 and 19, with code-maintained stopword and inferential-wording lists), and the code-owned conceptKey normalization table applied to the fact's own value (rule 16; no table entry → UNMAPPED, ADR-043, ADR-044).
6. Deterministic promotion to PROVISIONAL facts, with provenance and rootOriginProvenance assigned by code (DATA_MODEL §8.3). Wire in the conflict detector (including earlier-visit PROVISIONAL facts, ADR-035). Produce ProfileUpdateProposals (job 10).
6a. Correction handling after a transcript or speaker-role correction (DATA_MODEL §3.2 rule 8, ADR-038, ADR-043): role-only recompute keeping derivation, recomputing sourceSpeakerRole and resetting the root origin; text or category-invalidating corrections → SOURCE_CHANGED (ineligible for automatic input) + re-extraction of every segment the affected facts cite; matching by category + conceptKey; an unmatched flagged fact stays flagged until the clinician acts.
7. Clinical Facts screen with confirm / reject / edit.

**Inputs:** `AI.md`, `CLINICAL-SAFETY.md`, `DATA_MODEL.md`.

**Outputs:** Extraction pipeline.

**Dependencies:** Phase 9; OD-002.

**Tests:**
- all critical clinical tests (`TESTING.md` §6)
- the Phase 10 CS parts in `CLINICAL-SAFETY.md` §18a (extraction-level parts of CS-01…CS-10, CS-12–CS-15, CS-19 A, CS-21 A, CS-23, CS-26–CS-29, CS-31, CS-34–CS-36, CS-39, CS-40), against the Phase 6 corpus (CS-11 needs RxNorm candidates and runs in Phase 11)
- correction handling: role-only recompute vs re-extraction (ADR-038, ADR-043)
- conceptKey from the fact's own value: CS-38 A (`{value: "night sweats", conceptKey: "lung cancer"}` → "night sweats" or UNMAPPED, including when "lung cancer" appears negated in the same segment)
- value grounding: CS-18 C and CS-19 C (ungrounded or inferential wording in a job-2 value is rejected, ADR-044)
- context check: CS-46 A (hypothetical and other-person statements never become eligible POSITIVE patient facts; grounded ones are kept flagged CONTEXT_UNCLEAR, ADR-044 decision 5, ADR-045)
- visible discards: rejected items are listed "Not extracted — check transcript" (ADR-045)
- AI evaluation set
- prompt-injection test

**Completion criteria:** All extraction-related safety tests pass with the mock and with the real provider on synthetic data. Gate 6 PASS (AI completion gate).

**Potential blockers:** Model unable to meet safety tests reliably → stage remains advisory; record in DECISIONS.

## PHASE 11 — MEDICATION INTELLIGENCE

**Purpose:** Normalize medications and attach authoritative information (Feature 11).

**Tasks:**
1. Verify RxNorm, DailyMed and openFDA (drug label, NDC, Drugs@FDA) in `API_CATALOG.md`.
1a. **Evidence foundation (moved from Phase 12; F-01, F-02):**
   - freeze IC-010
   - EvidenceSource persistence (on-device cache, ADR-028)
   - adapter response-schema validation and the identifier-origin check (CS-17)
   - the on-device query sanitizer, with tests that no patient identifiers are sent and that disease names containing places ("Lyme disease", "West Nile virus") are not rejected (F-03, ADR-036, ADR-043 decision 8)
2. Implement `MedicationProvider` (RxNorm): normalization from sanitized drug terms, with a candidate list.
3. Ambiguity UI: show candidates; clinician selects.
4. Label retrieval (DailyMed / openFDA label) as validated EvidenceSources, looked up by the typed RxCUI/set ID from the validated RxNorm/DailyMed response (ADR-036) — only for a single exact RxNorm match or a clinician-selected RxCUI, never an approximate match (ADR-039). These are only displayed after 1a validation passes. Every FDA and DailyMed record is labeled "U.S. regulatory information", and RxNorm normalizations "U.S. drug terminology (RxNorm)" (ADR-036).
5. Medication Information screen.
6. Medication status rules (no auto-DISCONTINUED).

**Inputs:** `API_CATALOG.md`, `EVIDENCE-SOURCES.md`, `CLINICAL-SAFETY.md`.

**Outputs:** Medication normalization and information.

**Dependencies:** Phase 10; OD-011 (target markets) answered by the owner.

**Tests:**
- normalization adapter tests (recorded fixtures of public, non-patient responses)
- ambiguity and the label-lookup gate (CS-11)
- no patient identifiers sent; typed public identifiers only from validated responses (ADR-036; FR-17.1)
- takingStatus rule (CS-12, CS-13)
- fake FDA response rejection (CS-17)
- sanitizer: no rawName, transcript text or patient identifiers sent
- no dose suggestions

**Completion criteria:** Scenarios S5, S8, S19 pass. Gate 6 PASS for CS-11, CS-12, CS-13, CS-17 (AI-adjacent safety logic, `AI.md` §15).

**Potential blockers:** RxNorm coverage of non-US brand names (OD-011, F-04). For non-US products, normalization shows "no US reference match" and keeps the raw name; no forced match.

## PHASE 12 — EVIDENCE ENGINE

**Purpose:** Retrieve, store and display source-linked evidence (Features 17, 19).

**Tasks:**
1. Verify each provider before integrating (order: PubMed → MedlinePlus → Europe PMC → ClinicalTrials.gov → NLM Clinical Tables → PubChem → WHO → NCI).
2. Implement the backend adapters: `EvidenceProvider` (including openFDA adverse events, enforcement and shortages), `LiteratureProvider`, `HealthInformationProvider`, `ClinicalTrialProvider`, `TerminologyProvider`, `ChemicalProvider`, `PublicHealthProvider` and NCI (F-13). The routing table is complete (API_CATALOG §29). Orange Book is not integrated.
3. Evidence query generation (job 11) as **deterministic code** from **facts only** (ADR-023, ADR-039): concepts are the code-computed conceptKeys of the facts that `DATA_MODEL.md` §4.15 admits (eligible, POSITIVE/UNKNOWN, not UNMAPPED, not in an OPEN conflict, not HISTORY_FAMILY/HISTORY_SOCIAL, not AI_EXTRACTED unless CONFIRMED; ADR-043), routes from the code-owned route table, CANCER_INFO only from a HISTORY_MEDICAL or ASSESSMENT fact in the cancer concept list, no AUTOMATIC trial/chemical/public-health route (code constant on device and backend; configuration can only restrict, with a load-time test, ADR-043). Sanitized on the device on every path, including manual search and autocomplete (ADR-036). Cards show "Retrieved for: <concept> (<state>)" or "Clinician search".
4. Deduplication (the record from the primary route wins), then per-record tier and group assignment, deterministic ranking and the per-group cap, in that order (EVIDENCE-SOURCES §2, §14, §15; ADR-036).
4a. Visit-scoped cache (copies with `cachedFromEvidenceId`), always-refetch for REGULATORY_SAFETY, 30-day refetch for other regulatory records, evidence-staleness marker, citable-bundle rule and the clinician "Re-run evidence search" action (ADR-039).
5. On-device caching and freshness marking (EVIDENCE-SOURCES §16).
6. Evidence screen and evidence cards.
7. Manual evidence search.
8. Extend Phase 11 identifier validation to all adapters.
9. Reference images: **not in V1** (ADR-029). Evidence cards link out only.

**Inputs:** `EVIDENCE-SOURCES.md`, `API_CATALOG.md`.

**Outputs:** Evidence retrieval.

**Dependencies:** Phases 10, 11.

**Tests:**
- adapter contract tests
- fake PMID in a provider response rejected (CS-16a)
- fake FDA response handling (CS-17)
- no-results path (S16)
- ranking and dedup unit tests
- cache freshness uses the original `retrievedAt`
- no patient identifiers in queries; public identifiers only as typed fields from validated responses (ADR-036)
- CS-16a, CS-30 A, CS-33 A, CS-38 (`CLINICAL-SAFETY.md` §18a)
- visit-scoped cache never links a bundle to another visit's query; recalls always refetched
- S17a: source disagreement displayed on the evidence screen (deterministic; label rule (b) only for structural differences, at most 3 most-recent SPLs per RxCUI, and a negative fixture where two labels differ only in wording shows no marker, ADR-043 decision 6)
- FR-17.8 UNMAPPED notice: only for facts excluded solely by UNMAPPED in a routed category; pre-filled manual search is not sent until submit; sanitizer tests: a pre-fill containing a date → rejected with a reason, "Lyme disease" → accepted
- CS-38 B (concept grounding, family history, CANCER_INFO restriction) and the route-table load-time test (no configuration can make TRIALS/CHEMICAL/PUBLIC_HEALTH automatic)
- no reference images rendered (CS-30)

**Completion criteria:** S16 and S17a pass. Adapter identifier validation passes for all providers. Gate 6 PASS (job 11 and evidence safety; `AI.md` §15). Synthesis-based tests (CS-16, S17b) belong to Phase 13 (ADR-023).

**Potential blockers:** Provider terms or rate limits.

## PHASE 13 — AI REASONING

**Purpose:** Generate possibilities to review, evidence synthesis and visit comparison (AI jobs 12–14).

**Tasks:**
1. Clinical candidate generation (job 12), grounded in facts plus the stored evidence bundle. Supporting, contradicting and missing information reference fact IDs under the information-state rules, and evidenceIds must be a subset of the citable bundle. Built behind `possibilitiesEnabled`, default OFF (R2, ADR-025). Stage gating per ADR-034: flag OFF, evidence not COMPLETED/PARTIAL, or an empty citable bundle (`DATA_MODEL.md` §5.2) → candidate stage SKIPPED with a reason; jobs 12–13 not called.
1a. Candidate staleness ("Outdated — facts changed since generation", including a newly detected conflict), the confirm guard (no confirmation of outdated or superseded-run candidates), clinician-triggered regeneration that keeps earlier runs, SKIPPED re-entry after a successful "Re-run evidence search", and neutral alphabetical ordering (ADR-034, ADR-038, ADR-039).
2. Evidence synthesis (job 13), referencing evidence IDs only. Disagreements are stated.
3. Visit comparison over structured facts (deterministic diff first; AI for wording only).
4. Patient-friendly explanation (AI job 16), **R2 behind `patientExplanationEnabled`, default OFF** (ADR-041), labeled for clinician review; citations by evidence ID within the bundle only (CS-16 part B); no-advice validator (CS-44).
5. Semantic validators for each job (including validators 11, 14 and 15, `AI.md` §5.1).
6. Server-side enforcement: the backend refuses jobs 12, 13 and 16 with FEATURE_DISABLED when the flags are OFF (ADR-042, IC-019a).

**Inputs:** `AI.md`, `CLINICAL-SAFETY.md`.

**Outputs:** Reasoning jobs.

**Dependencies:** Phase 12; OD-002. R2 release is gated by ADR-025.

**Tests:**
- CS-16 (hallucinated citation in candidate, synthesis or job 16)
- S17b (synthesis states evidence disagreement)
- the Phase 13 CS parts in `CLINICAL-SAFETY.md` §18a: CS-07 B, CS-16 A and B, CS-18 A, CS-22, CS-24 A, CS-30 B, CS-33 B, CS-37 A, CS-43 A, CS-44
- no unreferenced fact or evidence IDs
- the flags default OFF in release builds; jobs 12, 13 and 16 are not called when OFF, and the backend refuses them

**Completion criteria:** Reasoning safety tests pass. Gate 6 PASS (AI completion gate).

**Potential blockers:** Model reliability.

## PHASE 14 — CLINICAL REVIEW

**Purpose:** The clinician review workspace (Features 18, 22, 23).

**Tasks:**
1. Clinical Review screen: FACTS · EVIDENCE · POSSIBILITIES TO REVIEW · NOTE sections, in pipeline order (UI-UX Screen 11).
2. Transparency actions: Why did this appear? / Source / View transcript / View evidence / Dismiss / Confirm.
3. Conflict display.
4. Confirmation flows updating status and provenance with audit (ADR-021).
5. Conflict resolution UI (DATA_MODEL §5.7) and profile update proposal accept/reject (§5.8).
6. The POSSIBILITIES TO REVIEW section renders only when `possibilitiesEnabled` is ON (development/preview with synthetic data). Otherwise the section is hidden. When ON, it shows the SKIPPED reason, outdated markers and the Regenerate action (ADR-034).

**Inputs:** `UI-UX.md` screens 10–12, `CLINICAL-SAFETY.md`.

**Outputs:** Review workspace.

**Dependencies:** Phase 13. R2 functionality may be implemented but not released before the formal regulatory assessment (ADR-025).

**Tests:** Confirmation audit; conflicts shown; AI items always marked provisional; root origin shown after edits; Phase 14 CS parts (CS-14 C, CS-28 C, CS-37 B, CS-43 B); flag-ON E2E with synthetic data (development build).

**Completion criteria:** Success criteria 5, 6 (R1 evidence review) and 8 (`PRODUCT_SPEC.md` §12) pass in E2E in the release configuration. The R2 flag-ON review flow passes in a development build. Criterion 7 (edit the generated note) is completed in Phase 15 (F-05).

**Potential blockers:** Formal regulatory assessment outcome (affects release only).

## PHASE 15 — NOTE GENERATION

**Purpose:** AI-drafted notes with editing and finalization (Feature 21).

**Tasks:**
1. Note generation job (AI job 15) per note type, from facts eligible for automatic input, OPEN conflicts and CONFIRMED assessments only; never from ClinicalCandidates (ADR-034). The job returns statement selection only (`{section, order, sourceFactIds | conflictId | notDiscussed}`, no free text); validator rule 13 checks it, and code renders each statement from the referenced facts with fixed templates (ADR-040, ADR-043). Regenerate draft keeps earlier versions.
2. Rendering rules for NOT_DISCUSSED: code decides; a `notDiscussed` marker is accepted only when the topic has no fact and no rejected item, else "<topic>: see transcript — needs review" (ADR-045, CS-04 D).
3. Note Editor integration with AI_DRAFT versions.
4. Number and negation checks between facts and note text.
5. "AI draft — review before finalizing" label (FR-21.3), an unreviewed-facts indicator in the Note Editor, and a "Finalize note" action (never labeled "confirm"; NoteVersion source CLINICIAN_FINALIZED).
6. Rendering of OPEN conflicts as conflicts, and of AI_EXTRACTED facts as "AI inference — verify".
7. Draft exports are marked as drafts (FR-26.5).

**Inputs:** `AI.md`, `CLINICAL-SAFETY.md`.

**Outputs:** Note generation.

**Dependencies:** Phase 14.

**Tests:**
- no invented normal findings (CS-20)
- numbers preserved
- NKDA not inserted when allergies were not discussed (CS-04)
- finalize ≠ confirm with AI drafts (CS-25)
- OPEN conflicts rendered as conflicts (CS-27, CS-28)
- the Phase 15 CS parts in `CLINICAL-SAFETY.md` §18a (note parts of CS-01, CS-04, CS-08–CS-10, CS-18 B, CS-19 B, CS-20, CS-21 B, CS-25 B, CS-27 C, CS-28 D, CS-30 B, CS-32 A, CS-41 C)

**Completion criteria:**
- Note-related safety tests pass.
- Success criterion 7 (edit the generated note) passes in E2E.
- Gate 6 PASS (AI completion gate).

**Potential blockers:** None.

## PHASE 16 — LONGITUDINAL MEMORY

**Purpose:** Timeline and return-visit comparison (Features 24, 25).

**Tasks:**
1. Timeline aggregation queries.
2. Timeline screen.
3. Returning Patient screen.
4. Comparison display with "not discussed this visit".

**Inputs:** `PRODUCT_SPEC.md` Features 24–25; `UI-UX.md` screens 5, 16.

**Outputs:** Longitudinal features.

**Dependencies:** Phase 15.

**Tests:** Scenario S18; medication absence rule; comparison input set (current versions only, provisional labeled, conflicts shown; FR-25.4); comparison text rendered by code from the diff, job 14 selection only (FR-25.5, ADR-045); CS-12 C, CS-24 B.

**Completion criteria:** Success criteria 10–12 pass.

**Potential blockers:** None.

## PHASE 17 — FOLLOW-UP

**Purpose:** Follow-up tracking (Feature 16).

**Tasks:**
1. Follow-Up screen; pending list on Home.
2. Clinician-only completion/cancellation.
3. Pending investigations surfaced.

**Inputs:** `PRODUCT_SPEC.md` Feature 16.

**Outputs:** Follow-up feature.

**Dependencies:** Phase 16.

**Tests:** AI cannot complete follow-up; scenario S20.

**Completion criteria:** FR-16.x pass.

**Potential blockers:** None.

## PHASE 18 — EXPORT

**Purpose:** Export notes safely (Feature 26).

**Tasks:**
1. Plain-text and PDF export (verify current Expo print/sharing APIs).
2. Export warning dialog.
3. AuditEvent on export.

**Inputs:** `SECURITY.md` Export Security.

**Outputs:** Export feature.

**Dependencies:** Phase 15.

**Tests:** Export offline; warning shown; audit written; CS-32 B (no candidate text in exports; draft watermark).

**Completion criteria:** FR-26.x pass. Gate 6 PASS for the export parts (ADR-040).

**Potential blockers:** None.

## PHASE 19 — SECURITY

**Purpose:** Dedicated security review and hardening.

**Tasks:**
1. Verify the Phase 4 encryption (ADR-031) on device. Implement the app lock. Evaluate platform app-integrity attestation as hardening (ADR-032).
2. Verify that no crash-reporting or analytics SDK is present (ADR-030), and that logs contain no clinical content.
3. Review backend auth, authorization, rate limits, validation.
4. Prompt-injection review.
5. Dependency audit.
6. Verify all acceptance criteria in `SECURITY.md` §20.

**Inputs:** `SECURITY.md`.

**Outputs:** Security review record in `BUILD_REPORT.md`.

**Dependencies:** Phases 1–18.

**Tests:** Security test suite (`TESTING.md` §8).

**Completion criteria:** All SECURITY acceptance criteria pass.

**Potential blockers:** None from open decisions (OD-003 and OD-009 resolved). Device-specific encryption issues.

## PHASE 20 — PRIVACY

**Purpose:** Dedicated privacy review.

**Tasks:**
1. Resolve OD-006 (retention).
2. Populate third-party provider table in `PRIVACY.md`.
3. Verify logs, analytics (none in V1), crash reports.
4. Verify deletion completeness.
5. Draft input for the public privacy policy.

**Inputs:** `PRIVACY.md`.

**Outputs:** Privacy review record.

**Dependencies:** Phase 19.

**Tests:** Privacy test suite (`TESTING.md` §9).

**Completion criteria:** All PRIVACY acceptance criteria pass.

**Potential blockers:** OD-006; provider contract terms.

## PHASE 21 — TESTING

**Purpose:** Consolidate coverage and run the full scenario suite.

**Tasks:**
1. Run all 24 synthetic scenarios end to end.
2. Fill coverage gaps in unit, integration, UI tests.
3. Run AI evaluation set against the configured models.
4. Offline test suite.

**Inputs:** `TESTING.md`.

**Outputs:** Test results recorded in `BUILD_REPORT.md`.

**Dependencies:** Phase 20.

**Tests:** Entire suite.

**Completion criteria:** All acceptance criteria in `TESTING.md` §15 met.

**Potential blockers:** Flaky provider behavior — isolate with mocks.

## PHASE 22 — PERFORMANCE

**Purpose:** Ensure responsiveness on mid-range Android devices.

**Tasks:**
1. Measure cold start, patient list with 1,000 synthetic patients, timeline with 100 visits.
2. Measure live transcript latency.
3. Measure post-consultation pipeline duration.
4. Measure battery during a 30-minute recording.
5. Optimize as needed.

**Inputs:** `TESTING.md` §11.

**Outputs:** Performance report.

**Dependencies:** Phase 21.

**Tests:** Performance tests with targets in `TESTING.md` §11.

**Completion criteria:** Targets met or deviations documented and accepted.

**Potential blockers:** Device availability.

## PHASE 23 — ANDROID BUILD

**Purpose:** Produce signed release builds.

**Tasks:**
1. Verify target SDK requirements for Google Play.
2. Configure release signing (EAS-managed or owner-held keystore, never in Git).
3. Build preview APK/AAB and production AAB with EAS.
4. Device testing on at least two Android versions.

**Inputs:** `DEPLOYMENT.md`, `GOOGLE-PLAY.md`.

**Outputs:** Signed AAB.

**Dependencies:** Phase 22; encryption verified (ADR-031).

**Tests:** Android device test checklist (`TESTING.md` §12).

**Completion criteria:** Production AAB builds and passes device tests.

**Potential blockers:** Expo/EAS account; signing key custody.

## PHASE 24 — GOOGLE PLAY

**Purpose:** Prepare and submit to testing tracks.

**Tasks:**
1. Re-check current Play policies.
2. Store listing, screenshots (synthetic), description without prohibited claims.
3. Publish privacy policy.
4. Data Safety form, Health Apps declaration, permissions declarations.
5. Closed testing track per current account requirements.

**Inputs:** `GOOGLE-PLAY.md`.

**Outputs:** App in testing track.

**Dependencies:** Phase 23; formal regulatory assessment documented per ADR-025; OD-006, OD-010, OD-011.

**Tests:** Google Play checklist (`GOOGLE-PLAY.md` §16).

**Completion criteria:** Testing-track release accepted by Play.

**Potential blockers:** Regulatory classification; Play policy review outcome; developer account requirements.

## PHASE 25 — FINAL RELEASE AUDIT

**Purpose:** Final go/no-go before production.

**Tasks:**
1. Re-verify every provider in `API_CATALOG.md`.
2. Re-run full test suite.
3. Clinical-safety review sign-off by a clinician.
4. Security and privacy re-review.
5. Confirm no prohibited claims anywhere.
6. Confirm all OPEN DECISIONS resolved.
7. Rewrite `BUILD_REPORT.md`; update `PROJECT-STATUS.md`.

**Inputs:** All documents.

**Outputs:** Release decision record in `DECISIONS.md`.

**Dependencies:** Phase 24.

**Tests:** Full suite.

**Completion criteria:** Documented go decision by the project owner.

**Potential blockers:** Any unresolved open decision; failed safety test.
