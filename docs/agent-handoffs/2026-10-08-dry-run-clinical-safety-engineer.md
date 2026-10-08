# Task Handoff

## Owner
clinical-safety-engineer

## Task
T3 (P0-AS-3 dry run) — clinical-safety input to the implementation dependency graph — BUILD_PLAN Phase 0 (analysis only).

## Status
COMPLETED

## What Changed
Read-only analysis of CLAUDE.md, PROJECT-STATUS, BUILD_PLAN (Phases 0–25), DECISIONS (ADR-007/008/009/015/016, OD-001..010), AGENT-COMMUNICATION, CLINICAL-SAFETY, AI, TESTING, DATA_MODEL, SPEECH, EVIDENCE-SOURCES, PRODUCT_SPEC, UI-UX §3 (screens 8–14), QUALITY-GATES Gate 6. Output: safety-control→phase dependencies, 5 concerns, agent dependencies. No existing file edited.

## Files Changed
- docs/agent-handoffs/2026-10-08-dry-run-clinical-safety-engineer.md (new; only file created)

## Interfaces Changed
none

## Dependencies

### (a) Safety controls the phase order must honor
| # | Safety control | Must exist before | Planned in | Honored? |
|---|---|---|---|---|
| 1 | Enum + state-machine guards (DATA_MODEL §5.3–5.6, §6 rules 4 and 9: AI/SYSTEM cannot leave PROVISIONAL; only CLINICIAN confirms/completes/discontinues); AuditEvent on confirm | Phase 6 (first fact write), all of 10–17 | Phase 4 tasks 5–6 | Yes |
| 2 | Clinician confirmation gate for facts (confirm/reject/edit) | first user-visible AI fact | Phase 10 task 7, with extraction | Yes (UI and AI output arrive together; repo guard since Phase 4) |
| 3 | Speaker-role confirmation; UNKNOWN role → TRANSCRIPTION (CS-15) | Phase 10 extraction | Phase 9 tasks 4–5 | Yes in order; rule text inconsistent (Concern 2) |
| 4 | Schema + semantic validators: segment refs, number preservation, negation, PROVISIONAL-only (AI.md §5.1 #1–4) | Phase 10 | Phase 10 tasks 3, 5 | Yes |
| 5 | Citation/identifier validator, fake-FDA payload rejection (AI.md §5.1 #5; EVIDENCE-SOURCES §9–10) | Phase 12 Evidence screen; Phase 13 synthesis | Phase 12 task 8; Phase 13 task 5 | Mostly. Tasks run in numbered order (BUILD_PLAN l.3), so the Evidence screen (task 6) is built before validation (task 8). Do adapter validation in task 2 or move task 8 ahead of task 6 |
| 6 | No-probability + fact/evidence-ID validators for candidates (ADR-016, CS-22) | any surfaced possibility | Phase 13 task 5 | Yes. Phase 13 has no UI task; candidates first visible in Phase 14 |
| 7 | "Possibilities to review" UI with Provisional label, Dismiss/Confirm-as-assessment, conflict display (ADR-008) | first user-visible candidate | Phase 14 | Yes, provided Phase 13 output is not shown on any earlier screen |
| 8 | NOT_DISCUSSED note-rule list + fact↔note number/negation check (AI.md §5.1 #7) | AI note drafts | Phase 15 tasks 2, 4 | Yes. Finalize≠confirm has no test (Concern 5) |
| 9 | Absence ≠ DISCONTINUED (CS-12, CS-24) | Phase 10 job 10 profile proposals; Phase 16 comparison | job 10 validator, Phase 10 task 4; Phase 11 task 6; Phase 16 tests | Partly. The validator exists in Phase 10, but CS-12 is first listed as a test in Phase 16. Run it from Phase 10 |
| 10 | AI cannot complete follow-up (CS-23) | Phase 10 (AI job 9 writes FollowUp) | guard Phase 4; test only Phase 17 (l.486) | Partly. Run CS-23 from Phase 10 |
| 11 | Golden synthetic transcripts + CS-01…CS-24 harness + AI evaluation set | Phase 8 (OD-001 eval), 9 (S10), 10 (OD-002, TESTING §6) | no task; first full run Phase 21 | **No** (Concern 4) |
| 12 | OD-005 regulatory classification | Phase 13 (candidate generation is the CDS-like feature) | "recommended" before Phase 14 only (BUILD_PLAN l.38; DECISIONS OD-005) | Weak. Move the recommended gate to the start of Phase 13 |

Does any phase let AI output reach users before review controls exist? Not for clinical facts, candidates or notes: Phase 10 pairs extraction with the confirm/reject screen, Phase 13 has no UI, and Phase 15 depends on Phase 14. Two soft spots: (i) UI-UX Screen 8 (l.115) allows an "optional small list of provisional salient phrases" during recording. No AI job (AI.md §3), phase task or validator defines it. Specify it or remove it before Phase 8. (ii) Phase 10 task 6 profile-update proposals may appear on the Patient Overview (Phase 5). No Phase 10 test checks that they are labeled Provisional (FR-9.2, FR-24.2).

### (c) Agent dependencies
I depend on:
- data-engineer: Phase 4 guards, audit, schema fields for clarification/conflict (Concern 1).
- speech-diarization-engineer: role mapping and UNKNOWN provenance (Phase 9); synthetic audio for the Phase 8 evaluation.
- ai-clinical-engineer: prompt modules, validators, mock-LLM hooks, evaluation-set runs (Phases 10, 13, 15).
- evidence-research-engineer: identifier validator; fake-PMID and fake-openFDA fixtures (Phase 12).
- product-clinical-architect: resolving the spec contradictions in Concerns 1–3 and 5.
- qa-test-engineer: CI harness and scenario runner (S1–S24); ux-accessibility-engineer: Phase 3 state/provenance/status labels.
- chief-architect: plan reordering and ADRs. Project owner: OD-005.

Depend on me:
- chief-architect: Gate 6 verdict for every phase touching clinical data (QUALITY-GATES Gate 6), Phases 6 and 9–18.
- ai-clinical-engineer, evidence-research-engineer, data-engineer: safety review of their changes.
- qa-test-engineer: CS matrix definitions and synthetic safety fixtures.
- integration-reviewer, devops-android-release-engineer: safety review file as release input (Phases 23–25).
- Not an agent dependency: the clinician sign-off in BUILD_PLAN Phase 25 task 3 must come from a human clinician.

## Tests
none — documentation/analysis task

## Evidence
- `date -u` start 2026-10-08T03:44:08Z; end 2026-10-08T03:46:38Z (first pass).
- Line refs: working tree 2026-10-08 (HEAD e1961ef + uncommitted edits by other agents).
- `git status --short` at end shows modified CLAUDE.md, README.md, CLINICAL-SAFETY.md (l.3), DECISIONS.md (ADR-018..020), PRODUCT_SPEC.md (l.3). These are concurrent edits by other agents, not by me. They leave every line cited here in place. This agent created only this file.

## Known Limitations
- No code exists, so this checks documents only. ARCHITECTURE, API_CATALOG, SECURITY and PRIVACY were not read in full.
- Proposed new CS rows are recommendations. CLINICAL-SAFETY.md was not edited, per task instructions.

## Risks
Concerns:
1. **Safety-required flags have no data model.** CLINICAL-SAFETY §9 (l.97) requires "needs clarification", and TESTING §6 (l.43) and S22 (l.138) require a "clarification flag". CLINICAL-SAFETY §14 (l.136) and CS-14 (l.169) require a "Conflict — review" marker. DATA_MODEL §4.5 ClinicalFact (l.166–182) and §4.7 Medication (l.192) have no field for either. AI.md §3 (l.43–60) assigns conflict detection to no job. "Medication mention — UNKNOWN" is ambiguous between InformationState UNKNOWN and Medication.status UNKNOWN. The TESTING §6 row for an unidentified "The medication was stopped." has no CS-matrix row (CS-13 covers only a named medication). As written, the Phase 4 schema cannot satisfy CS-14, S11, S12 or S22.
2. **Provenance derivation contradicts itself across documents.** CLINICAL-SAFETY §15 (l.140) says an UNKNOWN role gives TRANSCRIPTION. BUILD_PLAN Phase 9 task 5 (l.292) says "TRANSCRIPTION/UNKNOWN". AI.md §6 (l.108) says AI_EXTRACTED "where no direct attribution". PRODUCT_SPEC §5.2 (l.76) defines PATIENT_REPORTED as "patient or companion" without the clinician-confirmed-mapping condition in DATA_MODEL §3.2 (l.76). DATA_MODEL §3.2 (l.75) requires a DOCTOR-role segment for CLINICIAN_STATED, but §4.5 (l.179) and Phase 6 task 3 (l.211) allow manual CLINICIAN_STATED with no segment. The Phase 4 guards and the Phase 9/10 code will diverge, and the expected value for CS-15 is unclear. Under the restriction principle (CLAUDE.md §2, ADR-018), the restrictive CLINICAL-SAFETY §15 wins, and the other documents must be aligned to it.
3. **MEASURED provenance is assigned to AI output without a rule.** PRODUCT_SPEC §5.4 (l.95) and TESTING S4 (l.120) give an AI-extracted, PROVISIONAL BP fact provenance MEASURED. DATA_MODEL §3.2 (l.73–77) and AI.md §6 (l.108) define no way to derive MEASURED. CLAUDE.md §4 (l.89) forbids AI output from silently becoming "a measured value". The risk is that recalled or home readings are labeled MEASURED and trusted more than they should be. Needs a documented rule and an ADR, for example: AI assigns at most CLINICIAN_STATED; MEASURED comes only from manual entry or clinician confirmation.
4. **No task builds the safety harness, golden transcripts or evaluation set before they are needed.** They are needed for Phase 8 task 1 (l.260; SPEECH §14 l.135), Phase 9 completion (S10, l.302), Phase 10 tests and completion (l.325–327), and OD-002 (DECISIONS l.180 needs "AI evaluation set results"). The first "run all 24 scenarios" is Phase 21 task 1 (l.565). Cross-Phase Rule 2 (l.12) puts tests with features but gives no phase ownership of the shared corpus. Recommendation: before Phase 8, add a task to create the synthetic scenario corpus and a CS harness on mock providers (owners: clinical-safety-engineer and qa-test-engineer).
5. **"Finalizing does not confirm unreviewed facts" is never tested.** The rule is in CLINICAL-SAFETY §5 (l.54) and PRODUCT_SPEC FR-23.2 (l.278). It has no CS row in §18 (l.154–179) and no test in Phase 6 (l.223), 14 (l.421) or 15 (l.443). Phase 15 tasks (l.432–435) also omit the FR-21.3 "AI draft" label and the UI-UX Screen 14 unreviewed-facts indicator (l.187). Phase 15 is the first point where AI drafts and PROVISIONAL facts meet the finalize action built in Phase 6.

## Required Follow-up
- chief-architect: route Concerns 1–3 and 5 to product-clinical-architect and data-engineer for document fixes plus DECISIONS entries. Add the corpus/harness task before Phase 8. Consider moving the OD-005 recommended gate to Phase 13 and CS-23 to Phase 10.
- clinical-safety-engineer, after the documents are fixed: propose CS-25 (finalize ≠ confirm) and CS-26 (unidentified "stopped" medication → UNKNOWN + clarification).
- ux-accessibility-engineer / product-clinical-architect: specify or remove the Screen 8 "provisional salient phrases".

## Receiving Agent
chief-architect — REVIEW REQUIRED: yes, by chief-architect; product-clinical-architect for Concerns 1–3 and 5.
