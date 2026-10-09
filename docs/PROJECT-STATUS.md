# ClinNote AI — Project Status

Single source of truth for current phase and status. Updated from evidence only.

## Current Phase

V1.1 UPGRADE — continuous consultation, transcript reconciliation, structured clinical report, language registry, liquid-glass UI and in-app reminders (ADR-050 – ADR-053). Updated 2026-10-09 from repository evidence (see `docs/BUILD_REPORT.md`). Development build for synthetic data only; not clinically validated; no regulatory approval.

Artifacts: `~/clinnote-artifacts/ClinNote-1.1.0-arm64-v8a-release.apk` (SHA-256 `97cea34a…090401e`) and `ClinNote-1.1.0-release.aab`. Two defects found on the emulator and fixed before release: a data-loss bug when adding a second segment after extraction, and a demo utterance dropped on pause.

## Application Implementation

| Milestone | Status | Evidence |
|---|---|---|
| M1 Domain, encrypted JSON storage, deterministic safety engine | TESTED | commit `72d96d9`; jest safety + storage suites |
| M2 Speech, Gemini backend, evidence adapters, visit pipeline | TESTED (Gemini live call NOT tested: no key exists) | commit `c652e57`; backend 5/5; live evidence 11/11 (re-run 2026-10-09) |
| M3 UI screens and end-to-end workflow | TESTED (jest UI); emulator E2E for 1.0.0 | commits `1874258`, `f4efc06` |
| M4 Tests, audits, Android build, reports | PARTIALLY TESTED (1.0.0 installed by the owner on a phone; owner-reported working) | commits `4eacbe8`, `247d37c`, `84f94aa` |
| V1.1 Multi-segment consultation, reconciliation, report, languages, glass UI, reminders | TESTED in jest (domain + UI) and on the Android 14 emulator (full synthetic acceptance workflow, release build); release APK/AAB built; **not yet tested on a physical device** | `consultation.test.ts` 22, `speech.test.ts` +2, `ui.test.tsx` +3; emulator E2E all PASS; ADR-050 – ADR-053 |

## Status

- Tests (2026-10-09): mobile **150 passed / 0 failed** (11 live tests opt-in; live run 11/11); backend 5/5; `tsc` clean; `expo lint` 0 problems; `expo-doctor` 21/21.
- Languages: English working path unchanged; Telugu, Hindi, Bengali, Tamil, Kannada, Malayalam and Auto-detect are runtime-gated by the device speech service — **IMPLEMENTED BUT NOT VERIFIED ON DEVICE**. Automatic fact extraction remains English-only.
- Privacy gate ADR-047 unchanged: free-tier Gemini only for synthetic demo visits. FREE_ONLY_MODE unchanged; no new paid service; no new permission.
- Production use is BLOCKED by owner decisions: OD-001, OD-002 (+ free-only vs. data terms, ADR-047), OD-004, OD-006, OD-011, the ADR-025 regulatory assessment, Play account and signing.

## Phase Table

| Phase | Name | Status |
|---|---|---|
| 0 | Documentation + multi-agent system | IMPLEMENTED (Stage A complete; owner review pending) |
| 1 | Repository Foundation | PARTIALLY_TESTED (no GitHub Actions CI yet) |
| 2 | Expo and Android Foundation | TESTED (release build + emulator launch) |
| 3 | UI System | PARTIALLY_TESTED (jest UI tests; no device/TalkBack test) |
| 4 | Local Database (encrypted JSON, ADR-046) | TESTED |
| 5 | Patient System | TESTED |
| 6 | Visit System (+ safety test corpus) | TESTED |
| 7 | Recording (+ 7B backend foundation) | PARTIALLY_TESTED (multi-segment recording jest-tested; mocked recognizer; backend not deployed) |
| 8 | Speech | PARTIALLY_TESTED (Android recognizer mocked; Gemini transcription not live-tested) |
| 9 | Speaker Diarization | PARTIALLY_TESTED (live tagging + clinician mapping tested; Gemini diarization mocked) |
| 10 | Clinical Extraction | TESTED (rule-based); AI path tested with mocks only |
| 11 | Medication Intelligence | TESTED (RxNorm/DailyMed/openFDA live) |
| 12 | Evidence Engine | TESTED (9 public sources live) |
| 13 | AI Reasoning (R2 possibilities) | IMPLEMENTED behind default-off dev flag; mock-tested; release BLOCKED (ADR-025) |
| 14 | Clinical Review | TESTED |
| 15 | Note Generation (+ structured report, ADR-051) | TESTED |
| 16 | Longitudinal Memory | TESTED |
| 17 | Follow-Up | PARTIALLY_TESTED |
| 18 | Export | PARTIALLY_TESTED (rendering/audit tested; PDF + share sheet need a device) |
| 19 | Security | PARTIALLY_TESTED (secret/permission audit; no dependency CVE triage) |
| 20 | Privacy | PARTIALLY_TESTED (provider table still has VERIFY entries) |
| 21 | Testing | PARTIALLY_TESTED (no device/E2E-on-device tests) |
| 22 | Performance | PARTIALLY_TESTED (Node-only timings; no device measurements) |
| 23 | Android Build | TESTED for debug-signed APK/AAB + emulator E2E; Play-signed AAB BLOCKED (owner credentials) |
| 24 | Google Play | BLOCKED (owner: Play account, upload key, Data Safety, regulatory assessment) |
| 25 | Final Release Audit | NOT_STARTED |

## Allowed Status Values

Phases: NOT_STARTED · IN_PROGRESS · IMPLEMENTED · TESTED · PARTIALLY_TESTED · BLOCKED · FAILED.
Findings: OPEN · IN_PROGRESS · RESOLVED · BLOCKED.

"RESOLVED" for a specification finding means:
1. the specification is decided and consistent across documents
2. an ADR records the decision
3. the behavior tests are defined
4. the documentation audit passes

The behavior tests themselves run when the implementing phase exists. Until then their result is **PENDING (no implementation)**, which is never reported as passing.

---

## Stage A Findings F-01 … F-14

Original text: the 2026-10-08 dry run (`docs/agent-handoffs/2026-10-08-dry-run-chief-architect.md`, consolidated concerns 1–16), as recorded in this file at commit `63e1a19`. The documentation audit referenced below is `TEST RESULT: Stage A audit` (see "Last Verification").

### F-01

- **FINDING:** F-01. Evidence retrieval and possibility generation run in an inconsistent order.
- **DESCRIPTION:** Evidence and possibility generation ran in a different order in AI.md job 11, DATA_MODEL §4.15, ARCHITECTURE §6.4 and BUILD_PLAN P12/P13. As a result, the CS-16 gate could pass before synthesis existed. Visit also had no candidate stage state.
- **AFFECTED DOCUMENTS:** PRODUCT_SPEC §6/FR-17/FR-18, ARCHITECTURE §6.4/§8, AI.md §3, EVIDENCE-SOURCES §17, DATA_MODEL §4.2/§4.14/§4.15/§5.2, BUILD_PLAN Phases 11–13, TESTING §13a.
- **ROOT CAUSE:** No document was designated as the canonical pipeline order, and job 11 was specified to take candidates while the architecture built queries from facts.
- **DECISION:**
  - Canonical order: facts → concepts → queries → retrieval → validation → dedup/rank → storage → [R2] candidates → supporting / contradicting / missing → citations ⊆ bundle → synthesis → clinician review (ADR-023).
  - Stage gating (ADR-034): candidates only with the flag ON and a non-empty citable bundle; never from facts alone; notes never consume candidates.
  - Job 11 is deterministic and grounded in stated facts (ADR-039).
  - Visit has `candidateState`.
- **FILES CHANGED:** docs/PRODUCT_SPEC.md, docs/ARCHITECTURE.md, docs/AI.md, docs/EVIDENCE-SOURCES.md, docs/DATA_MODEL.md, docs/BUILD_PLAN.md, docs/TESTING.md, docs/DECISIONS.md.
- **TEST REQUIRED:**
  - pipeline-order and gating tests (TESTING §13a)
  - CS-16, CS-32, CS-33, CS-37, CS-38 (CLINICAL-SAFETY §18a schedule)
- **TEST RESULT:**
  - documentation audit PASS (the same order is referenced in all six documents)
  - team review run 2 confirmed the order is consistent
  - behavior tests PENDING (no implementation; Phases 12–13)
- **OWNER:** chief-architect (with ai-clinical-engineer, evidence-research-engineer, data-engineer).
- **STATUS:** RESOLVED

### F-02

- **FINDING:** F-02. Labels are displayed before identifier validation exists.
- **DESCRIPTION:** The P11 Medication Information screen showed label IDs before the P12 identifier validation (CS-17) existed.
- **AFFECTED DOCUMENTS:** BUILD_PLAN Phases 11–12, EVIDENCE-SOURCES §9, CLINICAL-SAFETY CS-17/§18a.
- **ROOT CAUSE:** The adapter validation foundation was planned in the phase after its first consumer.
- **DECISION:**
  - The evidence foundation moves into Phase 11 task 1a (IC-010 frozen, EvidenceSource persistence, response-schema validation, identifier-origin check, sanitizer). Labels are displayed only after the 1a validation passes.
  - Labels are fetched only for an exact or clinician-selected RxNorm match (ADR-039).
- **FILES CHANGED:** docs/BUILD_PLAN.md, docs/DECISIONS.md (ADR-023, ADR-039), docs/CLINICAL-SAFETY.md.
- **TEST REQUIRED:** CS-17 and CS-11 (label-lookup gate) in Phase 11.
- **TEST RESULT:** documentation audit PASS; behavior tests PENDING (no implementation; Phase 11).
- **OWNER:** evidence-research-engineer (with clinical-safety-engineer, qa-test-engineer).
- **STATUS:** RESOLVED

### F-03

- **FINDING:** F-03. Medication wording sent to providers was ambiguous.
- **DESCRIPTION:** API_CATALOG §19 "raw medication wording" was ambiguous against PRIVACY §7, which forbids sending transcript text. P11 had no identifier-free test, and the spec did not say where the check runs.
- **AFFECTED DOCUMENTS:** API_CATALOG §2/§19, PRIVACY §7, ARCHITECTURE §5/§6.4, DATA_MODEL §4.7/§4.15, PRODUCT_SPEC FR-17.1, BUILD_PLAN Phases 11–12, INTEGRATION-CONTRACTS IC-018.
- **ROOT CAUSE:** "Identifier" was not split into patient identifiers and public product identifiers, and the sanitizer's location and scope were undefined.
- **DECISION:**
  - An on-device sanitizer runs on every path: automatic, manual and autocomplete.
  - Only the sanitized drug term leaves the device. `rawName` and transcript text never do.
  - Patient identifiers are never sent. Public product/record identifiers are sent only as typed values from validated responses (ADR-036).
  - Short numbers inside clinical terms are allowed, and rejections are explained.
- **FILES CHANGED:** docs/API_CATALOG.md, docs/PRIVACY.md, docs/ARCHITECTURE.md, docs/DATA_MODEL.md, docs/PRODUCT_SPEC.md, docs/BUILD_PLAN.md, docs/INTEGRATION-CONTRACTS.md, docs/DECISIONS.md.
- **TEST REQUIRED:** sanitizer tests (no rawName, transcript text or patient identifiers sent); evidence-query privacy test (TESTING §9).
- **TEST RESULT:** documentation audit PASS; behavior tests PENDING (no implementation; Phases 11–12).
- **OWNER:** security-privacy-engineer + evidence-research-engineer.
- **STATUS:** RESOLVED

### F-04

- **FINDING:** F-04. US-only medication sources have no jurisdiction gate.
- **DESCRIPTION:** The US-only medication sources had no jurisdiction gate. The proposal was to move OD-005's recommended gate to Phase 13.
- **AFFECTED DOCUMENTS:** DECISIONS (ADR-025, OD-005, OD-011), API_CATALOG §3/§19, EVIDENCE-SOURCES §4.1, CLINICAL-SAFETY §12, BUILD_PLAN Phases 11/13/24, QUALITY-GATES Gate 10.
- **ROOT CAUSE:** Target markets and regulatory scope were never separated from the provider choice.
- **DECISION:**
  - The intended-use gate (ADR-025) puts R2 behind a default-off flag, with no release before a formal assessment.
  - Target markets become OD-011, required before Phase 11.
  - FDA and DailyMed records are always labeled "U.S. regulatory information", and RxNorm "U.S. drug terminology (RxNorm)" (ADR-036).
  - Non-US products show "no US reference match", with no forced match.
- **FILES CHANGED:** docs/DECISIONS.md, docs/API_CATALOG.md, docs/EVIDENCE-SOURCES.md, docs/CLINICAL-SAFETY.md, docs/BUILD_PLAN.md, docs/QUALITY-GATES.md.
- **TEST REQUIRED:** label display tests (Phase 11); CS-37 (R2 gate).
- **TEST RESULT:** documentation audit PASS; behavior tests PENDING (no implementation). The owner decision on markets is tracked as OD-011 (OPEN; it does not block Phase 1).
- **OWNER:** project owner (OD-011), chief-architect (specification).
- **STATUS:** RESOLVED

### F-05

- **FINDING:** F-05. A Phase 14 criterion needs Phase 15 work.
- **DESCRIPTION:** Phase 14 completion required "edit the generated note", which is Phase 15 work.
- **AFFECTED DOCUMENTS:** BUILD_PLAN Phases 14–15, PRODUCT_SPEC §12.
- **ROOT CAUSE:** Success criteria were mapped to phases without checking feature availability.
- **DECISION:**
  - Phase 14 covers success criteria 5, 6 (R1 evidence review) and 8. Criterion 7 moves to Phase 15.
  - Reviewing possibilities (R2) is not a release criterion.
- **FILES CHANGED:** docs/BUILD_PLAN.md, docs/PRODUCT_SPEC.md.
- **TEST REQUIRED:** Phase 14 and Phase 15 E2E against the success criteria.
- **TEST RESULT:** documentation audit PASS; behavior tests PENDING (no implementation).
- **OWNER:** chief-architect.
- **STATUS:** RESOLVED

### F-06

- **FINDING:** F-06. Provenance derivation is inconsistent.
- **DESCRIPTION:** Provenance derivation was inconsistent in three places: the UNKNOWN role, manual CLINICIAN_STATED vs CLINICIAN_CONFIRMED, and editing a PROVISIONAL fact.
- **AFFECTED DOCUMENTS:** DATA_MODEL §3.2/§3.3a/§3.9/§5.3/§6/§8, PRODUCT_SPEC §5/FR-8.6/FR-22.3/FR-23.3, CLINICAL-SAFETY §4/§15/§17, AI.md §6, SPEECH §10–§11, BUILD_PLAN Phases 6/9/10, TESTING.
- **ROOT CAUSE:** Provenance was restated in several documents with different rules, and there was no immutable record of origin.
- **DECISION:** A single authoritative model in DATA_MODEL §3.2 and §8 (ADR-021, refined by ADR-035 and ADR-038):
  - code assigns provenance from the clinician-confirmed speaker role and the derivation, never the model
  - originProvenance and rootOriginProvenance are immutable
  - UNKNOWN or OTHER role → TRANSCRIPTION
  - manual entry → CLINICIAN_CONFIRMED
  - edits create new versions
  - correction handling: a role-only change recomputes provenance and keeps the derivation; a text change triggers re-extraction; confirmed facts are flagged SOURCE_CHANGED
  - validation applies to originProvenance
  - resume session:
    - a source correction resets the root origin (ADR-043)
    - extraction values must be grounded in the cited segment text, and the context check covers negation, hedges, hypotheticals, other people and questions (ADR-044)
    - context-unclear items are kept but flagged (ADR-045)
    - the layered summary (source type / derivation / information status / confirmation / lifecycle / traceability) is at the top of DATA_MODEL §3
- **FILES CHANGED:** docs/DATA_MODEL.md, docs/PRODUCT_SPEC.md, docs/CLINICAL-SAFETY.md, docs/AI.md, docs/SPEECH.md, docs/BUILD_PLAN.md, docs/TESTING.md, docs/DECISIONS.md, CLAUDE.md, .claude/rules/clinical-safety.md.
- **TEST REQUIRED:** CS-15, CS-18 C, CS-19 C, CS-29, CS-31, CS-34, CS-39, CS-40, CS-45, CS-46; S4, S10, S13.
- **TEST RESULT:** documentation audit PASS; behavior tests PENDING (no implementation; Phases 4 and 10).
- **OWNER:** data-engineer (with clinical-safety-engineer, product-clinical-architect).
- **STATUS:** RESOLVED

### F-07

- **FINDING:** F-07. MEASURED could be assigned to AI output.
- **DESCRIPTION:** An AI-extracted fact was labeled MEASURED, with no rule for deriving MEASURED.
- **AFFECTED DOCUMENTS:** DATA_MODEL §3.2/§3.9/§6, PRODUCT_SPEC §5.2/§5.4, CLINICAL-SAFETY §4/CS-31, AI.md §6, TESTING S4.
- **ROOT CAUSE:** "Measured" was used both for "a number was spoken" and for "a device or clinician measured it".
- **DECISION:**
  - MEASURED comes only from clinician measurement entry (derivation MANUAL_ENTRY).
  - A spoken reading is CLINICIAN_STATED or PATIENT_REPORTED.
  - AI never assigns MEASURED, EXTERNAL_SOURCE or CLINICIAN_CONFIRMED (ADR-021).
- **FILES CHANGED:** docs/DATA_MODEL.md, docs/PRODUCT_SPEC.md, docs/CLINICAL-SAFETY.md, docs/AI.md, docs/TESTING.md, docs/DECISIONS.md.
- **TEST REQUIRED:** CS-31, S4.
- **TEST RESULT:** documentation audit PASS; behavior tests PENDING (no implementation; Phase 10).
- **OWNER:** clinical-safety-engineer (with data-engineer, ai-clinical-engineer).
- **STATUS:** RESOLVED

### F-08

- **FINDING:** F-08. Clarification and conflict had no data representation.
- **DESCRIPTION:** The clarification flag and the "Conflict — review" marker had no data field and no job that produced them, so CS-14, S11, S12 and S22 could not be satisfied as written.
- **AFFECTED DOCUMENTS:** DATA_MODEL §3.10/§4.5/§4.21/§5.7/§9, AI.md §3 job 2, CLINICAL-SAFETY §14/CS-14/CS-26–CS-28/CS-42, PRODUCT_SPEC FR-8.7/FR-8.8, UI-UX Screen 10.
- **ROOT CAUSE:** The safety rules were written before the data model supported them.
- **DECISION:** An explicit contradiction model (ADR-022, refined by ADR-038):
  - the FactConflict entity, with types SELF_CORRECTION / SPEAKER_DISAGREEMENT / BLANKET_VS_SPECIFIC / VALUE_MISMATCH / CROSS_VISIT
  - `needsClarification` + `clarificationReason`
  - both observations are kept; a later statement supersedes only after the clinician resolves the conflict
  - a positive allergy is never hidden
  - the detector compares facts eligible for automatic input only (ADR-043)
  - `needsClarification` CONTEXT_UNCLEAR for conditional or other-person statements: kept, ineligible, and never hiding a positive allergy (ADR-045)
- **FILES CHANGED:** docs/DATA_MODEL.md, docs/AI.md, docs/CLINICAL-SAFETY.md, docs/PRODUCT_SPEC.md, docs/UI-UX.md, docs/TESTING.md, docs/DECISIONS.md.
- **TEST REQUIRED:** CS-14, CS-26, CS-27, CS-28, CS-42; S11, S12, S22.
- **TEST RESULT:** documentation audit PASS; behavior tests PENDING (no implementation; Phases 4 and 10).
- **OWNER:** data-engineer (with ai-clinical-engineer, clinical-safety-engineer).
- **STATUS:** RESOLVED

### F-09

- **FINDING:** F-09. The safety corpus arrived too late.
- **DESCRIPTION:** No task built the synthetic corpus, the CS harness or the AI evaluation set before Phase 8.
- **AFFECTED DOCUMENTS:** BUILD_PLAN rule 8 and Phase 6, TESTING §13a, AI.md §15, QUALITY-GATES Gate 6, CLINICAL-SAFETY §18/§18a.
- **ROOT CAUSE:** The safety tests were consolidated in Phase 21 instead of preceding the AI work.
- **DECISION:**
  - The safety test corpus and harness are built in Phase 6 by clinical-safety-engineer and qa-test-engineer (ADR-024).
  - No AI or AI-adjacent phase (10, 11, 12, 13, 15) completes without the corpus and Gate 6 PASS.
  - The per-phase CS schedule is in §18a (ADR-040).
  - The corpus covers 21 minimum areas (`CLINICAL-SAFETY.md` §18 coverage table, mirrored in `TESTING.md` §13a):
    - statement types: negation, not discussed, unknown information, uncertain speech (hedged and unclear audio)
    - provenance: speaker provenance, patient reported, clinician stated, clinician confirmed
    - medication: medication ambiguity, dose preservation
    - allergy state
    - contradiction, corrected statement, superseded statement
    - AI inference
    - fake citation, fake PMID, fake FDA record
    - reference-image misuse
    - evidence filtering
    - possibility containment
  - The matrix is CS-01…CS-46; the resume session added CS-45 and CS-46.
- **FILES CHANGED:** docs/BUILD_PLAN.md, docs/TESTING.md, docs/AI.md, docs/QUALITY-GATES.md, docs/CLINICAL-SAFETY.md, docs/DECISIONS.md.
- **TEST REQUIRED:** corpus harness self-tests (Phase 6).
- **TEST RESULT:** documentation audit PASS (the coverage table maps every minimum area to CS IDs); behavior tests PENDING (no implementation; Phase 6).
- **OWNER:** clinical-safety-engineer + qa-test-engineer (chief-architect added the task).
- **STATUS:** RESOLVED

### F-10

- **FINDING:** F-10. "Finalize ≠ confirm" was untested.
- **DESCRIPTION:** "Finalize ≠ confirm" had no CS row or test. P15 omitted the AI-draft label and the unreviewed-facts indicator.
- **AFFECTED DOCUMENTS:** CLINICAL-SAFETY CS-25, DATA_MODEL §4.17/§4.18/§5.5, ARCHITECTURE §6.5, UI-UX Screen 14, BUILD_PLAN Phases 6/15, PRODUCT_SPEC FR-21.3/FR-23.2.
- **ROOT CAUSE:** The rule existed only as prose, and the old finalize-button and note-source naming blurred it.
- **DECISION:**
  - CS-25 is added (Phase 6 manual path, Phase 15 AI draft).
  - Note versions use CLINICIAN_FINALIZED, and the button is "Finalize note".
  - The AI draft is labeled "AI draft — review before finalizing", with an unreviewed-facts indicator (ADR-024, ADR-040).
- **FILES CHANGED:** docs/CLINICAL-SAFETY.md, docs/DATA_MODEL.md, docs/ARCHITECTURE.md, docs/UI-UX.md, docs/BUILD_PLAN.md, docs/PRODUCT_SPEC.md, docs/DECISIONS.md.
- **TEST REQUIRED:** CS-25 parts A and B.
- **TEST RESULT:** documentation audit PASS (no "Confirm and finalize" or CLINICIAN_CONFIRMED note source remains); behavior tests PENDING (no implementation; Phases 6 and 15).
- **OWNER:** clinical-safety-engineer (with mobile-android-engineer, qa-test-engineer).
- **STATUS:** RESOLVED

### F-11

- **FINDING:** F-11. Derived views had no rule.
- **DESCRIPTION:** "Active problems" and "current medications" had no derivation rule.
- **AFFECTED DOCUMENTS:** DATA_MODEL §10.1–§10.4, PRODUCT_SPEC FR-9.3/FR-9.4, UI-UX Screen 4.
- **ROOT CAUSE:** The profile screen was specified before the data rules behind it.
- **DECISION:**
  - Active problems come from the clinician-curated problem list only.
  - Current medications are the most recent CONFIRMED record per medication with status CURRENT. Absence never discontinues a medication.
  - The allergy status lines are defined in §10.3.
  - "Proposed — needs review" shows PROVISIONAL items from all visits (ADR-038).
- **FILES CHANGED:** docs/DATA_MODEL.md, docs/PRODUCT_SPEC.md, docs/UI-UX.md, docs/DECISIONS.md.
- **TEST REQUIRED:** CS-04, CS-12, CS-41, CS-42.
- **TEST RESULT:** documentation audit PASS; behavior tests PENDING (no implementation; Phases 4–5).
- **OWNER:** product-clinical-architect + data-engineer.
- **STATUS:** RESOLVED

### F-12

- **FINDING:** F-12. Cloud processing and onboarding had no requirement.
- **DESCRIPTION:** Cloud-AI on/off and the onboarding acknowledgement had no FR and no phase.
- **AFFECTED DOCUMENTS:** PRODUCT_SPEC Features 27–28, DATA_MODEL §4.24/§5.1/§6, UI-UX Screens 1/6/18, BUILD_PLAN Phases 3 and 7, IC-019b.
- **ROOT CAUSE:** Privacy controls were described in PRIVACY but not turned into product requirements.
- **DECISION:**
  - FR-27.x defines onboarding and the processing disclosure.
  - FR-28.x defines the cloud-processing toggle (default OFF until acknowledged; OFF means nothing leaves the device, including evidence search) and the sign-in requirement for cloud stages.
  - These are built in Phase 3 (toggle) and Phase 7 (sign-in).
- **FILES CHANGED:** docs/PRODUCT_SPEC.md, docs/DATA_MODEL.md, docs/UI-UX.md, docs/BUILD_PLAN.md, docs/INTEGRATION-CONTRACTS.md.
- **TEST REQUIRED:** Phase 3 and Phase 7 recording-gate tests (consent + cloud processing + sign-in).
- **TEST RESULT:** documentation audit PASS; behavior tests PENDING (no implementation).
- **OWNER:** product-clinical-architect (with ux-accessibility-engineer, security-privacy-engineer).
- **STATUS:** RESOLVED

### F-13

- **FINDING:** F-13. Evidence ranking, deduplication, tiers, routing and caching were undefined.
- **DESCRIPTION:** Evidence ranking and deduplication were undefined, NCI was listed in two tiers, the routing table had gaps, and the cache location and freshness integrity were unspecified.
- **AFFECTED DOCUMENTS:** EVIDENCE-SOURCES §2/§8/§14–§17, API_CATALOG §2/§29, ARCHITECTURE §3.5/§6.4, DATA_MODEL §4.16.
- **ROOT CAUSE:** Evidence presentation was described qualitatively, and tiers were assigned per provider.
- **DECISION:** ADR-028, refined by ADR-036 and ADR-039:
  - tier per record by content type
  - deterministic validate → dedup → tier/group → rank → cap
  - closed disagreement rules
  - visit-scoped, on-device cache with the original `retrievedAt`, and recalls always refetched
  - no backend cache
  - a complete routing table with a schema (ADR-042), keyed by FactCategory, with every unlisted category getting no automatic route (EVIDENCE-SOURCES §17, resume session)
  - the "Fact participation in automatic evidence retrieval" table (DATA_MODEL §4.15)
  - no automatic trials
- **FILES CHANGED:** docs/EVIDENCE-SOURCES.md, docs/API_CATALOG.md, docs/ARCHITECTURE.md, docs/DATA_MODEL.md, docs/DECISIONS.md.
- **TEST REQUIRED:** ranking and dedup unit tests; cache freshness test; S16, S17a; CS-38.
- **TEST RESULT:** documentation audit PASS; behavior tests PENDING (no implementation; Phase 12).
- **OWNER:** evidence-research-engineer (with backend-api-engineer, security-privacy-engineer).
- **STATUS:** RESOLVED

### F-14

- **FINDING:** F-14. The backend foundation depended on the speech decision.
- **DESCRIPTION:** The backend scaffold was tied to the OD-001 speech decision, so a slip in OD-001 would block P10–P12.
- **AFFECTED DOCUMENTS:** BUILD_PLAN Phases 7–8, AGENT-TASK-GRAPH, INTEGRATION-CONTRACTS IC-004/IC-013/IC-015/IC-019a.
- **ROOT CAUSE:** A false dependency between the backend foundation and the provider choice.
- **DECISION:**
  - The backend foundation moves to Phase 7 task group 7B (ADR-026), with auth per ADR-032.
  - Non-clinical state and server-side R2 enforcement follow ADR-042.
  - Phase 8 adds only the speech token/proxy endpoint.
- **FILES CHANGED:** docs/BUILD_PLAN.md, docs/AGENT-TASK-GRAPH.md, docs/INTEGRATION-CONTRACTS.md, docs/ARCHITECTURE.md, docs/SECURITY.md, docs/PRIVACY.md, docs/DECISIONS.md.
- **TEST REQUIRED:** 7B backend tests (auth, validation, rate limit, no body logging, flag refusal).
- **TEST RESULT:**
  - documentation audit PASS
  - backend plan for 7B approved by the lead in the Stage A plan-approval test (v1 rejected, v2 approved)
  - behavior tests PENDING (no implementation; Phase 7)
- **OWNER:** chief-architect + backend-api-engineer.
- **STATUS:** RESOLVED

### F-15, F-16 (fixed before Stage A)

F-15 (AGENT-TASK-GRAPH order and references) and F-16 (concurrent sessions in one working tree; AGENT-RUNBOOK §7) were FIXED on 2026-10-08 before Stage A.

### Minor items (dry run)

All four are resolved:
- Screen 8 "provisional salient phrases": removed (ADR-027).
- Appointment: reserved, not implemented in V1 (DATA_MODEL §1, PRODUCT_SPEC §11).
- Visits screen: UI-UX Screen 21.
- Draft exports are marked as drafts: FR-26.5.

## Stage A Residual Findings (agent-team review)

- **Team run 1:** interrupted by a session limit. It found residual conflicts in the first reconciliation:
  - product P-01…P-12
  - evidence 1–12
  - safety H1–H4, M1–M8, L1–L6

  These were fixed by ADR-034, ADR-035 and ADR-036.
- **Team run 2:** found new residual conflicts:
  - product P2-01…P2-15
  - evidence E2-01…E2-14
  - safety S2-01…S2-14 (safety's Gate 6 documentation verdict was FAIL)
  - backend contract findings F-1…F-8

  These were fixed by ADR-038 to ADR-042. The run-2 re-checks found S2-02 and S2-14 (HIGH) only partly fixed, plus S3, E3 and P3 residuals. ADR-043 followed, but the session ended before the synthesis.
- **Resume session (2026-10-08):** staged single-agent reviews (Tasks C2, B2, A2) found:
  - S2-02 and S2-14 still open
  - new HIGH S4-01 (= E4-01), P4-01 and S6-01
  - MEDIUM/LOW S4-02, S5-01, E4-02…E4-07, P4-02…P4-08 and S6-02…S6-04

  All are resolved by ADR-044 and ADR-045, plus wording fixes. P4-08 is an accepted trade-off. Task D (integration conclusion) is complete. Every finding's disposition is in `docs/agent-handoffs/2026-10-08-stage-a-team2-synthesis.md` §3.

## Open Decisions

| ID | Status | Needed by | Decision-maker | Why still open |
|---|---|---|---|---|
| OD-001 Speech provider | OPEN | start of Phase 8 | project owner, on speech-diarization-engineer's recommendation | needs synthetic-audio evaluation with provider accounts and keys, which only the owner can create |
| OD-002 LLM provider | OPEN | start of Phase 10 | project owner, on ai-clinical-engineer's recommendation after Gate 6 evaluation | needs evaluation-set results on the safety corpus and verified data terms |
| OD-003 Local encryption | RESOLVED FOR PROJECT PLANNING (ADR-031) | re-verify at Phase 4 | — | — |
| OD-004 Backend auth | RESOLVED FOR PROJECT PLANNING (ADR-032) | verify the sign-in method at Phase 7 | — | — |
| OD-005 Regulatory classification | RESOLVED FOR PROJECT PLANNING (ADR-025; engineering gate, **not** a legal determination) | formal assessment before any R2 release, before any R3 implementation, and before Phase 24 | qualified regulatory affairs professional or legal counsel per target market, engaged by the project owner | — |
| OD-006 Data retention | OPEN | Phase 20; mandatory before Phase 24 | project owner with legal advice | jurisdiction-specific legal question |
| OD-007 Consultation languages | OPEN | before OD-001 (start of Phase 8) | project owner | product and market decision; provider support must be verified |
| OD-008 Reference images | RESOLVED (ADR-029: none in V1) | — | — | — |
| OD-009 Crash reporting | RESOLVED (ADR-030: no SDK in V1) | — | — | — |
| OD-010 Commercial license | OPEN | before the repo is public or Phase 24 | project owner | business decision |
| OD-011 Target markets | OPEN | before Phase 11 | project owner | business decision; drives the regulatory assessment, privacy law and medication-source suitability |
| OD-012 Caregiver / proxy consultations | OPEN (new) | before Phase 10 | project owner, on product-clinical-architect's recommendation | product and clinical scope decision; interim rule in ADR-045 decision 4 |

## Current Blockers

- **Phase 1 (Repository Foundation):** none. It waits only for the owner's explicit instruction.
- **Future owner decisions:** OD-007 → OD-001 (Phase 8), OD-002 and OD-012 (Phase 10), OD-011 (Phase 11), OD-006 (Phase 20), OD-010 (before public/Phase 24), and the ADR-025 formal regulatory assessment (before any R2 release and Phase 24).
- **Provider verification:** no provider in `API_CATALOG.md` is verified for implementation yet (each is verified at the start of its phase).

## Agent System (Stage A results)

See `docs/AGENT-STATUS.md` and `docs/agent-handoffs/2026-10-08-stage-a-team2-synthesis.md`.

## Next Task

1. The project owner reviews Stage A (this file, `BUILD_REPORT.md`, ADR-021 to ADR-045, OD-012, the team-2 synthesis).
2. On explicit instruction: BUILD_PLAN Phase 1 — Repository Foundation (devops-android-release-engineer). **Not started.**

## Last Verification

See `BUILD_REPORT.md` "Tests run" (Stage A resume, 2026-10-08): the cross-reference audit, 23/23 hook unit tests, live hook probes, the secret scan, and the application-artifact scan.

## Last Commit

See `git log`; the Stage A commit is `docs: complete ClinNote Stage A specification reconciliation`.

---

PHASE:
STAGE A — SPECIFICATION RECONCILIATION

FINDINGS:
F-01 RESOLVED · F-02 RESOLVED · F-03 RESOLVED · F-04 RESOLVED · F-05 RESOLVED · F-06 RESOLVED · F-07 RESOLVED · F-08 RESOLVED · F-09 RESOLVED · F-10 RESOLVED · F-11 RESOLVED · F-12 RESOLVED · F-13 RESOLVED · F-14 RESOLVED
(No finding was removed. Behavior tests for each are defined and PENDING implementation.)

OPEN DECISIONS:
OD-001, OD-002, OD-006, OD-007, OD-010, OD-011, OD-012 (OPEN) · OD-003, OD-004, OD-005 (RESOLVED FOR PROJECT PLANNING) · OD-008, OD-009 (RESOLVED)

TEAM TEST:
PASSED (run 2 team; resume session staged teammates, no session limit reached)

TEAM MESSAGING:
PASSED (evidence↔safety and product↔evidence with replies, resume session)

TASK DEPENDENCIES:
PASSED with the task_gate hook (dependency lookup defect found and fixed in the resume session)

PLAN APPROVAL:
PASSED (run 2, backend plan v1 rejected, v2 approved)

QUALITY GATES:
Gate 6 documentation verdict PASS (spec consistency). All behavior gates NOT YET APPLICABLE at Phase 0; no pending test is counted as passing.
