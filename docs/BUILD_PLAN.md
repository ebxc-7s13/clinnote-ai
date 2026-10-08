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
8. **Completion** requires: completion criteria met, tests passing, `PROJECT-STATUS.md` updated, `BUILD_REPORT.md` rewritten from actual state, work committed.

## Phase Overview

| Phase | Name | Key open-decision dependencies |
|---|---|---|
| 0 | Documentation | — |
| 1 | Repository Foundation | — |
| 2 | Expo and Android Foundation | — |
| 3 | UI System | — |
| 4 | Local Database | OD-003 (before distribution) |
| 5 | Patient System | — |
| 6 | Visit System | — |
| 7 | Recording | — |
| 8 | Speech | OD-001, OD-004, OD-007 |
| 9 | Speaker Diarization | OD-001 |
| 10 | Clinical Extraction | OD-002 |
| 11 | Medication Intelligence | — |
| 12 | Evidence Engine | OD-008 (images only) |
| 13 | AI Reasoning | OD-002 |
| 14 | Clinical Review | OD-005 (recommended) |
| 15 | Note Generation | OD-002 |
| 16 | Longitudinal Memory | — |
| 17 | Follow-Up | — |
| 18 | Export | — |
| 19 | Security | OD-003, OD-009 |
| 20 | Privacy | OD-006 |
| 21 | Testing | — |
| 22 | Performance | — |
| 23 | Android Build | OD-003 |
| 24 | Google Play | OD-005, OD-006, OD-010 |
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
5. Create screen shells for all 20 screens with real empty, loading and error states.
6. Accessibility: labels, roles, minimum touch targets, focus order.

**Inputs:** `UI-UX.md`, `CLINICAL-SAFETY.md` (labels for states).

**Outputs:** Component library; navigable shell.

**Dependencies:** Phase 2.

**Tests:** Component unit tests; accessibility label tests; navigation tests.

**Completion criteria:** All screens reachable; every component has an accessibility label test; no color-only meaning.

**Potential blockers:** None expected.

## PHASE 4 — LOCAL DATABASE

**Purpose:** Implement the on-device Local Clinical Store (ADR-005, ADR-013).

**Tasks:**
1. Verify current Expo SQLite API and encryption options; update OD-003 with findings.
2. Implement schema for every entity in `DATA_MODEL.md` with foreign keys and indexes.
3. Implement migration mechanism (versioned, forward-only).
4. Implement repositories (one per aggregate) behind a `StorageProvider` interface.
5. Implement enum validation and state-machine guards at the repository boundary.
6. Implement AuditEvent writing for create/update/confirm/delete.
7. Implement cascading delete for patient deletion.
8. Implement synthetic seed data generator (development builds only, clearly fictional).

**Inputs:** `DATA_MODEL.md`, `SECURITY.md`, `PRIVACY.md`.

**Outputs:** Database layer with repositories and migrations.

**Dependencies:** Phase 2. OD-003 must be resolved before any build is distributed beyond the developer.

**Tests:** Schema tests; repository CRUD tests; invalid enum rejection; illegal state transition rejection; cascade delete; migration up from empty.

**Completion criteria:** All entities persist and reload; validation tests pass.

**Potential blockers:** Encryption support (OD-003).

## PHASE 5 — PATIENT SYSTEM

**Purpose:** Create, search, view, edit and delete patients (Features 1, 2, 9).

**Tasks:**
1. Patient creation flow with auto reference generation.
2. Optional identity fields.
3. Patient list and local search.
4. Patient Overview screen with sections and NOT DISCUSSED allergy display.
5. Edit patient.
6. Delete patient with confirmation and cascade.

**Inputs:** `PRODUCT_SPEC.md` Features 1, 2, 9; `UI-UX.md` screens 3, 4, 17.

**Outputs:** Patient feature.

**Dependencies:** Phases 3, 4.

**Tests:** Unit (reference generation, validation); UI (create, search, edit, delete); offline.

**Completion criteria:** FR-1.x, FR-2.x, FR-9.1, FR-9.3 pass tests.

**Potential blockers:** None.

## PHASE 6 — VISIT SYSTEM

**Purpose:** Create visits, record consent, and support a fully manual visit including manual note entry (Features 3, 4; manual path of 21–23).

**Tasks:**
1. Start Visit screen (select patient, note type).
2. Consent screen and ConsentRecord creation (CONFIRMED / DECLINED).
3. Manual fact entry (symptom, medication, allergy, investigation, assessment, plan, follow-up) with provenance CLINICIAN_STATED and status CONFIRMED.
4. Manual note editor with NoteVersion history (MANUAL_DRAFT, CLINICIAN_EDIT).
5. Finalize note (clinician action).
6. Visit list and visit detail.
7. Delete visit.

**Inputs:** `PRODUCT_SPEC.md` Features 3, 4, 21–23; `DATA_MODEL.md`.

**Outputs:** Manual clinical workflow end to end.

**Dependencies:** Phase 5.

**Tests:** Visit state machine; consent gating; note versioning; offline manual visit E2E.

**Completion criteria:** A synthetic manual visit can be created, documented, finalized, reopened and deleted offline.

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

**Inputs:** `SPEECH.md`, `PRIVACY.md`, `GOOGLE-PLAY.md` (permissions).

**Outputs:** Recording feature producing temporary audio chunks.

**Dependencies:** Phase 6.

**Tests:** State machine; consent gate; permission denial; interruption; temporary audio deletion after processing, discard, and 24 hours.

**Completion criteria:** Recording cannot start without consent; audio files are deleted per policy in tests.

**Potential blockers:** Foreground-service policy constraints.

## PHASE 8 — SPEECH

**Purpose:** Live and final transcription through a provider-agnostic SpeechProvider.

**Tasks:**
1. Resolve OD-007 (languages) and OD-001 (provider) using a synthetic-audio evaluation of candidates.
2. Verify the chosen provider in `API_CATALOG.md`.
3. Resolve OD-004 (backend authentication).
4. Create backend project (Supabase Edge Functions, ADR-012) with: auth check, rate limiting, request validation, short-lived streaming token issuance or audio proxy.
5. Implement `SpeechProvider` interface and the primary adapter; implement a mock adapter for tests.
6. Live transcript UI with low-confidence marking.
7. Final transcript pass after stop.
8. Fallback provider adapter (if selected) and failure handling: network loss, timeouts, empty transcript.
9. Transcript editing with audit.
10. ProviderExecution recording (no content).

**Inputs:** `SPEECH.md`, `API_CATALOG.md`, `ARCHITECTURE.md`, `SECURITY.md`.

**Outputs:** Transcription working end to end with synthetic audio.

**Dependencies:** Phase 7; OD-001, OD-004, OD-007.

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
5. Provenance rule: UNKNOWN speaker → provenance TRANSCRIPTION/UNKNOWN, never PATIENT_REPORTED/CLINICIAN_STATED.

**Inputs:** `SPEECH.md`, `CLINICAL-SAFETY.md`.

**Outputs:** Role-labeled final transcript.

**Dependencies:** Phase 8.

**Tests:** Multi-speaker synthetic scenario; mapping correction changes provenance; UNKNOWN speaker provenance rule.

**Completion criteria:** Scenario S10 passes (`TESTING.md`).

**Potential blockers:** Provider diarization quality.

## PHASE 10 — CLINICAL EXTRACTION

**Purpose:** Extract structured clinical facts with provenance (Features 8, 10–16) using the LLM layer.

**Tasks:**
1. Resolve OD-002 and verify the provider.
2. Implement `LLMProvider` interface, backend LLM endpoint, mock adapter.
3. Implement structured-output pipeline: schema validation → semantic validation → retry once → fallback (`AI.md`).
4. Implement AI jobs 1–10 (`AI.md` §3) as separate, versioned prompt modules.
5. Implement deterministic post-processors: negation check, number preservation check, segment reference check.
6. Store facts as PROVISIONAL with provenance; propose profile updates.
7. Clinical Facts screen with confirm / reject / edit.

**Inputs:** `AI.md`, `CLINICAL-SAFETY.md`, `DATA_MODEL.md`.

**Outputs:** Extraction pipeline.

**Dependencies:** Phase 9; OD-002.

**Tests:** All critical clinical tests (`TESTING.md` §6); AI evaluation set; prompt-injection test.

**Completion criteria:** All extraction-related safety tests pass with the mock and with the real provider on synthetic data.

**Potential blockers:** Model unable to meet safety tests reliably → stage remains advisory; record in DECISIONS.

## PHASE 11 — MEDICATION INTELLIGENCE

**Purpose:** Normalize medications and attach authoritative information (Feature 11).

**Tasks:**
1. Verify RxNorm, DailyMed, openFDA (drug label, NDC, Drugs@FDA) in `API_CATALOG.md`.
2. Implement `MedicationProvider` (RxNorm) — normalization with candidate list.
3. Ambiguity UI: show candidates; clinician selects.
4. Label retrieval (DailyMed / openFDA label) as EvidenceSources.
5. Medication Information screen.
6. Medication status rules (no auto-DISCONTINUED).

**Inputs:** `API_CATALOG.md`, `EVIDENCE-SOURCES.md`, `CLINICAL-SAFETY.md`.

**Outputs:** Medication normalization and information.

**Dependencies:** Phase 10.

**Tests:** Normalization adapter tests (recorded fixtures of public, non-patient responses); ambiguity; status rule; no dose suggestions.

**Completion criteria:** Scenarios S5, S8, S19 pass.

**Potential blockers:** RxNorm coverage of non-US brand names (see OD-005).

## PHASE 12 — EVIDENCE ENGINE

**Purpose:** Retrieve, store and display source-linked evidence (Features 17, 19).

**Tasks:**
1. Verify each provider before integrating (order: PubMed → MedlinePlus → Europe PMC → ClinicalTrials.gov → NLM Clinical Tables → PubChem → WHO → NCI).
2. Implement `EvidenceProvider`, `LiteratureProvider`, `HealthInformationProvider`, `ClinicalTrialProvider` adapters on the backend.
3. Evidence query generation (AI job 11) using concepts only; identifier-free validation.
4. EvidenceSource persistence with tier, dates, retrieval time, limitations.
5. Caching and freshness marking.
6. Evidence screen and evidence cards.
7. Manual evidence search.
8. Citation validation: identifiers must originate from provider responses.
9. Reference images: implement only if OD-008 is resolved; otherwise skip and record.

**Inputs:** `EVIDENCE-SOURCES.md`, `API_CATALOG.md`.

**Outputs:** Evidence retrieval.

**Dependencies:** Phases 10, 11.

**Tests:** Adapter tests; fake PMID rejection; fake FDA response handling; no-results path; disagreement display; no identifiers in queries.

**Completion criteria:** Scenarios S16, S17 pass; citation validation tests pass.

**Potential blockers:** Provider terms or rate limits.

## PHASE 13 — AI REASONING

**Purpose:** Generate possibilities to review, evidence synthesis and visit comparison (AI jobs 12–14).

**Tasks:**
1. Clinical candidate generation with supporting/contradicting/missing information referencing fact IDs.
2. Evidence synthesis referencing evidence IDs only.
3. Visit comparison over structured facts (deterministic diff first; AI for wording only).
4. Patient-friendly explanation (AI job 16) labeled for clinician review.
5. Semantic validators for each job.

**Inputs:** `AI.md`, `CLINICAL-SAFETY.md`.

**Outputs:** Reasoning jobs.

**Dependencies:** Phase 12.

**Tests:** No probability fields; no unreferenced fact/evidence IDs; hallucinated diagnosis test; comparison absent-item rule.

**Completion criteria:** Reasoning safety tests pass.

**Potential blockers:** Model reliability.

## PHASE 14 — CLINICAL REVIEW

**Purpose:** The clinician review workspace (Features 18, 22, 23).

**Tasks:**
1. Clinical Review screen: FACTS / POSSIBILITIES TO REVIEW / EVIDENCE / NOTE sections.
2. Transparency actions: Why did this appear? / Source / View transcript / View evidence / Dismiss / Confirm.
3. Conflict display.
4. Confirmation flows updating status and provenance with audit.

**Inputs:** `UI-UX.md` screens 10–12, `CLINICAL-SAFETY.md`.

**Outputs:** Review workspace.

**Dependencies:** Phase 13. OD-005 should be resolved before this phase because regulatory classification may constrain this feature.

**Tests:** Confirmation audit; conflicts shown; AI items always marked provisional.

**Completion criteria:** Success criteria 5–8 (`PRODUCT_SPEC.md` §12) pass in E2E.

**Potential blockers:** OD-005 outcome.

## PHASE 15 — NOTE GENERATION

**Purpose:** AI-drafted notes with editing and finalization (Feature 21).

**Tasks:**
1. Note generation job (AI job 15) per note type.
2. Rendering rules for NOT_DISCUSSED (omit or "not discussed").
3. Note Editor integration with AI_DRAFT versions.
4. Number and negation checks between facts and note text.

**Inputs:** `AI.md`, `CLINICAL-SAFETY.md`.

**Outputs:** Note generation.

**Dependencies:** Phase 14.

**Tests:** No invented normal findings; numbers preserved; NKDA not inserted when allergies not discussed.

**Completion criteria:** Note-related safety tests pass.

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

**Tests:** Scenario S18; medication absence rule.

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

**Tests:** Export offline; warning shown; audit written.

**Completion criteria:** FR-26.x pass.

**Potential blockers:** None.

## PHASE 19 — SECURITY

**Purpose:** Dedicated security review and hardening.

**Tasks:**
1. Resolve and implement OD-003 (local encryption) and app lock.
2. Resolve OD-009 (crash reporting) and implement scrubbing.
3. Review backend auth, authorization, rate limits, validation.
4. Prompt-injection review.
5. Dependency audit.
6. Verify all acceptance criteria in `SECURITY.md` §20.

**Inputs:** `SECURITY.md`.

**Outputs:** Security review record in `BUILD_REPORT.md`.

**Dependencies:** Phases 1–18.

**Tests:** Security test suite (`TESTING.md` §8).

**Completion criteria:** All SECURITY acceptance criteria pass.

**Potential blockers:** OD-003, OD-009.

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

**Dependencies:** Phase 22; OD-003 implemented.

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

**Dependencies:** Phase 23; OD-005, OD-006, OD-010.

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
