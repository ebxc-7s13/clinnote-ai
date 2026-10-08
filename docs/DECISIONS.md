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

- **Status:** ACCEPTED
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

---

# Open Decisions

These are genuinely unresolved. Regulatory and legal questions are not decided by engineering.

## OD-001 — Speech Provider

- **Why open:** Accuracy, diarization, latency, cost and data terms must be measured and verified.
- **Information required:** Synthetic-audio evaluation (`SPEECH.md` §14); verified terms; OD-007.
- **Who decides:** Project owner, on engineering recommendation.
- **When:** BUILD_PLAN Phase 8 start.

## OD-002 — LLM Provider

- **Why open:** Models, structured-output support, pricing and data terms change; Gemini is the prototype candidate only.
- **Information required:** Verified provider details; AI evaluation set results; data terms.
- **Who decides:** Project owner, on engineering recommendation.
- **When:** BUILD_PLAN Phase 10 start.

## OD-003 — Local Encryption Implementation

- **Why open:** Depends on current Expo SQLite encryption support and key management options.
- **Information required:** Verified library capability; Keystore-backed key storage; performance.
- **Who decides:** Engineering, approved by project owner.
- **When:** Investigated in Phase 4; must be implemented before any build is distributed beyond the developer and no later than Phase 19.

## OD-004 — Backend Authentication

- **Why open:** Choice between app-integrity attestation, clinician accounts, or both affects onboarding and privacy disclosures.
- **Information required:** Verified platform capabilities; whether clinician identity verification is required (OD-005).
- **Who decides:** Project owner.
- **When:** BUILD_PLAN Phase 8 start (first backend endpoint).

## OD-005 — Target Regulatory Classification and Jurisdictions

- **Why open:** Whether ClinNote is a medical device (e.g. CDSCO, FDA, EU MDR) and which privacy laws apply depends on target countries and needs qualified legal/regulatory advice.
- **Information required:** Target countries; regulatory and legal opinion.
- **Who decides:** Project owner with legal/regulatory advisers.
- **When:** Before Phase 14 (recommended) and mandatory before Phase 24.

## OD-006 — Data Retention

- **Why open:** Medical-record retention obligations vary by jurisdiction and institution.
- **Information required:** OD-005 outcome; legal advice.
- **Who decides:** Project owner with legal advice.
- **When:** Phase 20; mandatory before Phase 24.

## OD-007 — Supported Consultation Languages

- **Why open:** Target clinicians may consult in English, regional languages or code-mixed speech.
- **Information required:** Target user research; provider language verification.
- **Who decides:** Project owner.
- **When:** Before OD-001 (Phase 8 start).

## OD-008 — Reference Image Provider

- **Why open:** No legally usable, verified image source selected.
- **Information required:** Candidate sources with verified licenses and API terms.
- **Who decides:** Project owner.
- **When:** Before any image feature (optional part of Phase 12).

## OD-009 — Crash Reporting Provider

- **Why open:** Needs strict scrubbing; candidates not evaluated.
- **Information required:** Verified scrubbing capability and data terms.
- **Who decides:** Engineering, approved by project owner.
- **When:** Phase 19, before preview builds go to testers.

## OD-010 — Commercial License

- **Why open:** Proprietary vs open-source is a business decision.
- **Information required:** Business model and distribution intent.
- **Who decides:** Project owner.
- **When:** Before the repository is made public or Phase 24, whichever is first.

## Future Decisions

Record future significant decisions here as new ADRs. Supersede rather than edit accepted ADRs.
