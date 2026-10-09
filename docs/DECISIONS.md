# ClinNote AI — Architectural Decisions

Architecture Decision Records (ADRs) and open decisions.

ADR statuses: PROPOSED · ACCEPTED · SUPERSEDED · DEPRECATED.

Note: ADR numbering was reorganized on 2026-10-08 during the documentation correction pass; all references in the repository use the numbering below.

---

## ADR-001 — Android First

- **Status:** ACCEPTED
- **Context:** The initial target users and distribution channel are Android devices via Google Play.
- **Decision:** Build and release for Android first.
- **Reason:** Focus on one platform reduces scope and testing burden.
- **Consequences:** iOS-specific features and testing are out of scope for V1; the stack (ADR-011) keeps iOS possible later.
- **Future review condition:** Demand for iOS or institutional requirements.

## ADR-002 — API-First AI

- **Status:** ACCEPTED
- **Context:** Speech, diarization and LLM capabilities are available as cloud APIs; development happens in Codespaces without GPUs.
- **Decision:** Use cloud/API providers for speech and AI.
- **Reason:** Easier development, no GPU dependency, provider switching, faster iteration.
- **Consequences:** Network required for AI features; provider data terms matter (PRIVACY); offline manual mode required.
- **Future review condition:** Offline AI requirement, cost, or data-residency constraints.

## ADR-003 — No Large Model Downloads

- **Status:** ACCEPTED
- **Context:** Local models (Whisper, Gemma, MedGemma, diarization, embeddings) need storage, compute and maintenance.
- **Decision:** Do not download model weights or install PyTorch/CUDA in this project.
- **Reason:** Keeps the repository and environment light; consistent with ADR-002.
- **Consequences:** All inference via APIs.
- **Future review condition:** Only a new ADR explicitly superseding this one may introduce local models.

## ADR-004 — Provider Abstraction

- **Status:** ACCEPTED
- **Context:** Provider capabilities, pricing and policies change.
- **Decision:** Every external provider is accessed through an interface with adapters and mocks.
- **Reason:** Substitutability, testability, fallback.
- **Consequences:** Slight extra code; provider types never reach domain/UI.
- **Future review condition:** None — permanent principle.

## ADR-005 — Local-First Patient Storage

- **Status:** ACCEPTED
- **Context:** Health data is sensitive; V1 is single-clinician.
- **Decision:** Patient and visit records are stored on the device; the device is the system of record.
- **Reason:** Minimize cloud storage of health data.
- **Consequences:** No cross-device access; data loss on device loss unless exported (ADR-017).
- **Future review condition:** Multi-device or clinic requirements.

## ADR-006 — Synthetic Data During Development

- **Status:** ACCEPTED
- **Context:** Real patient data in development is a privacy and legal risk.
- **Decision:** Only synthetic data in development, tests, fixtures, screenshots and store assets.
- **Reason:** Privacy and security.
- **Consequences:** Synthetic scenario suite must be realistic enough (TESTING).
- **Future review condition:** Any clinical validation study would need its own ethics/legal framework, not this repository.

## ADR-007 — Clinician Confirmation

- **Status:** ACCEPTED
- **Context:** AI can be wrong.
- **Decision:** All AI output is PROVISIONAL until a clinician confirms it; only clinician actions confirm, finalize, complete or discontinue.
- **Reason:** Clinical safety and accountability.
- **Consequences:** Review UI must make confirmation efficient.
- **Future review condition:** None for V1.

## ADR-008 — Possibilities Instead of Autonomous Diagnosis

- **Status:** ACCEPTED
- **Context:** Autonomous diagnosis is unsafe without validation and may change regulatory classification.
- **Decision:** Present "Possibilities to review" with supporting/contradicting facts, missing information and evidence.
- **Reason:** Safety, transparency, trust.
- **Consequences:** No diagnosis output anywhere.
- **Future review condition:** Only with clinical validation and regulatory clearance.

## ADR-009 — Source Provenance

- **Status:** ACCEPTED
- **Context:** Clinicians must know where every statement came from.
- **Decision:** Every clinical fact and AI output records provenance and source references; evidence carries source identifiers from provider responses.
- **Reason:** Traceability, trust, hallucination detection.
- **Consequences:** Data model and validators enforce references.
- **Future review condition:** None.

## ADR-010 — Staged Evidence Retrieval

- **Status:** ACCEPTED
- **Context:** Per-sentence evidence search is costly, slow and noisy.
- **Decision:** Live stage = transcription + lightweight display; evidence retrieval, full extraction and note generation run post-consultation.
- **Reason:** Latency, cost, relevance.
- **Consequences:** No evidence shown during recording.
- **Future review condition:** User research showing need for in-visit evidence.

## ADR-011 — React Native + Expo + TypeScript

- **Status:** ACCEPTED
- **Context:** Need fast Android development from Codespaces.
- **Decision:** React Native with Expo, TypeScript strict mode, EAS Build.
- **Reason:** Managed builds, no local Android toolchain needed, typed clinical structures, iOS possible later.
- **Consequences:** Native features depend on Expo module availability (verify per phase).
- **Future review condition:** A required native capability unavailable in Expo.

## ADR-012 — Serverless Backend on Supabase Edge Functions, Stateless for Clinical Content

- **Status:** ACCEPTED
- **Context:** Private keys must not be on the device.
- **Decision:** Supabase Edge Functions provide auth, validation, rate limiting, routing and secret custody; they store no clinical content.
- **Reason:** Minimal operations, no server-side health-data storage.
- **Consequences:** Backend must be designed to not log bodies.
- **Future review condition:** Platform limits or data-residency needs → replace with equivalent via new ADR.

## ADR-013 — SQLite as Local Clinical Store

- **Status:** SUPERSEDED by ADR-046 (2026-10-09)
- **Context:** Relational data, offline search.
- **Decision:** SQLite via the current Expo SQLite library.
- **Reason:** Mature, relational, offline.
- **Consequences:** Encryption mechanism depends on library support (OD-003).
- **Future review condition:** OD-003 outcome.

## ADR-014 — Temporary Audio Maximum Retention

- **Status:** ACCEPTED
- **Context:** Audio is needed briefly for final transcription and recovery.
- **Decision:** Delete temporary audio after successful final processing, on visit discard, or after 24 hours at most; longer only by explicit per-visit clinician opt-in.
- **Reason:** Bounded exposure with recovery capability.
- **Consequences:** Deletion job and tests required.
- **Future review condition:** OD-006 retention outcome.

## ADR-015 — Information State, Provenance and Review Status Are Independent

- **Status:** ACCEPTED
- **Context:** Mixing these causes "not discussed" to look like "negative" and AI output to look like clinician statements.
- **Decision:** Three separate attributes on every fact (`DATA_MODEL.md` §3).
- **Reason:** Safety and clarity.
- **Consequences:** UI shows all three where relevant.
- **Future review condition:** None.

## ADR-016 — No Numerical Probabilities for Possibilities

- **Status:** ACCEPTED
- **Context:** LLM-produced probabilities are uncalibrated.
- **Decision:** No probability scores or likelihood ranking for possibilities.
- **Reason:** Avoid false certainty.
- **Consequences:** Ordering by link to documented facts only.
- **Future review condition:** Validated, calibrated model with regulatory review.

## ADR-017 — V1 Is Single-Clinician, Single-Device, No Cloud Sync

- **Status:** ACCEPTED
- **Context:** Follows ADR-005 and minimization.
- **Decision:** No cloud backup/sync or shared records in V1.
- **Reason:** Avoid server-side health-data storage and multi-user access control.
- **Consequences:** Data loss on device loss unless exported; clinician informed.
- **Future review condition:** Clinic/multi-device demand with legal review.

## ADR-018 — Documentation Authority Order and Safety Restriction Principle

- **Status:** ACCEPTED (2026-10-08)
- **Context:** The multi-agent instructions specified an authority order (CLAUDE.md → PRODUCT_SPEC → CLINICAL-SAFETY → ARCHITECTURE → DATA_MODEL → API_CATALOG → SECURITY → PRIVACY → BUILD_PLAN → TESTING → DEPLOYMENT → GOOGLE-PLAY → UI-UX → implementation). The previous `CLAUDE.md` put CLINICAL-SAFETY, PRIVACY and SECURITY first. The two orders contradicted each other.
- **Decision:** Adopt the specified order. Add, inside CLAUDE.md (rank 1), a safety restriction principle: restrictive requirements in CLINICAL-SAFETY, SECURITY or PRIVACY prevail over conflicting permissive statements in any document.
- **Reason:** This follows the owner's ordering while preserving the project's non-negotiable safety boundary.
- **Consequences:** CLAUDE.md §2, PRODUCT_SPEC, CLINICAL-SAFETY and `.claude/rules/documentation-and-scope.md` are updated to match.
- **Future review condition:** Any proposal to let a permissive requirement override a safety, security or privacy restriction requires a new ADR and owner approval.

## ADR-019 — Fourteen-Agent Engineering Organization

- **Status:** ACCEPTED (2026-10-08)
- **Context:** ClinNote spans many specialized layers, and independent review is essential for clinical safety and security.
- **Decision:** Build ClinNote with 14 project-scoped Claude Code subagents (`.claude/agents/`), orchestrated by `chief-architect`. The system includes ownership (`docs/AGENT-OWNERSHIP.md`), communication and handoff protocol, quality gates, a runbook and an integration contract register. Only chief-architect holds the Agent tool, and tools follow least privilege.
- **Reason:** Focused context, clear ownership, independent review, safe parallelism.
- **Consequences:** Higher token cost and coordination overhead, controlled by stage-based activation and concurrency ceilings (`.claude/orchestration/team-stages.md`).
- **Future review condition:** Revisit if coordination overhead outweighs the benefit, or when Claude Code agent features change.

## ADR-020 — Agent Teams Enabled Experimentally, with a Subagent Fallback

- **Status:** ACCEPTED (2026-10-08)
- **Context:** Agent teams are experimental in Claude Code v2.1.293. They are enabled by the `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` env setting, need an interactive lead session, and have known limitations: no resumption of in-process teammates, lagging task status, one team per session, and no nested teams.
- **Decision:** Enable the setting in project `.claude/settings.json`. Use teams for multi-layer coordination and research that benefits from debate. For everything else, use subagents with chief-architect relay messaging, handoff files and the Active Task Board, including in non-interactive sessions.
- **Reason:** Get the benefits of teams where they work, without depending on an experimental feature.
- **Consequences:** While teams are enabled, a subagent that Claude names becomes a teammate in interactive sessions. Teams can be disabled by setting the variable to `0` without other changes.
- **Future review condition:** When agent teams leave experimental status, or if a Claude Code upgrade changes their behavior. Re-verify the official documentation after every upgrade.

## ADR-021 — Single Authoritative Provenance Model (resolves F-06, F-07)

- **Status:** ACCEPTED (2026-10-08, Stage A)
- **Context:** Provenance rules contradicted each other across documents:
  - the meaning of UNKNOWN/OTHER speaker roles
  - manual entry recorded as CLINICIAN_STATED vs CLINICIAN_CONFIRMED
  - no rule for editing a PROVISIONAL fact
  - spoken values recorded as MEASURED, even though AI produced them
- **Decision:** `DATA_MODEL.md` §3.2, §3.9 and §8 are the single source of these rules.
  - Each fact has an immutable `originProvenance` and a current `provenance`.
  - Provenance is assigned **by deterministic code** from the clinician-confirmed speaker role and the derivation method, never by the model.
  - CLINICIAN_STATED means spoken by the DOCTOR role and is always PROVISIONAL until reviewed.
  - CLINICIAN_CONFIRMED means personally asserted by the clinician in the app: manual entry, an edit, or a confirmation.
  - MEASURED only ever comes from clinician measurement entry, never from AI. A spoken value is CLINICIAN_STATED.
  - AI inference is AI_EXTRACTED with derivation AI_INFERENCE.
  - Edits create new fact versions. The old versions are kept.
- **Reason:** One unambiguous model keeps AI inference distinct from spoken facts and keeps the original source visible after confirmation.
- **Consequences:** DATA_MODEL, PRODUCT_SPEC §5, CLINICAL-SAFETY §4/§15/§17, AI.md §6, BUILD_PLAN Phases 6/9/10, SPEECH §10 and TESTING (S4, CS-15, CS-29, CS-31) were aligned.
- **Future review condition:** Device integrations (e.g. a Bluetooth BP cuff) would need a new MEASURED derivation path and an ADR.

## ADR-022 — Explicit Contradiction Model (resolves F-08)

- **Status:** ACCEPTED (2026-10-08, Stage A)
- **Context:** The safety rules required a clarification flag and a "Conflict — review" marker, but the data model had no field or entity for either, and no job produced them.
- **Decision:** `DATA_MODEL.md` §9 defines conflicts.
  - A deterministic detector creates FactConflict records (types SELF_CORRECTION, SPEAKER_DISAGREEMENT, BLANKET_VS_SPECIFIC, VALUE_MISMATCH, CROSS_VISIT).
  - Both observations are kept.
  - A later statement supersedes an earlier one only after the clinician resolves the conflict.
  - A POSITIVE allergy statement is never hidden by a "no allergies" statement.
  - Facts carry `needsClarification` and `clarificationReason`.
- **Reason:** The system must never silently overwrite clinical statements.
- **Consequences:** New entity, fields and state machine (§5.7). Job 2 may flag corrections. Notes render OPEN conflicts as conflicts. New tests CS-26, CS-27 and CS-28.
- **Future review condition:** If clinicians find conflict noise excessive, tune the detector; never remove the record.

## ADR-023 — Evidence Retrieval Precedes Possibility Generation (resolves F-01)

- **Status:** ACCEPTED (2026-10-08, Stage A)
- **Context:** Documents disagreed on the order of the AI steps.
  - AI.md job 11 took candidates as input, while ARCHITECTURE built queries from facts only.
  - BUILD_PLAN built query generation (Phase 12) before candidates (Phase 13).
  - Phase 12 completion relied on synthesis tests (CS-16, S17) for a job built in Phase 13.
- **Decision:** The canonical order is:
  1. facts → concepts → queries (job 11, facts only)
  2. sanitized retrieval → validation → ranking/dedup → storage
  3. candidate generation (job 12, grounded in the stored bundle) → supporting / contradicting / missing → citations (evidence IDs ⊆ bundle) → synthesis (job 13) → clinician review

  Clinician-initiated manual searches from a candidate remain possible. Their results join the bundle and may be cited only by a **clinician-triggered** regeneration; there is no automatic candidate-driven retrieval loop. Visit gains `candidateState`. CS-16 and the synthesis half of S17 move to Phase 13. CS-17 and adapter validation move to Phase 11. Stage-gating details (evidence required, flag OFF, empty bundle, notes) are in ADR-034.
- **Reason:** Possibilities must be grounded in already-validated authoritative sources, and every phase's tests must be satisfiable within that phase. This matches the owner's preferred pipeline, and the dry-run agents converged on the same fix.
- **Consequences:** PRODUCT_SPEC §6, ARCHITECTURE §6.4, AI.md §3, EVIDENCE-SOURCES §17, BUILD_PLAN 11–13, TESTING and DATA_MODEL §4.15 were aligned.
- **Future review condition:** A future second retrieval pass driven by candidates requires an ADR.

## ADR-024 — Safety Test Corpus Before Any Clinical-AI Completion (resolves F-09, F-10)

- **Status:** ACCEPTED (2026-10-08, Stage A)
- **Context:**
  - The synthetic corpus, the CS harness and the AI evaluation set were first run in Phase 21, but they were needed in Phases 8–10.
  - "Finalize ≠ confirm" had no test.
- **Decision:**
  - BUILD_PLAN Phase 6 builds the safety test corpus (`TESTING.md` §13a), owned by clinical-safety-engineer and qa-test-engineer.
  - No AI phase (10, 13, 15) can complete without it (`AI.md` §15; Gate 6).
  - CS-25 (finalize ≠ confirm) is added and runs from Phase 6.
  - CS-12 and CS-23 run from Phase 10.
  - *(The phase list "10, 13, 15" is superseded by ADR-040: the gate covers Phases 10, 11, 12, 13 and 15, and the per-part schedule is in CLINICAL-SAFETY §18a.)*
- **Reason:** Safety evidence must exist before AI functionality can claim completion.
- **Consequences:** Phase 6 scope grows, but the corpus is only files and a harness, with no AI.
- **Future review condition:** None.

## ADR-025 — Intended-Use Regulatory Gate (resolves OD-005 for project planning; F-04)

- **Status:** ACCEPTED (2026-10-08). **This is an engineering gate, not a legal or regulatory conclusion.**
- **Context:** Regulatory classification depends on intended use and target market. Two current official sources were reviewed on 2026-10-08:
  - **US FDA:** "Clinical Decision Support Software" final guidance, issued January 29, 2026, superseding the version issued January 6, 2026 (docket FDA-2017-D-6569). Re-verified 2026-10-08 against text extracted from the official PDF, https://www.fda.gov/media/109618/download. The four criteria for Non-Device CDS:
    1. the software does not acquire, process or analyze medical images, IVD signals, or patterns/signals from a signal acquisition system
    2. it displays, analyzes or prints medical information
    3. it supports or provides recommendations to an HCP, and is not intended to replace or direct the HCP's judgment
    4. it lets the HCP independently review the basis of the recommendations, so the HCP does not rely primarily on them

    The guidance also says:
    - lists, or prioritized lists, of diagnostic or treatment options *may* meet Criterion 3
    - a specific preventive, diagnostic or treatment output or directive fails Criterion 3
    - where only one option is clinically appropriate and the function otherwise meets all four criteria, FDA "intends to exercise enforcement discretion". **ClinNote does not rely on this policy**: it is an enforcement posture, not a classification, and it does not fit a documentation product
    - under Criterion 4, FDA considers the level of automation and the time-critical nature of the decision, because automation bias increases when urgent action is needed
    - patient data reports and summaries are discussed as medical information under Criterion 2. No passage addresses ambient transcription of consultations specifically
  - **India CDSCO:** "Guidance Document on Medical Device Software" (CDSCO/MD/GD/MDSW/01/2026), reported by secondary sources as published 21 July 2026 after a draft dated October 2025. It states it is guidance, not a new regulatory control, under the Medical Devices Rules 2017. Classification rests on intended use and the risk rules (Class A–D). **Only secondary summaries were reviewed (2026-10-08); the official PDF must be read by the formal assessor.**

  EU MDR Rule 11 was not reviewed.
- **Decision — functionality tiers:**

| Tier | Functionality | Project status |
|---|---|---|
| R0 Documentation | recording with consent, transcription, diarization, extraction of **stated** facts, editable notes, timeline, follow-up, export | **May proceed** (implementation and release), subject to the other gates |
| R1 Reference information | retrieval and display of authoritative sources (labels, literature, patient education) with citations and no patient-specific recommendation | **May proceed** (implementation and release), with the labeling rules in EVIDENCE-SOURCES |
| R2 Patient-specific decision support | "Possibilities to review" (job 12), candidate-driven synthesis, any output that ranks or suggests conditions for a specific patient | **Implementation may proceed** with synthetic data, behind feature flag `possibilitiesEnabled`, **default OFF**. With the flag OFF, jobs 12 and 13 are **not executed** and no ClinicalCandidate exists (ADR-034). **No release** to any real user, including closed testing with real clinicians, until a formal regulatory assessment is documented for each target market |
| R3 Diagnostic / treatment / prescribing | specific diagnoses, treatment directives, dosing, triage, image or signal analysis | **Prohibited in V1.** Any proposal requires a formal regulatory assessment **before implementation** and a new ADR |

- **Formal assessment:**
  - **Who:** a qualified regulatory affairs professional or legal counsel for each target market, engaged by the project owner.
  - **When:** before (a) any release that includes R2, (b) any implementation of R3, and (c) Phase 24 for any release.
  - **What it must state:** the intended-use statement, the classification per market, and the required approvals.
  - Engineering agents never make this determination.
- **Open questions for the assessor:**
  - whether capturing consultation audio for transcription counts as "acquiring a signal" under Criterion 1 (our assumption: no, because it is not a physiological signal, but the assessor must confirm)
  - whether a non-ranked "possibilities to review" list meets Criteria 3–4 in each market
- **Consequences:**
  - BUILD_PLAN Phases 13–14 carry the R2 flag rule.
  - GOOGLE-PLAY and QUALITY-GATES Gate 10 require the assessment.
  - Target markets are a new open decision (OD-011).
- **Future review condition:** On a new target market, any change of intended-use wording, or a new guidance version.

## ADR-026 — Backend Foundation Decoupled from the Speech-Provider Decision (resolves F-14)

- **Status:** ACCEPTED (2026-10-08, Stage A)
- **Context:** Phase 8 bundled the backend scaffold with OD-001, so a slip in the speech decision also blocked Phases 10–12.
- **Decision:** The backend foundation moves to BUILD_PLAN Phase 7 (task group 7B, backend-api-engineer). It covers the project, clinician auth (ADR-032), validation, rate limiting, routing config, ProviderExecution, a health endpoint and a mock provider route. Phase 8 adds only the speech token/proxy endpoint.
- **Reason:** Removes a false dependency.
- **Consequences:** Phase 7 needs OD-004 decided (done, ADR-032).
- **Future review condition:** None.

## ADR-027 — V1 Live Stage Is Transcript-Only (refines ADR-010)

- **Status:** ACCEPTED (2026-10-08, Stage A)
- **Context:** UI-UX Screen 8 showed "provisional salient phrases", and ARCHITECTURE §7 mentioned "lightweight extraction". Neither had a defined job, validator or test.
- **Decision:** V1 performs no live AI extraction. The live stage shows only the transcript. All AI runs post-consultation, after speaker roles are confirmed.
- **Reason:** No unvalidated AI output reaches the clinician during the consultation. This also reduces cost (the owner's AI cost policy allows live light extraction only "where needed"; it is not needed for V1).
- **Consequences:** UI-UX Screen 8, ARCHITECTURE §7 and AI.md §16 were updated.
- **Future review condition:** A live feature requires a defined job, validator, CS tests and an ADR.

## ADR-028 — Deterministic Evidence Ranking, Deduplication and On-Device Caching (resolves F-13)

- **Status:** ACCEPTED (2026-10-08, Stage A)
- **Context:** The specs left several things undefined or inconsistent:
  - ranking and deduplication were undefined
  - tiers were assigned per provider, which put NCI in two tiers
  - the routing table had gaps
  - the cache location was unspecified, and a backend cache would conflict with the stateless backend (ADR-012)
- **Decision:**
  - tiers are assigned per record by content type
  - ranking is deterministic, never done by the LLM
  - deduplication is by identifier equivalence
  - caching happens on the device only, with `retrievedAt` = the original fetch time
  - the backend keeps no cache
  - the routing table covers every provider, or marks it "not integrated in V1" (Orange Book)
- **Reason:** Predictable, testable evidence presentation with no server-side storage of patient-derived queries.
- **Consequences:** EVIDENCE-SOURCES §2/§14–§17, API_CATALOG §2/§17/§29 and ARCHITECTURE §3.5/§6.4 were updated.
- **Future review condition:** Revisit if the volume of provider calls requires a shared, non-patient-derived cache (that would need an ADR and a privacy review).

## ADR-029 — No Reference Images in V1 (resolves OD-008 by descoping)

- **Status:** ACCEPTED (2026-10-08)
- **Context:** No legally usable image source was verified. Images also carry a risk of being read as a patient match.
- **Decision:** V1 does not download, rehost or display reference images. Evidence cards may link to authoritative pages that contain images. ImageProvider stays unimplemented.
- **Reason:** Removes licensing and safety risk without losing core value.
- **Consequences:** PRODUCT_SPEC Feature 20, EVIDENCE-SOURCES §13, ARCHITECTURE §3.6 and CS-30 were updated.
- **Future review condition:** Owner request plus a verified licensed source plus a new ADR.

## ADR-030 — No Third-Party Crash-Reporting SDK in V1 (resolves OD-009)

- **Status:** ACCEPTED (2026-10-08)
- **Context:** Crash SDKs risk capturing clinical content.
- **Decision:** V1 ships no crash-reporting or analytics SDK. Stability uses Google Play Console Android vitals (exact data collected: VBI). On-device ProviderExecution records support debugging.
- **Reason:** Data minimization; no clinical content can leak through crash payloads.
- **Consequences:** SECURITY §17, PRIVACY §7/§9, DEPLOYMENT §12, GOOGLE-PLAY §6 and API_CATALOG §28/§30 were updated.
- **Future review condition:** Post-launch stability needs. Adding an SDK requires an ADR, a scrubbing allow-list and a privacy review.

## ADR-031 — Local Encryption with SQLCipher via expo-sqlite (resolves OD-003 for planning)

- **Status:** ACCEPTED for planning (2026-10-08). Re-verify at Phase 4.
- **Context:** The official Expo docs (expo-sqlite reference, SDK 57, read 2026-10-08) say expo-sqlite supports SQLCipher on Android and iOS through the config-plugin option `useSQLCipher`. The key is set with `PRAGMA key` after opening. SQLCipher is not supported in Expo Go and requires a new native build (prebuild or development build).
- **Decision:** Use expo-sqlite with `useSQLCipher: true`. The key is a random 256-bit value generated on first launch and stored in Android Keystore-backed secure storage (expo-secure-store; VBI at Phase 4). Development uses EAS development builds, not Expo Go. Encryption is enabled from Phase 4, not deferred to Phase 19.
- **Reason:** Supported by the chosen stack, and it removes a distribution blocker.
- **Consequences:**
  - Losing the key (e.g. app data cleared) means the data is unrecoverable, consistent with ADR-017; the clinician is informed.
  - Performance is measured in Phase 22.
- **Future review condition:** The Phase 4 re-verification fails, or SDK changes affect SQLCipher.

## ADR-032 — Clinician Accounts via Supabase Auth for Backend Access (resolves OD-004 for planning)

- **Status:** ACCEPTED for planning (2026-10-08). Mechanism details are VBI at Phase 7.
- **Context:** The backend must not be an anonymous proxy to paid AI APIs. The Supabase docs (read 2026-10-08) confirm that Edge Functions verify the caller's JWT by default (`verify_jwt = true`).
- **Decision:**
  - The clinician signs in with a Supabase Auth account (email-based; the exact method is chosen at Phase 7 after verification).
  - Every function verifies the JWT and applies per-user rate limits and quotas.
  - No patient data is linked to the account. The account stores clinician email only.
  - Platform app-integrity attestation (e.g. Play Integrity) is evaluated in Phase 19 as additional hardening.
- **Reason:** Per-user accountability and abuse control, with no shared secret in the app.
- **Consequences:** The clinician email becomes personal data that must be disclosed (PRIVACY §7, Data Safety). An offline-first app still works without sign-in for local features; only cloud stages need it.
- **Future review condition:** Institutional SSO needs.

## ADR-033 — Stage A Reconciliation Applied by the Lead with Owner-Agent Review

- **Status:** ACCEPTED (2026-10-08)
- **Context:** F-01 to F-14 cut across documents owned by several agents. Concurrent edits by several owners would have broken the single-writer rule for core files (AGENT-OWNERSHIP §4).
- **Decision:** chief-architect applied the cross-document edits as a single writer. The owning agents (product-clinical-architect, evidence-research-engineer, clinical-safety-engineer) then reviewed the reconciled specifications as an agent team. Team run 1 (interrupted by a session limit) found residual conflicts; the lead fixed them (ADR-034 to ADR-036). Team run 2 reviewed the corrected specifications. The Stage A resume session re-checked them with staged single agents (ADR-044, ADR-045). All findings are triaged in `docs/agent-handoffs/2026-10-08-stage-a-team2-synthesis.md`.
- **Reason:** Consistency, plus single-writer discipline, plus owner review.
- **Consequences:** The ownership doc records this exception.
- **Future review condition:** Applies to Stage A only.

## ADR-034 — Pipeline Stage Gating for Evidence, Possibilities and Notes (refines ADR-023, ADR-025)

- **Status:** ACCEPTED (2026-10-08, Stage A, from agent-team review run 1)
- **Context:** After the first reconciliation, the team found these residual conflicts:
  - ARCHITECTURE §8 let candidate generation run on facts alone when evidence FAILED, which contradicts ADR-023's grounding rationale. DATA_MODEL §5.2 allowed SKIPPED evidence, and TESTING §13a required COMPLETED.
  - The `possibilitiesEnabled` flag only hid possibilities; nothing stopped jobs 12–13 from running.
  - DATA_MODEL §5.2 let a note include candidates. Because finalize ≠ confirm, an unconfirmed AI possibility could then enter a finalized or exported note.
  - Job 11 used every non-rejected fact, including NEGATIVE facts and facts in OPEN conflicts. Job 12 validated only that fact IDs existed, so a denied symptom could become "supporting".
  - Candidate staleness, regeneration and the empty bundle were undefined.
- **Decision:**
  1. **Evidence required.** The candidate stage starts only when `possibilitiesEnabled` is ON **and** `evidenceState` is COMPLETED or PARTIAL **and** the stored bundle is non-empty *(refined by ADR-039: the **citable** bundle)*. Otherwise `candidateState` becomes SKIPPED, with the reason shown: "Possibilities not generated: evidence retrieval did not complete" or "…: no evidence retrieved". Candidates are never generated from facts alone.
  2. **Flag OFF means not executed.** With the flag OFF, jobs 12 and 13 are never called, no ClinicalCandidate is created, and no ProviderExecution exists for them (CS-37).
  3. **Notes are independent of candidates.** The note stage depends on `clinicalExtractionState`, never on `candidateState`. Notes and exports never include PROVISIONAL or DISMISSED candidates. A possibility reaches a note only as the CONFIRMED Assessment the clinician creates from it (CS-32).
  4. **Inputs carry information state.** *(Refined by ADR-038 (current facts), ADR-039 (deterministic job 11) and ADR-043 (code-owned concept keys, eligibility).)*
     - Automatic job 11 uses current (non-superseded), non-rejected facts with informationState POSITIVE or UNKNOWN, excluding facts in an OPEN conflict. Each concept carries the fact's informationState.
     - In job 12, supportingFactIds must be POSITIVE (UNKNOWN only when labeled "uncertain"). NEGATIVE facts may appear only as contradicting facts. NOT_DISCUSSED topics may appear only as missing information. REJECTED and superseded facts are never referenced (CS-33).
     - `missingInformation` lists only clinical information not discussed. It never names guidelines, papers or other sources. Evidence gaps are shown by deterministic code.
  5. **Staleness and regeneration.** Each candidate records the fact versions it was generated from. When any referenced fact is edited, rejected, superseded or conflict-resolved, code marks the candidate "Outdated — facts changed since generation". Only a clinician can regenerate, which moves `candidateState` COMPLETED → IN_PROGRESS. Earlier candidates and their decisions are kept, marked `supersededByRunId`, and never deleted.
  6. **Neutral order.** Code orders possibilities alphabetically by topic, and the UI states that the order carries no meaning. The model's output order is never used (ADR-016).
- **Reason:** Possibilities must stay grounded, gated and out of the record unless a clinician confirms them, and negation must never be inverted downstream.
- **Consequences:** DATA_MODEL §4.14/§5.2/§5.4, ARCHITECTURE §6.4/§6.5/§8, AI.md §3/§5.1, PRODUCT_SPEC FR-18.x/FR-21.2, CLINICAL-SAFETY §6/§18 (CS-32, CS-33, CS-37), TESTING §13a and BUILD_PLAN Phases 13–15 are aligned.
- **Future review condition:** Any proposal to generate possibilities without retrieved evidence needs a new ADR and a clinical-safety review.

## ADR-035 — Provenance Re-Derivation on Transcript or Role Correction; Root Origin (refines ADR-021)

- **Status:** ACCEPTED (2026-10-08, Stage A, from agent-team review run 1)
- **Context:** Several documents require a speaker-role correction made after extraction to update provenance: FR-22.3, SPEECH §11, CLINICAL-SAFETY §15 / CS-15 and TESTING S13. But DATA_MODEL makes `originProvenance` immutable and defines no transition for the correction. Three further gaps:
  - An edit created a version whose origin was CLINICIAN_CONFIRMED, so the original source disappeared from view. That contradicts CLINICAL-SAFETY §4 and FR-23.3.
  - Rule 5 allowed "reattribution to PATIENT_REPORTED as an edit", which contradicts rule 4 and validation rule 12.
  - The Q&A discontinuation case (DOCTOR "Still on amlodipine?" / PATIENT "No, I stopped it") was undefined.
- **Decision:**
  1. *(Superseded by ADR-038 decision 2: role-only corrections recompute provenance and keep the derivation; text or category-invalidating corrections trigger re-extraction.)* **Re-derivation, never mutation.** When the clinician corrects a segment's speaker role or text after extraction, code re-derives each affected PROVISIONAL fact as a **new version**. The new version's origin follows the corrected role (derivation DETERMINISTIC_RULE; never upgraded), and its status stays PROVISIONAL. The old version is kept with `supersededByFactId`, and an AuditEvent ROLE_MAPPING_CHANGED or UPDATED is written. `originProvenance` is never changed in place.
  2. **Confirmed facts are never silently changed.** CONFIRMED facts that the correction affects get `needsClarification = true` with the new reason SOURCE_CHANGED, and return to review.
  3. **Root origin.** Every fact version carries an immutable `rootOriginProvenance`, copied forward from the first version of the chain. The UI shows "Edited by clinician · originally <root origin>".
  4. **No per-fact reattribution.** A source correction is either a segment correction (point 1) or a clinician edit (CLINICIAN_CONFIRMED).
  5. **Cross-segment discontinuation.** A DISCONTINUED status that needs two segments (a question plus an answer) is allowed only as AI_EXTRACTED / AI_INFERENCE, PROVISIONAL, labeled "AI INFERENCE — VERIFY", and only when the medication is named in the cited segments (CS-36). A single-segment explicit statement stays VERBATIM (CS-13).
  6. **Cross-visit conflict scope.** The conflict detector also covers non-rejected PROVISIONAL facts from earlier visits, with their review status shown.
- **Reason:** Provenance must always match the confirmed source, and the original source must stay visible after any edit.
- **Consequences:** DATA_MODEL §3.2/§3.10/§4.5/§5.3/§6/§9, PRODUCT_SPEC FR-22.3, SPEECH §11, CLINICAL-SAFETY §4/§11/§15/§18 (CS-15, CS-36), TESTING S13 and AI.md job 4 are aligned.
- **Future review condition:** None.

## ADR-036 — Evidence Request Identifier Classes, Trial Routing and Result Ordering (refines ADR-028)

- **Status:** ACCEPTED (2026-10-08, Stage A, from agent-team review run 1)
- **Context:** "Never send identifiers" (API_CATALOG §2, PRIVACY §7, ARCHITECTURE §6.4) conflicted with the medication flow, which must send RxCUIs, set IDs, NDCs and application numbers. Several other points were also inconsistent:
  - automatic CANCER_INFO routing could pull NCI trial records, although trials are clinician-requested only
  - ranking ran before deduplication
  - guideline records had two possible groups
  - route names were used as source types
  - the sanitizer's manual and autocomplete paths were not stated
  - the U.S. label condition had three different wordings
- **Decision:**
  1. **Two identifier classes.**
     - *Patient identifiers* (name, DOB, patient reference, dates, locations, contact details, free transcript text) are never sent.
     - *Public product or record identifiers* (RxCUI, SPL set ID, NDC, FDA application number, PMID, NCT, CID) may be sent, but only as typed fields whose values came from a stored, validated provider response, never from transcript or model text.
  2. **One sanitizer for every path.** The on-device sanitizer covers automatic queries, clinician manual searches and terminology autocomplete.
  3. **No automatic trials.** Automatic CANCER_INFO retrieval returns NCI information pages only. Trial records (ClinicalTrials.gov, NCI trials) are retrieved only on clinician request.
  4. **Processing order:** validate → deduplicate (within the result set) → assign tier and group → rank → apply the per-group cap. Older stored versions that a candidate or note cites are kept.
  5. **One home for guidelines.** A literature record whose publication type is a practice guideline belongs to the GUIDELINE group (Tier 2) only.
  6. **Route mapping.** Routes map to EvidenceSourceType through a table in EVIDENCE-SOURCES §17.
  7. *(Amended during Stage A before commit, and refined by ADR-039/ADR-043: RxNorm is labeled "U.S. drug terminology (RxNorm)".)* **U.S. label always shown.** Every FDA and DailyMed record is labeled "U.S. regulatory information", and RxNorm normalizations "U.S. drug terminology (RxNorm)". The app collects no user location.
- **Reason:** Minimum data without breaking the medication flow, plus deterministic and testable presentation.
- **Consequences:** ARCHITECTURE §6.4, API_CATALOG §2/§3/§12–§14/§19/§29, PRIVACY §7, EVIDENCE-SOURCES §2/§4.1/§14/§15/§17, CLINICAL-SAFETY §12, PRODUCT_SPEC FR-17.1 and BUILD_PLAN Phases 11–12 are aligned (completed in the run-2 recheck, ADR-043).
- **Future review condition:** A new identifier type requires a privacy review.

## ADR-037 — Task Tools Enabled for the Agent System on Current Models

- **Status:** ACCEPTED (2026-10-08, Stage A)
- **Context:** The official tools reference (read 2026-10-08, Claude Code v2.1.294) says TaskCreate, TaskGet, TaskList and TaskUpdate are available by default only on older model families. Other models need an opt-in, such as `CLAUDE_CODE_ENABLE_TODO_TOOLS=1`. On the project's lead model they were absent, so:
  - there was no shared task list
  - there was no task dependency
  - the TaskCreated and TaskCompleted quality-gate hooks could never fire
- **Decision:** Set `CLAUDE_CODE_ENABLE_TODO_TOOLS=1` in the project `.claude/settings.json` `env`, next to `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`. In-process teammates receive the Task tools when the lead session has them.
- **Reason:** The orchestration design (AGENT-SYSTEM, QUALITY-GATES hooks) depends on the shared task list.
- **Consequences:** Verified in the Stage A interactive session: after the settings change the Task tools became available to the **lead** without a restart, and the TaskCreated/TaskCompleted hooks fired. However, the teammates spawned afterwards in that same session did **not** receive TaskCreate/TaskUpdate (the `backend` teammate reported this). The lead therefore updated task status on their behalf. Rule: the setting must be in place **before** the lead session starts. It now is, in project settings, so new sessions start with it. Re-check after every Claude Code upgrade (ADR-020).
- **Future review condition:** If the Task tools become default-on, or are replaced.

## ADR-038 — Current Facts, Correction Handling and Candidate Integrity (refines ADR-022, ADR-034, ADR-035)

- **Status:** ACCEPTED (2026-10-08, Stage A, from team run 2: product P2-01/02/03/05/08/09, safety S2-01/03/04/07)
- **Context:** Run 2 found these gaps:
  - "Current fact" was never defined, so rejected or resolved-away facts could reach notes, queries and comparisons.
  - ADR-035's "deterministic re-derivation" was unsafe:
    - after a text correction, code cannot recompute a value or a negation
    - a DOCTOR→PATIENT change on an Assessment would create a PATIENT_REPORTED Assessment
    - a PATIENT→DOCTOR change needs jobs 7–8, which never ran on the segment
  - Validation rules read current provenance, so they would reject every confirmation.
  - An outdated possibility could still be confirmed.
  - A possibility could cite one side of an OPEN conflict as support.
  - The conflict detector would compare an edited fact with its own earlier version.
- **Decision:**
  1. **Current fact** (DATA_MODEL §3.3a; "eligible for automatic input" is added by ADR-043): a fact version with `supersededByFactId` null, status not REJECTED, and `resolvedAwayByConflictId` null. Every automatic input set uses current facts only: notes, job 11, comparisons, derived views and the conflict detector.
  2. **Correction handling** (supersedes ADR-035 decision 1; *amended by ADR-043 decision 4: re-extraction of every cited segment, matching, root-origin reset, no automatic exit without a match*):
     - **Role-only correction that keeps the fact category valid** (e.g. UNKNOWN→PATIENT on a symptom). Code recomputes the provenance with the §8.3 mapping and keeps the original derivation method, so AI_INFERENCE stays AI_EXTRACTED. The result is a new PROVISIONAL version; the old one is superseded.
     - **Any text correction, or a role change that invalidates the category** (e.g. a DOCTOR Assessment now attributed to PATIENT). The affected PROVISIONAL facts are superseded with reason SOURCE_CHANGED, and the changed segments are **re-extracted** through jobs 2–9 and all validators. Re-extraction is offline-safe: until it succeeds, the facts are shown as "Needs clarification — source changed" and are excluded from automatic inputs.
     - **CONFIRMED facts** are never changed. They are flagged SOURCE_CHANGED (CS-15, CS-39).
  3. **Validation applies to `originProvenance`.** The provenance/derivation pairing and the speaker-role rules check `originProvenance` and the creating actor. A confirmation changes only `provenance`. An Assessment confirmed from a candidate has originProvenance = rootOriginProvenance = AI_EXTRACTED, derivation AI_INFERENCE, `sourceSegmentIds` = the union of its supporting facts' segments, `linkedCandidateId` set, provenance CLINICIAN_CONFIRMED, and status CONFIRMED.
  4. **Candidate integrity:**
     - Confirming a candidate requires `outdated = false` and `supersededByRunId` null (CS-43).
     - Facts in an OPEN conflict are never in `supportingFactIds`. The candidate shows "Conflict — review" for them.
     - A newly detected conflict on any referenced fact marks the candidate outdated.
  5. **Conflict detector** compares current facts only and skips fact pairs whose conflict was already resolved or dismissed by the clinician. The pair is re-opened only if one fact gets a new version.
  6. **Visibility of earlier unconfirmed items** (safety S2-03, product refinement). The "Proposed — needs review" list shows current PROVISIONAL items from **all** visits, grouped "From earlier visits — not reviewed" and dated. Only a clinician action removes them. A later CONFIRMED record of the same item removes the earlier mention only when no OPEN conflict links the two (CS-42).
- **Reason:** Corrections, conflicts and confirmations must never let a stale, rejected or misattributed statement reach the record.
- **Consequences:**
  - DATA_MODEL §3.2/§3.3a/§5.3/§5.4/§6/§9/§10 are aligned.
  - AI.md §3 is aligned.
  - PRODUCT_SPEC FR-9.4/FR-18/FR-22.3 are aligned.
  - CLINICAL-SAFETY gains CS-15 (updated), CS-39, CS-42 and CS-43.
  - PRODUCT_SPEC FR-22.3 and SPEECH §11 were aligned in the run-2 recheck (ADR-043).
  - TESTING S13 is updated.
- **Future review condition:** None.

## ADR-039 — Deterministic Evidence Concepts and Routing; Evidence Staleness; Visit-Scoped Cache (refines ADR-028, ADR-034, ADR-036)

- **Status:** ACCEPTED (2026-10-08, Stage A, from team run 2: evidence E2-01/02/04/05/06/14, safety S2-12/S2-14, product P2-04)
- **Context:** Run 2 found these gaps:
  - Job 11, as an LLM job, could emit concepts nobody stated, e.g. "lung cancer" from a symptom cluster. They would surface on the R1 evidence screen as automatic evidence or NCI cards. That is an R2-like suggestion with the flag OFF, and CS-37 would still pass.
  - "No automatic trials" depended on the model's route output.
  - The RxCUI that drives a label lookup was not gated.
  - A cross-visit cache hit would link a bundle to another visit's query and facts.
  - Recalls could be served stale.
  - The S17a disagreement example was removed by deduplication.
  - Evidence went stale after fact review, and a SKIPPED candidate stage had no re-entry.
- **Decision:**
  1. **Job 11 is deterministic code in V1 (no LLM).**
     - Concepts are the `conceptKey` (and normalized name) of eligible current facts.
     - Routes come from the code-owned route table (EVIDENCE-SOURCES §17).
     - AUTOMATIC queries on TRIALS, CHEMICAL or PUBLIC_HEALTH routes are rejected.
     - CANCER_INFO is chosen only for a stated, current POSITIVE fact whose conceptKey is in the cancer concept list.
     - Any LLM-based query expansion needs a new ADR plus a grounding validator (CS-38).
  2. **Card provenance.** Automatic cards show "Retrieved for: <concept> (<information state>)". Manual cards show "Clinician search".
  3. **Label lookup gate.** A DailyMed or openFDA label is fetched only for an RxCUI that is a single exact RxNorm match or that the clinician selected. The RxNorm response itself is schema-validated and stored. Approximate matches never trigger a label (CS-11).
  4. **Visit-scoped cache.**
     - A cache hit from an earlier visit is copied into the current visit as a new EvidenceSource with `cachedFromEvidenceId`, the current visit's `queryId`, and the original `retrievedAt`.
     - REGULATORY_SAFETY records (recalls, enforcement, shortages) are always refetched.
     - Other regulatory records older than 30 days are refetched.
  5. **Closed disagreement rules (S17a).** The marker is shown only for:
     - (a) a recall, enforcement or shortage record for a product whose label card is shown
     - (b) *(narrowed by ADR-043 decision 6 to structural differences: a Boxed Warning or Contraindications section present in one SPL and absent in another)* two different SPL set IDs mapped to the same RxCUI whose same-named label section differs in text

     Literature records are never compared by code; they are shown side by side with no marker.
  6. **Evidence staleness and re-entry** (agreed by product and evidence).
     - Evidence never re-runs automatically.
     - A record shows "Based on facts that changed since retrieval" when **any** of its query's source facts is edited, rejected, superseded or resolved away.
     - A record leaves the citable bundle only when **all** of its query's source facts are REJECTED or resolved away.
     - The clinician can "Re-run evidence search".
     - A SKIPPED candidate stage returns to IN_PROGRESS only by a clinician action after a successful evidence retry.
     - Manual-search results join the bundle. CLINICAL_TRIAL and PUBLIC_HEALTH records are never citable by jobs 12–13.
     - Each candidate stores `evidenceStateAtGeneration` and the failed routes, which are displayed.
- **Reason:** The R1 evidence screen must not become a channel for unstated conditions, and every evidence record must be traceable to this visit's stated facts or a clinician action.
- **Consequences:**
  - Aligned: AI.md §3 (job 11 is now marked "deterministic"), ARCHITECTURE §6.4, EVIDENCE-SOURCES §8/§16/§17, DATA_MODEL §4.14–§4.16/§5.2, API_CATALOG §29, PRODUCT_SPEC FR-17.x/FR-18.x, BUILD_PLAN Phases 11–13.
  - New test CS-38; CS-11 and S17a are updated.
- **Future review condition:** A future LLM query-expansion step.

## ADR-040 — Structured Note Generation and a Phase Schedule for Safety Tests (refines ADR-024)

- **Status:** ACCEPTED (2026-10-08, Stage A, from team run 2: safety S2-02/S2-05/S2-13, product P2-10)
- **Context:**
  - Job 15 returned free text, so no validator could reject an invented diagnosis, plan or exam finding. CS-18 (note part), CS-19 and CS-20 would therefore stay pending forever.
  - Several CS rows were scheduled whole in phases that cannot run all their parts, and CS-19 had no phase.
  - ADR-024's phase list was stale.
- **Decision:**
  1. *(Text rendering superseded by ADR-043 decision 5: job 15 returns no free text; code renders statements from fact values.)* **Job 15 returns structured statements, not prose.**
     - Each statement has `{section, text, sourceFactIds | conflictId | NOT_DISCUSSED marker}`.
     - Validator rule 13 accepts a statement only if its section matches its facts' categories and its numbers and negation match those facts.
     - Code assembles the note text from the validated statements.
     - Any free text the clinician adds afterwards is CLINICIAN_EDIT and is not validated as AI output.
  2. **CS phase schedule.** `CLINICAL-SAFETY.md` §18a lists the lettered parts of each CS row and the phase that runs each part. "Applicable" in Gate 6 means every part scheduled at or before the current phase. A pending part never counts as passing.
  3. **Gate 6 at Phase 18** for export (CS-32 part B).
  4. **The AI completion gate covers Phases 10, 11, 12, 13 and 15** (supersedes the phase list in ADR-024). TESTING §13a gains the minimum area "possibility containment".
  5. **Note regeneration.** `DRAFT|EDITED --clinician regenerate--> DRAFT` creates a new AI_DRAFT version and keeps the old versions. It is never allowed on a FINALIZED note without an amend.
- **Reason:** Every safety requirement must be testable, and testable in the phase that claims it.
- **Consequences:** AI.md §3/§5.1, DATA_MODEL §4.18/§5.5, CLINICAL-SAFETY §18/§18a, QUALITY-GATES Gate 6, BUILD_PLAN Phases 4–18 and TESTING §13a are aligned.
- **Future review condition:** None.

## ADR-041 — Patient-Friendly Explanation (Job 16) Is R2-Gated

- **Status:** ACCEPTED (2026-10-08, Stage A, from team run 2: product P2-07, safety S2-11, evidence E2-07). **Engineering gate, not a legal conclusion.**
- **Context:** Job 16 drafts patient-specific explanatory text. It had no FR, no screen, no regulatory tier, no flag, and no validator for "no new advice".
- **Decision:**
  - Job 16 is treated as **R2**. It sits behind its own flag `patientExplanationEnabled`, default OFF, and follows the same release rule as ADR-025 R2.
  - Its inputs are CONFIRMED facts plus PATIENT_EDUCATION bundle records only.
  - Its validators:
    - every source is cited by evidence ID within the bundle (CS-16 part B)
    - it names no source outside the bundle
    - no dose, treatment, diagnosis or triage wording (code-maintained rule list; CS-44)
  - Its output is a draft for clinician review and is never sent to a patient by the app.
  - PRODUCT_SPEC FR-21.6 defines it.
- **Reason:** Patient-specific explanatory text can drift into advice, so it carries the same gate as possibilities until a formal assessment.
- **Consequences:** AI.md §3, PRODUCT_SPEC FR-21.6, BUILD_PLAN Phase 13, CLINICAL-SAFETY CS-16 part B / CS-44 and IC-019a (flags) are aligned.
- **Future review condition:** The formal regulatory assessment (ADR-025).

## ADR-042 — Backend Non-Clinical State and Server-Side R2 Enforcement (refines ADR-012, ADR-034)

- **Status:** ACCEPTED (2026-10-08, Stage A, from team run 2: backend F-5/F-6/F-8)
- **Context:**
  - The approved 7B plan needs per-user rate-limit counters, which conflicts with the "stateless" wording of ADR-012.
  - `possibilitiesEnabled` was enforced only by the on-device orchestrator.
  - The routing table had no schema.
- **Decision:**
  1. **Stateless means stateless for clinical content.** The backend may persist only non-clinical operational state:
     - rate-limit counters `(opaque user id, endpoint class, window start, count)`, with no content, IP or email, deleted after the longest window plus 24 h and on account deletion
     - the clinician account managed by Supabase Auth (ADR-032)
     - routing and flag configuration
  2. **R2 flags are enforced server-side as well.**
     - `possibilitiesEnabled` and `patientExplanationEnabled` are authoritative in backend configuration, served by the authenticated `/config` endpoint (IC-019a).
     - The app skips the stage when a flag is OFF.
     - The backend LLM endpoint refuses jobs 12, 13 and 16 with `FEATURE_DISABLED` and records no ProviderExecution (CS-37).
  3. **Endpoints:**
     - `/health` is unauthenticated and returns exactly `{status, version}`
     - `/config` is authenticated
     - `/mock-provider` is authenticated and disabled in production
  4. **Routing schema** (API_CATALOG §29, IC-015): per route `enabled`, `primary`, `fallback[]`, `retryMax` (≤1), `timeoutMs`, `trigger` (AUTOMATIC / CLINICIAN_REQUEST_ONLY) and `scope`. An unset route is disabled.
- **Reason:** Defense in depth for the regulatory gate, and honest wording about what the backend stores.
- **Consequences:** ARCHITECTURE §3.5, SECURITY §12, PRIVACY §7, API_CATALOG §29 and INTEGRATION-CONTRACTS IC-015/IC-019a are aligned. DEPLOYMENT backend details follow in Phase 7 (devops).
- **Future review condition:** Any additional server-side state needs an ADR and a privacy review.

## ADR-043 — Code-Owned Concept Keys and Code-Rendered Note Text (refines ADR-038, ADR-039, ADR-040)

- **Status:** ACCEPTED (2026-10-08, Stage A, from the run-2 recheck: safety S2-02/S2-14/S3-01/S3-03/S3-04, evidence E3-01/E3-02/E3-03/E3-05, product P3-01/P3-02)
- **Context:** The recheck showed two HIGH gaps left after ADR-039 and ADR-040:
  - `conceptKey` was still a model output of job 2, so a fact with value "night sweats" and conceptKey "lung cancer" could drive automatic evidence and CANCER_INFO with the R2 flags OFF.
  - Note statements still carried free model text, so "Cough for 3 weeks, likely bronchitis" would pass validator rule 13.

  It also found:
  - facts awaiting re-extraction still counted as current
  - the root origin survived a source correction
  - "Mother had breast cancer" would route to cancer pages for the patient
  - cross-manufacturer label differences would trigger the disagreement marker on almost every drug
  - the trials ban lived only in mutable configuration
- **Decision:**
  1. **Concept keys are computed by code.**
     - `conceptKey` is produced by a deterministic normalization table from the fact's `value` / `normalizedValue`.
     - A key proposed by the model is accepted only if the key, or a code-table synonym, appears in the text of a cited segment.
     - Otherwise the key is `UNMAPPED`: no automatic evidence query, and conflict detection uses exact normalized value only (job-2 validator rule 16; CS-38 part A, Phase 10).
  2. **Automatic evidence eligibility** (job 11). Facts must meet all of the following:
     - eligible for automatic input (rule 3)
     - informationState POSITIVE or UNKNOWN
     - conceptKey not UNMAPPED
     - originProvenance not AI_EXTRACTED unless the fact is CONFIRMED
     - category not HISTORY_FAMILY or HISTORY_SOCIAL

     CANCER_INFO is chosen only from a HISTORY_MEDICAL or ASSESSMENT fact whose conceptKey is in the cancer concept list (CS-38 part B, Phase 12).
  3. **Eligible for automatic input** (DATA_MODEL §3.3a): a current fact that is not flagged `needsClarification` SOURCE_CHANGED. Jobs 11, 12, 14 and 15, the derived views (§10) and the detector use only eligible facts. Facts flagged SOURCE_CHANGED are listed for review, with the note editor indicator.
  4. **Re-extraction scope** (amends ADR-038 decision 2):
     - Re-extraction runs over every segment the affected fact cites.
     - Re-extracted facts are matched to the flagged facts by category + conceptKey. A match supersedes the flagged fact; an unmatched new fact is added as PROVISIONAL.
     - A flagged fact with no match stays flagged until the clinician confirms, edits or rejects it. No automatic exit exists.
     - `sourceSpeakerRole` is recomputed with the role.
     - A source correction **resets the root origin**: `rootOriginProvenance` is the origin of the first version since the last source correction. A patient statement is then never shown as "originally clinician-stated" (CS-15).
  5. **Note text is rendered by code** (supersedes ADR-040 decision 1 in part).
     - Job 15 returns only `{section, order, sourceFactIds | conflictId | notDiscussed}`, with **no free text**. A text field in the output is a validation failure.
     - Code renders each statement from the referenced facts' `value` / `normalizedValue`, information state and provenance, using fixed templates (e.g. "Denies fever (patient-reported)", "Allergies: not discussed").
     - Validator rule 13 checks section/category agreement. Inferential wording can therefore only come from a referenced CLINICIAN_STATED or CONFIRMED assessment or plan fact, verbatim (CS-18 part B, CS-19 part B).
     - Text the clinician types is CLINICIAN_EDIT.
  6. **Disagreement rule (b) narrowed.** The marker is shown only for structural differences: a Boxed Warning or Contraindications section present in one SPL but absent in another for the same RxCUI. At most 3 most-recent SPLs are fetched per RxCUI. A negative S17a fixture covers two labels that differ only in wording (no marker).
  7. **Trial ban is a code constant.** CLINICIAN_REQUEST_ONLY for TRIALS, CHEMICAL and PUBLIC_HEALTH is a constant in both app and backend code. Configuration can only restrict further, never relax it. The device route table decides automatic routes, and the backend re-checks them. A load-time test covers this.
  8. **Location exemption.** The sanitizer's location pattern applies to the patient's own stored data and address-like patterns, not to normalized concept keys ("Lyme disease", "West Nile virus" are allowed).
- **Reason:** No model output may reach the clinician or the evidence screen as unchecked prose or an ungrounded concept.
- **Consequences:**
  - Aligned: DATA_MODEL §3.2/§3.3a/§3.10/§4.5/§4.7/§4.15/§5.2/§5.3/§6/§9/§10, AI.md §3/§5.1, ARCHITECTURE §6.4–§6.6/§7/§8, EVIDENCE-SOURCES §14/§17, API_CATALOG §12–§14/§19/§29, PRODUCT_SPEC §6/FR-18.7/FR-22.3/FR-25.4, SPEECH §11, UI-UX §2 and Screens 4/11, CLINICAL-SAFETY CS-11/CS-15/CS-18/CS-19/CS-23/CS-37/CS-38/CS-41 and §18a, TESTING §6/§15, BUILD_PLAN Phases 10–15.
  - ADR-036 decision 7 and ADR-040 decision 1 carry amendment notes.
- **Future review condition:** None.
- **Amended by ADR-044:** decision 1 (the key is no longer accepted because it appears in a cited segment) and the premise of decision 5 (rendered text is only as safe as the grounded `value`).

## ADR-044 — Deterministic Value Grounding for Extraction Items; Concept Keys from the Fact's Own Value (refines ADR-043; resolves S2-02, S2-14)

- **Status:** ACCEPTED (2026-10-08, Stage A resume, from the clinical-safety-engineer re-check `docs/agent-handoffs/2026-10-08-stage-a-resume-safety.md`)
- **Context:** ADR-043 made job 15 selection-only and had code render note text from fact values, and it had code recompute `conceptKey`. The re-check showed both HIGH channels were still open one step upstream:
  - **S2-02:** a fact's `value` is still free model text. Validator rules 2 and 3 check only numbers and negation, and rule 8 never defined "supported by one segment". A job-2 item `{SYMPTOM, value: "cough for 3 weeks, likely bronchitis", VERBATIM_EXTRACTION}` on the segment "I've had a cough for 3 weeks" passed every rule, so code rendered "likely bronchitis" into the note.
  - **S2-14:** a model-proposed key was kept if it appeared anywhere in a cited segment. For PATIENT "No, I don't have lung cancer, but I've had night sweats.", the fact `{value: "night sweats", conceptKey: "lung cancer"}` passed, and automatic evidence ran "Retrieved for: lung cancer (POSITIVE)" with the R2 flags OFF. The same trick could defeat the family-history exclusion and hide a VALUE_MISMATCH conflict.
- **Decision:**
  1. **Value grounding (validator rule 17, `AI.md` §5.1).** This applies to every text field of every job 2–9 item: `value`, Medication `rawName`/dose/route/frequency/duration, Symptom attributes, and Assessment/Plan/FollowUp text. Comparison uses deterministic normalization only: lower case, collapsed whitespace, punctuation removed, and number words converted by the tested converter of rule 2.
     - (a) **VERBATIM_EXTRACTION / NORMALIZED_EXTRACTION:** the field must be a contiguous span of the normalized text of exactly one cited segment. `normalizedValue` is produced by code, never by the model.
     - (b) **AI_INFERENCE:** every content token (a token not in the code-maintained stopword list) must appear in the normalized text of at least one cited segment, or be the code normalization-table form of a phrase that does.
     - (c) **Inferential, diagnostic and treatment wording.** A word or phrase from the code-maintained rule list ("likely", "probable", "possible", "consistent with", "suggestive of", "rule out", "diagnosis of", "start", "stop", "increase", "decrease", "prescribe", …) is allowed only when it appears verbatim in a cited segment, and for ASSESSMENT and PLAN items only in a cited DOCTOR segment.
     - (d) An item that claims VERBATIM or NORMALIZED but fails (a) is re-labeled AI_INFERENCE (AI_EXTRACTED provenance) only if it passes (b) and (c). Otherwise it is **rejected**. Code never repairs, trims or rewrites a value. After one retry, rejected items are discarded and the stage becomes PARTIAL.
     - Example: "cough for 3 weeks, likely bronchitis" on "I've had a cough for 3 weeks" fails (a). It also fails (b), because "likely" and "bronchitis" are not in the segment, and (c). It is rejected.
  2. **Concept keys come from the fact's own value only** (replaces ADR-043 decision 1).
     - Code applies the normalization table to the fact's `normalizedValue`, or its `value` when there is none.
     - A model-proposed key is kept only when it equals the table's output for that value. Otherwise the table output is used. If the table has no entry, the key is `UNMAPPED`.
     - Segment text is never used to accept a key.
     - Example: "No, I don't have lung cancer, but I've had night sweats." yields `value` "night sweats" and key "night sweats", never "lung cancer".
  3. **Consequence for notes.** Rendered note text consists only of grounded fact values plus fixed code templates, so model wording that is not in the source cannot reach a note (CS-18, CS-19).
  4. **Tests** (owner clinical-safety-engineer; scheduled in `CLINICAL-SAFETY.md` §18a):
     - CS-18 part C and CS-19 part C (job-2 value grounding, Phase 10)
     - a CS-38 part A variant (key versus the fact's own value, with a negated condition in the same segment)
     - CS-29 aligned with decision 1(d)
     - CS-46 (context check: hypothetical and experiencer statements; A in Phase 10, B in Phase 15)
  5. **Deterministic context check** (validator rule 19; added in the same review before commit, from safety finding S4-01/S4-02). Grounded wording can still be wrong if it is lifted out of its context. Code therefore checks the clause that contains the value:
     - negation cue → NEGATIVE required; a NEGATIVE item needs a negation cue in scope
     - hedge cue (now including "unlikely" and "doubt") → UNKNOWN or HEDGED_STATEMENT, checked on the whole clause rather than the model's span
     - hypothetical or conditional cue → never a POSITIVE patient finding (only DOCTOR PLAN/FOLLOW_UP safety-net text)
     - experiencer cue (another person) → only HISTORY_FAMILY or HISTORY_SOCIAL
     - a conditional PLAN/FOLLOW_UP value must include its condition (safety S5-01)
     - question form ("?" or a code-listed question cue, since ASR punctuation is unreliable) → never a POSITIVE or NEGATIVE fact on its own; question plus answer is AI_INFERENCE at most (from the evidence ↔ safety exchange)
     - cues apply to the clause that holds the value, not the whole segment

     Cue lists, scope and tokenization are code-maintained and tested, and cue words are never stopwords. Examples: "If you develop chest pain, come back" produces no POSITIVE chest pain. "My father had lung cancer" produces no patient cancer fact and no CANCER_INFO.
- **Reason:** Every text that a clinician sees as a fact, a note statement or an evidence concept must be traceable word by word to the source, or be produced by tested code.
- **Consequences:** AI.md §3 job 2 and §5.1 rules 8, 16 and 17, plus rule 9 (amended) and rule 19 (context check), and rule 18 (unclear audio → UNCERTAIN_SPEECH, no filled gaps; CS-45, added by clinical-safety-engineer in the same review); DATA_MODEL §3.9, §4.5 and §8.3; CLINICAL-SAFETY CS-18, CS-19, CS-29, CS-38 and §18a; BUILD_PLAN Phase 10.
- **Future review condition:** If value grounding rejects too many legitimate extractions in the Phase 10 evaluation, the stopword and synonym tables are extended by a tested code change. The rule itself is not relaxed without a new ADR and a Gate 6 review.

## ADR-045 — Code-Decided NOT_DISCUSSED, Visible Discards, Keep-and-Flag for Context, Code-Rendered Comparison (refines ADR-040, ADR-043, ADR-044)

- **Status:** ACCEPTED (2026-10-08, Stage A resume, from the product-clinical-architect re-check `docs/agent-handoffs/2026-10-08-stage-a-resume-product.md`: P4-01 HIGH, P4-02 to P4-05)
- **Context:** The product re-check found remaining ways for the AI path to misstate a visit:
  - **P4-01:** job 15's `notDiscussed` marker was chosen by the model and never checked, so code could render "Allergies: not discussed" while a POSITIVE allergy existed.
  - **P4-02:** rule 19 rejected genuine findings, such as PATIENT "If I climb stairs I get chest pain" and a caregiver's "My son has had a fever". Rejected items vanished silently, so with P4-01 a discussed finding could appear as "not discussed".
  - **P4-03:** job 14's comparison wording was the last free model prose shown to the clinician.
  - **P4-04:** re-extraction matching was undefined for UNMAPPED keys.
  - **P4-05:** conditional safety-net advice became a PENDING follow-up.
- **Decision:**
  1. **NOT_DISCUSSED is decided by code.** A job-15 `notDiscussed` marker for a note topic is accepted only when code finds, for that topic in this visit:
     - no fact in any informationState other than NOT_DISCUSSED, whether eligible, flagged or clinician-REJECTED (S6-04)
     - no validation-discarded item

     Otherwise the marker is rejected. When a topic has only discarded or flagged items, code renders "<topic>: see transcript — needs review", never "not discussed". The same check applies to the "Allergies: not discussed" line that code adds itself (CS-04 part D).
  2. **Validation discards are visible.** Every extraction item rejected by a semantic rule (`AI.md` §5.1) is listed on the Clinical Facts screen under "Not extracted — check transcript". Each entry shows the cited segment link, the category and a reason code. The model's wording is not shown. The clinician can enter the fact manually from the segment. Only counts and reason codes are logged, never content.
  3. **Keep-and-flag for context ambiguity** (amends ADR-044 decision 5). An item that passes value grounding (rule 17) but whose clause carries a hypothetical, conditional or experiencer cue that does not fit its category is **kept** with `needsClarification` CONTEXT_UNCLEAR.
     - Its value must include the cue clause span (e.g. "if I climb stairs I get chest pain"; "my son has had a fever").
     - It is PROVISIONAL and **ineligible for automatic input** (`DATA_MODEL.md` §3.3a): no note text, no evidence, no views and no detector, until the clinician confirms, edits or rejects it.
     - Question-only items and ungrounded items stay rejected under decision 2. A value that omits its cue clause is rejected; code never extends a value (S6-04).
     - **Allergy safety exception (S6-01):** an ALLERGY item flagged CONTEXT_UNCLEAR, other than one whose experiencer is another person, is still shown in the positive allergy list with "Needs clarification — context". The allergy status line is then "Allergy status unclear — needs clarification", and "No known allergies"/NKDA is never shown in a view or note while it exists. It remains ineligible for evidence and note statements.
     - **Confirming a flagged fact** requires the clinician to confirm or change its category (with "File as family history" for experiencer items). This clears the flag (`DATA_MODEL.md` §5.3; S6-02).
     - **Finalized notes never silently omit a flagged item.** Code renders a fixed placeholder "<category>: item needs review — see transcript" without value text, and `unreviewedFactCountAtFinalize` counts flagged items (S6-03).
     - Examples: DOCTOR "If you develop chest pain, come back" yields at most a flagged, ineligible item, never a POSITIVE fact in the note or in evidence. PATIENT "My father had lung cancer" filed as HISTORY_MEDICAL is flagged and ineligible, so no CANCER_INFO.
  4. **Caregiver/proxy consultations:** scope is OD-012 (owner). Until it is decided, caregiver-reported patient findings follow decision 3, and a caregiver segment has role OTHER, so its provenance is TRANSCRIPTION.
  5. **Comparison text is rendered by code** (job 14).
     - Job 14 returns only the selection, order and grouping of diff items, with no free text. A text field in the output is a validation failure.
     - Code renders each item with fixed templates. A changed value always shows both stated values and their visit dates.
     - Trend or judgement words ("improved", "worsened", "resolved", "controlled") appear only verbatim from a referenced CLINICIAN_STATED or CONFIRMED fact (CS-24 part B).
  6. **Re-extraction matching for UNMAPPED keys:** category plus identical normalized value. Otherwise the item is unmatched and follows `DATA_MODEL.md` §3.2 rule 8.
  7. **Conditional advice is never a PENDING FollowUp.** Conditional or safety-net advice ("come back if…") is PLAN text that keeps its condition. Job 9 creates a FollowUp only for a definite statement (date, interval or task).
- **Reason:** "Not discussed" must mean "not raised", and nothing discussed may disappear from the clinician's view.
- **Consequences:**
  - AI.md §3 (jobs 9, 14, 15) and §5.1 rules 13, 19 and 20
  - DATA_MODEL §3.2 rule 8, §3.3a, §3.10, §4.15 and §6
  - PRODUCT_SPEC FR-8.9 and FR-16.1
  - UI-UX §2
  - ARCHITECTURE §6.6
  - CLINICAL-SAFETY CS-04 D, CS-24 B and CS-46 (keep-and-flag)
  - BUILD_PLAN Phases 10, 15 and 16
- **Future review condition:** OD-012.

---

## ADR-046 — Encrypted JSON Documents as the Local Clinical Store (supersedes ADR-013)

- **Status:** ACCEPTED (implemented 2026-10-08 in commit `72d96d9`; recorded retrospectively 2026-10-09, M3/M4 session — the implementation preceded this record, which violated the documentation-first rule; corrected here)
- **Context:** ADR-013 chose SQLite, with encryption depending on library support (OD-003). The visit is the unit of work and is always read and written whole; search is small-scale and local.
- **Decision:** One AES-256-GCM-encrypted JSON document per patient and per visit (`data/patients/<P-xxxxxx>/…`), plus encrypted settings, a derived patient index and the public-evidence cache. The 256-bit data key lives in Android Keystore-backed secure storage (expo-secure-store). Writes are atomic (temp file, verify, replace) and serialized. Every document is schema-validated with zod on read and write.
- **Reason:** Encryption without a native SQLCipher dependency (resolves OD-003 for V1). Whole-visit atomic writes match the per-stage persistence rule (CLAUDE.md §11). The schema stays canonical in `src/domain/types.ts`.
- **Consequences:** Search scans decrypted documents in memory (fine for a single clinician's device; revisit at scale). "Delete all local data" removes the files and destroys the key. `allowBackup` is false.
- **Future review condition:** More than ~1,000 visits per device, or cross-patient queries that need indexes.

## ADR-047 — Free-Tier Cloud AI Is Used for Synthetic Demo Visits Only

- **Status:** ACCEPTED (2026-10-09). Engineering privacy gate under the safety restriction principle (ADR-018); not a legal conclusion.
- **Context:** The project owner requires every runtime service to be free, with no paid fallback. The Gemini API free tier was verified on 2026-10-09 (https://ai.google.dev/gemini-api/docs/pricing). All allowlisted backend models (`gemini-3.8-flash`, `gemini-3.7-flash`, `gemini-3.6-flash`, `gemini-3.5-flash`, `gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`, `gemini-3.5-transcribe`) are "Free of charge", **but free-tier content is used to improve Google's products**. PRIVACY §6–§7 require recorded training-use terms and suitable data processing before real patient data is sent. ADR-006 limits development to synthetic data.
- **Decision:**
  1. The app sends audio or transcript text to the backend AI only for visits of patients marked synthetic demo (`isDemo`). The code constant is `FREE_TIER_CONTENT_USED_FOR_TRAINING` in `visitService.ts`.
  2. Real-patient visits use on-device Android speech recognition, deterministic rule-based extraction, manual entry, and public evidence sources (clinical terms only). Temporary audio is not even captured for them.
  3. The UI states the reason ("Cloud AI is used for synthetic demo patients only …"). Privacy and Settings disclose it.
  4. Lifting the gate requires an owner decision: either an AI provider whose data terms exclude training and that has a data-processing agreement for the target market (this conflicts with FREE-ONLY if it is paid), or a documented free alternative with suitable terms.
- **Consequences:** AI-assisted extraction and possibilities are demonstrable only with synthetic patients. Production AI use is BLOCKED on OD-002 plus the owner's free-only vs. data-terms decision.
- **Future review condition:** OD-002; any change in Gemini free-tier data-use terms.

## ADR-048 — V1 Development Provider Choices Under the Free-Only Rule (provisional for OD-001 / OD-002)

- **Status:** PROVISIONAL (2026-10-09). The implementation from commit `c652e57` is recorded here. OD-001 and OD-002 stay OPEN for production.
- **Decision:**
  - **Level 1 live transcript:** the Android `SpeechRecognizer` via expo-speech-recognition, preferring on-device recognition. It is free, holds no key in the app, and the clinician tags the speaker live.
  - **Level 2 final transcript + diarization and AI extraction/possibilities (synthetic only, ADR-047):** the Gemini free tier via Supabase Edge Functions. Keys are held server-side, `FREE_ONLY_MODE` is hard-on, and a 429 maps to QUOTA_EXHAUSTED with no retry on another model and no paid fallback.
  - **Evidence:** keyless public APIs: RxNorm, DailyMed, openFDA, PubMed, Europe PMC, MedlinePlus, ClinicalTrials.gov, PubChem and NLM Clinical Tables. All were live-verified on 2026-10-09 (API_CATALOG §31).
- **Consequences:** No paid provider exists anywhere in the runtime. Diarization for real patients relies on live clinician tagging plus confirmation on the Transcript screen.
- **Future review condition:** OD-001 and OD-002 evaluations on synthetic audio (`SPEECH.md` §14, `AI.md` evaluation set).

## ADR-049 — M3 Application Shell and Workflow Implementation Choices

- **Status:** ACCEPTED (2026-10-09)
- **Decision:**
  1. **Navigation:** Expo Router, with routes in `mobile/src/app`; tabs are Home · Patients · Visits · Settings (UI-UX §2). Onboarding is enforced with `Stack.Protected`.
  2. **Android application id:** `ai.clinnote.app`. It is provisional and may change before the first Play upload (owner).
  3. **Permissions:** RECORD_AUDIO only. Storage, media, location, camera, contacts, phone, SMS and overlay permissions are explicitly blocked. No notification permission is requested (no notifications are implemented).
  4. **Synthetic demo script:** demo patients can run a scripted consultation without a microphone. Its segments are tagged `demo-script`.
  5. **Transcript correction** flags every current fact citing the segment as SOURCE_CHANGED (DATA_MODEL §3.2) and never edits facts. Re-extraction replaces untouched provisional facts only.
  6. **Problem list:** an entry is added only by an explicit clinician action, from a CONFIRMED positive assessment or history fact, or by manual entry (§10.1).
  7. **Export:** PDF (expo-print) or plain text through the share sheet. Draft notes carry "DRAFT — not finalized by clinician". The patient summary uses derived views only. Every export writes an AuditEvent.
  8. **Reference images:** none are shown (no source with a verified reuse license; OD-008).
- **Consequences:** UI-UX Screen 16 (Returning Patient) is part of the Patient Overview. Note type is chosen in the Note Editor rather than on Start Visit. Clinician sign-in (FR-28.4) is not implemented: the backend uses the public anon key and OD-004 is open.

---

# Open Decisions

Statuses: **OPEN** (needs external information, evaluation or a professional/owner decision), **RESOLVED** or **RESOLVED FOR PROJECT PLANNING** (decided by ADR; re-verification noted). Reviewed in full on 2026-10-08 (Stage A).

## OD-001 — Speech Provider

- **Status:** OPEN
- **Why open:** Accuracy, diarization, latency, cost and data terms must be measured on synthetic audio against verified provider terms. That needs provider accounts and keys, which the project owner creates.
- **Information required:** Synthetic-audio evaluation (`SPEECH.md` §14), verified terms, and OD-007.
- **Who decides:** Project owner, on the speech-diarization-engineer's recommendation.
- **When:** Start of Phase 8.

## OD-002 — LLM Provider

- **Status:** OPEN
- **Why open:** Models, structured-output support, pricing and data terms change. Gemini is only the prototype candidate. The decision needs evaluation-set results on the safety corpus (ADR-024).
- **Information required:** Verified provider details, AI evaluation set results, data terms.
- **Who decides:** Project owner, on the ai-clinical-engineer's recommendation, after a Gate 6 review.
- **When:** Start of Phase 10.

## OD-003 — Local Encryption Implementation

- **Status:** RESOLVED FOR PROJECT PLANNING (ADR-031). Re-verify the expo-sqlite and expo-secure-store APIs at Phase 4.

## OD-004 — Backend Authentication

- **Status:** RESOLVED FOR PROJECT PLANNING (ADR-032). Verify the Supabase Auth method at Phase 7.

## OD-005 — Target Regulatory Classification

- **Status:** RESOLVED FOR PROJECT PLANNING (ADR-025). **Not a legal or regulatory determination.**
- **What can proceed:** R0 documentation and R1 reference information (implementation and release, subject to the other gates). R2 possibilities, implementation only, behind a default-off flag, with synthetic data.
- **What cannot proceed:**
  - any release including R2 before a formal assessment
  - any R3 functionality, which is prohibited in V1
- **When formal review is required:** before releasing R2, before implementing R3, and before Phase 24 for any release.
- **Who performs the formal review:** a qualified regulatory affairs professional or legal counsel per target market, engaged by the project owner.
- **Dependency:** target markets (OD-011).

## OD-006 — Data Retention

- **Status:** OPEN
- **Why open:** Medical-record retention obligations vary by jurisdiction and institution. This is a legal question.
- **Already decided (not open):**
  - temporary audio ≤ 24 hours (ADR-014)
  - the backend stores no clinical content (ADR-012)
  - no crash SDK (ADR-030)
- **Open part:** local clinical record retention guidance and backend technical-log retention period.
- **Information required:** OD-011 target markets, and legal advice.
- **Who decides:** Project owner with legal advice.
- **When:** Phase 20; mandatory before Phase 24.

## OD-007 — Supported Consultation Languages

- **Status:** OPEN
- **Why open:** Target clinicians may consult in English, a regional language or code-mixed speech. This is a product and market decision for the owner, and provider support must be verified.
- **Planning default:** Phases 1–7 are language-independent. The Phase 8 provider evaluation assumes English unless the owner says otherwise.
- **Who decides:** Project owner.
- **When:** Before OD-001 (start of Phase 8).

## OD-008 — Reference Image Provider

- **Status:** RESOLVED (ADR-029). V1 shows no reference images.

## OD-009 — Crash Reporting Provider

- **Status:** RESOLVED (ADR-030). V1 has no crash-reporting SDK.

## OD-010 — Commercial License

- **Status:** OPEN
- **Why open:** Proprietary vs open-source is a business decision. The repository is currently PRIVATE (verified 2026-10-08), and without a LICENSE file no rights are granted.
- **Who decides:** Project owner.
- **When:** Before the repository is made public, or before Phase 24, whichever comes first.

## OD-011 — Target Markets

- **Status:** OPEN (new, 2026-10-08)
- **Why open:** The countries ClinNote will be released in determine the regulatory assessment (ADR-025), the privacy law (OD-006) and the suitability of the medication sources (F-04: RxNorm, DailyMed and openFDA cover US products).
- **Information required:** Business decision on initial countries.
- **Who decides:** Project owner.
- **When:** Before Phase 11 (medication intelligence). The formal assessment under ADR-025 needs it before any R2 release.

## OD-012 — Caregiver / Proxy Consultations

- **Status:** OPEN (new, 2026-10-08, Stage A resume)
- **Why open:** In some consultations, a parent or caregiver speaks for the patient (e.g. "My son has had a fever"). Whether V1 supports this, and how such statements map to provenance, is a product and clinical decision.
- **Interim rule (ADR-045 decision 4):** caregiver speech has role OTHER, so its provenance is TRANSCRIPTION. Patient findings reported by a caregiver are kept but flagged CONTEXT_UNCLEAR and ineligible for automatic input until the clinician confirms them.
- **Who decides:** Project owner, on product-clinical-architect's recommendation, with clinical-safety-engineer review.
- **When:** Before Phase 10 (clinical extraction).

## Future Decisions

Record future significant decisions here as new ADRs. Supersede rather than edit accepted ADRs.
