# Task Handoff

## Owner
product-clinical-architect

## Task
T1 (DRY RUN) — Product / clinical-workflow analysis for the implementation dependency graph — BUILD_PLAN Phase 0.

## Status
COMPLETED (analysis only; no existing file edited)

## What Changed
Read CLAUDE.md, PROJECT-STATUS, BUILD_PLAN (Phases 0–25), DECISIONS (ADR-001..017, OD-001..010), AGENT-COMMUNICATION §3, PRODUCT_SPEC, UI-UX, DATA_MODEL, CLINICAL-SAFETY, ARCHITECTURE (§5–§8), AI.md §3. Mapped product workflows to the phases they need, checked the BUILD_PLAN order against them, and recorded 5 documentation concerns below. No requirement text was changed.

## Files Changed
docs/agent-handoffs/2026-10-08-dry-run-product-clinical-architect.md (new). No other file.

## Interfaces Changed
none

## Dependencies

### (a) Workflow → phase dependencies (PRODUCT_SPEC §6, §8, Features 1–26)
| Workflow | Needs phases | Order honored? |
|---|---|---|
| Patient create/search/overview (F1, F2, F9) | 3, 4, 5 | Yes |
| Manual visit incl. consent DECLINED, manual facts, manual note, finalize (F3, F4, F21–23 manual path) | 4, 5, 6 | Yes — first end-to-end clinical workflow; good |
| Consent gate + withdrawal (FR-4.1–4.3) | 4 (ConsentRecord, AuditEvent), 6 (screen), 7 (gate) | Yes. Withdrawal "keep/discard transcript" (FR-4.3) is only testable once a transcript exists → re-test in Phase 8 |
| New ambient consultation (F5–F8) | 6 → 7 → 8 → 9 → 10 (OD-007, OD-001, OD-004, OD-002) | Yes |
| Fact-level review/confirmation (FR-22.2, FR-23.3) | 4 (§5.3 guards), 6 (manual), 10 task 7 (Clinical Facts screen) | Yes |
| Possibilities + evidence + review workspace (F17–F19, F18) | 10 → 11 → 12 → 13 → 14 | Order conflicts with spec workflow — see Concern 2 |
| Note generation (F21) | 14 → 15 (review decisions are an input, ARCHITECTURE §6.5) | Yes; but Phase 14 exit criterion needs Phase 15 — Concern 1 |
| Returning patient / timeline (F24, F25, §8) | Deterministic diff needs only structured facts (4–6; AI facts from 10). AI wording = job 14 (Phase 13 task 3) | Phase 16 depends on 15 (BUILD_PLAN line 463) — later than product needs |
| Follow-up (F16), pending investigations (FR-13.3) | Data from 6 (manual) and 10 (job 9); UI 17 | Phase 17 depends on 16 (line 484); only FR-13.3 truly needs 16 |
| Export (F26) | Manual notes exist after 6; AI drafts after 15 | Phase 18 depends on 15 (line 505) — could start after 6 |

Parallelization / ordering opinions (product standpoint; chief-architect decides):
- P1. Phase 16 deterministic timeline + return-visit diff could run after Phase 6 (manual data) in parallel with 7–15; it is the core "clinical memory" value and is AI-independent (ARCHITECTURE §6.6). Only the AI wording waits for job 14.
- P2. Phase 17 (FR-16.1–16.3) could run with Phase 16; Phase 18 plain-text export of manual notes could run after Phase 6. Neither touches providers.
- P3. Phase 11 task 4 stores labels "as EvidenceSources" (line 339) but EvidenceSource persistence/adapters are Phase 12 tasks 2, 4. Either move that task to 12 or make 11 own the minimal EvidenceSource writer.
- P4. OD-005 is "recommended before Phase 14" (DECISIONS OD-005), but candidate generation (job 12) — the feature most exposed to classification — is built in Phase 13. Product recommends OD-005 be raised before Phase 13. Project owner decides; not decided here.
- P5. Onboarding and cloud-AI on/off have no phase (Concern 5); natural homes: shell in Phase 3, gating before first cloud call in Phase 8.

### (c) Agent dependencies
I depend on: chief-architect (phase reordering, ADRs); data-engineer (DATA_MODEL §4.2/§5 stage states, derivation of "active problems"/"current medications", manual-entry provenance); clinical-safety-engineer (review/confirmation semantics, manual provenance pairing); ux-accessibility-engineer (UI-UX screens 1, 4, 6, 18; Visits tab); ai-clinical-engineer (job 11/12 sequencing); evidence-research-engineer (candidate-linked queries); security-privacy-engineer (cloud-AI toggle disclosures, export); project owner (OD-005, OD-006, OD-007).
Depend on me: mobile-android-engineer (workflows + FRs per screen, Phases 5–18); ai-clinical-engineer (FR semantics for jobs 1–16); evidence-research-engineer (FR-17, FR-19); data-engineer (workflow states); ux-accessibility-engineer (terminology, information-state wording); qa-test-engineer (FR IDs, §12 success criteria → E2E); clinical-safety-engineer (terminology consistency).

## Tests
none — documentation/analysis task

## Evidence
File:line references in each concern below (line numbers from Read output on 2026-10-08). No shell was available to this agent; no commands were run (Read/Grep/Glob tools only). `docs/agent-handoffs/README.md` and `TEMPLATE.md` already existed when this file was written.

## Known Limitations
- Analysis only; ARCHITECTURE skimmed (§5–§8), SPEECH/EVIDENCE-SOURCES/TESTING read only for referenced items.
- Minor observations not counted as concerns: (i) `Appointment` entity (DATA_MODEL §4.13, line 218) has no FR and no BUILD_PLAN task; (ii) UI-UX §2 line 13 defines a Visits tab, but §3's 20 screens include no Visits-list/visit-detail screen although Phase 6 task 6 builds one; (iii) FR-26.1 (PRODUCT_SPEC line 294) allows exporting a draft note but does not require the export to carry the "AI draft"/provisional marking (CLINICAL-SAFETY §5) — safety review suggested.

## Risks

### Concerns (numbered, with citations)
1. **Phase 14 exit criterion is unreachable before Phase 15.** BUILD_PLAN "PHASE 14 — CLINICAL REVIEW", Completion criteria (line 423) requires PRODUCT_SPEC §12 success criteria 5–8; criterion 7 "edit the generated note" (PRODUCT_SPEC §12, line 347) needs AI note generation, which is Phase 15 (lines 427–441). Fix: Phase 14 criteria 5, 6, 8; criterion 7 moves to Phase 15.
2. **Possibilities vs evidence ordering is inconsistent across docs.** PRODUCT_SPEC §6 Core Workflow (lines 111–112) runs Possibilities *before* Evidence retrieval; AI.md §3 job 11 input is "facts, candidates" (line 55) and DATA_MODEL §4.15 has `EvidenceQuery.candidateId` (line 230); but ARCHITECTURE §6.4 (line 177) generates queries from facts only, and BUILD_PLAN builds job 11 in Phase 12 task 3 (line 362) before candidate generation in Phase 13 task 1 (line 387). Also DATA_MODEL §4.2 Visit (lines 131–134) and §5.2 have no stage state for candidate generation, although ARCHITECTURE §8 (line 221) requires per-stage persistence for resume. Needs one canonical sequence (product proposal: facts → candidates → queries from facts + candidates → synthesis) plus a candidate stage state (data-engineer).
3. **Clinician-authored and edited facts have ambiguous status/provenance.** BUILD_PLAN Phase 6 task 3 (line 211) stores manual facts as CLINICIAN_STATED + CONFIRMED, while CLINICAL-SAFETY §17 (line 148) and FR-23.3 (PRODUCT_SPEC line 279) say confirmation sets CLINICIAN_CONFIRMED; DATA_MODEL §3.2 (line 75) requires a DOCTOR segment for CLINICIAN_STATED, with only a field-level exception in §4.5 (line 179). Manually typed measurements (MEASURED vs CLINICIAN_STATED) are unspecified. DATA_MODEL §5.3 Fact Review (lines 299–304) has no transition for editing a PROVISIONAL fact or rejecting a CONFIRMED one, yet FR-22.2 (line 272) and UI-UX Screen 10 (Actions) offer edit on any fact.
4. **"Active problems" and "current medications" have no data definition.** FR-9.1 (PRODUCT_SPEC line 188), UI-UX Screen 4 (line 67) and BUILD_PLAN Phase 5 task 4 require "active problems"; FR-25.1 requires "current medications". DATA_MODEL §1 (line 18) has no Problem entity and no derivation rule (confirmed Assessments? HISTORY_MEDICAL facts? PROVISIONAL items?). Without a deterministic rule, Phase 5/16 could surface provisional AI items as active problems or derive "current" in a way that conflicts with absence ≠ discontinuation (CLINICAL-SAFETY §11).
5. **Clinician control of cloud processing has no FR and no phase.** PRIVACY §6 (line 54) and UI-UX Screen 1 (line 32) / Screen 18 (line 235) require a cloud-AI on/off setting and an onboarding acknowledgement ("not a doctor", "AI output is provisional"), but PRODUCT_SPEC §7 has no feature/FR for either and BUILD_PLAN has no task (only the Settings tab, line 138, and app lock, line 518). These are product requirements I own; they need FR IDs and a phase.

Docs-process note: the files AGENT-COMMUNICATION.md references (AGENT-OWNERSHIP.md, AGENT-RUNBOOK.md, INTEGRATION-CONTRACTS.md, AGENT-TASK-GRAPH.md, agent-handoffs/TEMPLATE.md) were present when this file was written (Glob, 2026-10-08). Their contents were not reviewed, so no product-work issue is raised about them.

## Required Follow-up
- Concern 1 → chief-architect (BUILD_PLAN owner): adjust Phase 14/15 completion criteria.
- Concern 2 → chief-architect + ai-clinical-engineer + evidence-research-engineer; data-engineer for stage state; product-clinical-architect to update PRODUCT_SPEC §6 once agreed.
- Concern 3 → data-engineer + clinical-safety-engineer; product-clinical-architect to clarify FR-22.2/FR-23.3.
- Concern 4 → product-clinical-architect (define derivation in PRODUCT_SPEC F9/F25) + data-engineer (DATA_MODEL rule).
- Concern 5 → product-clinical-architect (new FRs), ux-accessibility-engineer, security-privacy-engineer; chief-architect to place in BUILD_PLAN.
- P1–P4 ordering proposals → chief-architect; P4 (OD-005 timing) → project owner.

## Receiving Agent
chief-architect — REVIEW REQUIRED: yes, by chief-architect (ordering) and clinical-safety-engineer (Concerns 2, 3).
