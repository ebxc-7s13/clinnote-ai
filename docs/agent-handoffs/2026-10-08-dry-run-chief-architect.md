# Task Handoff

## Owner
chief-architect

## Task
T4 (P0-AS-3 dry run): synthesize the implementation dependency graph from T1 (product-clinical-architect), T2 (evidence-research-engineer) and T3 (clinical-safety-engineer). BUILD_PLAN Phase 0. Analysis only; no application code.

## Status
COMPLETED (dry run). Findings are **proposals**. No BUILD_PLAN, ADR or spec change has been made. Each proposal needs an owner-routed doc fix and an ADR before adoption.

## Prompt Summary (as received from the project owner, 2026-10-08)
- DRY RUN, Phase 0 multi-agent verification. No application code. Create only the four `2026-10-08-dry-run-*.md` handoff files.
- Planning task: "Analyze the existing ClinNote documentation and produce the implementation dependency graph."
- Step 1: create tasks T1–T3 and T4, with T4 blocked by T1–T3.
- Step 2: delegate T1–T3 in parallel to product-clinical-architect, evidence-research-engineer and clinical-safety-engineer. Each reports (a) phase-order dependencies, (b) up to 5 concerns with file and section, (c) agent dependencies, written in the AGENT-COMMUNICATION §3 format.
- Step 3: SendMessage the evidence TOP CONCERN to clinical-safety-engineer and record the reply.
- Step 4: this synthesis.
- Step 5: self-report.

## What Changed
- Created 4 tasks via TaskCreate. #4 is blockedBy #1, #2 and #3.
- Spawned the 3 specialists in a single parallel tool block.
- Spot-checked their citations against the files.
- Ran the SendMessage test.
- Wrote this file.

## Files Changed
`docs/agent-handoffs/2026-10-08-dry-run-chief-architect.md` (new). The three specialist handoffs were written by their owners. Nothing else was edited by this session.

## Interfaces Changed
none. IC-010's "First needed: Phase 12" is flagged below for change.

## Dependencies — Synthesized Implementation Dependency Graph

### As documented (BUILD_PLAN.md order; stages from `.claude/orchestration/team-stages.md`; owners from AGENT-TASK-GRAPH §2)
```text
STAGE A  Research/Arch   P0 Docs ............ chief, product, safety, evidence, ux
            │
STAGE B  Foundations     P1 Repo ............ devops
            │            P2 Expo/Android .... mobile, devops
            │            ├─ P3 UI System .... mobile, ux     ┐ parallel (IC-001 drafted first)
            │            └─ P4 Local DB ..... data           ┘ [OD-003 before distribution]
            │            P5 Patient ......... mobile, data
            │            P6 Visit (manual) .. mobile, data   ◀ first end-to-end clinical workflow
            │
STAGE C  Core Intell.    P7 Recording ....... speech, mobile
            │            P8 Speech .......... speech, backend [OD-007 → OD-001, OD-004]
            │            P9 Diarization ..... speech          [OD-001]
            │            P10 Extraction ..... ai, backend     [OD-002]
            │            P11 Medication ..... evidence, ai
            │            P12 Evidence ....... evidence, backend [OD-008 images only]
            │            P13 AI Reasoning ... ai              [OD-002]
            │
STAGE D  Integration     P14 Clinical Review  mobile, ai, ux  [OD-005 recommended]
            │            P15 Note Gen ....... ai, mobile      [OD-002]
            │            P16 Longitudinal ... data, mobile, ai
            │            P17 Follow-Up ...... mobile, data
            │            P18 Export ......... mobile
            │
STAGE E  Validation      P19 Security ....... security       [OD-003, OD-009]
            │            P20 Privacy ........ security       [OD-006]
            │            P21 Testing ........ qa, safety
            │            P22 Performance .... qa, mobile
            │
STAGE F  Release         P23 Android Build .. devops         [OD-003]
                         P24 Google Play .... devops         [OD-005, OD-006, OD-010]
                         P25 Final Audit .... integration, chief + all reviewers [all ODs; human clinician sign-off]
```
**Critical path (as documented, AGENT-TASK-GRAPH §3):**
0→1→2→4→5→6→7→8→9→10→12→13→14→15→16→21→23→24→25.

Owner-decision gates on the path:
- OD-007 → OD-001 + OD-004 before Phase 8
- OD-002 before Phase 10
- OD-005 before Phase 14
- OD-003, OD-006 and OD-010 before Phase 24

**Parallelizable sets (as documented):**
- 3∥4
- read-only research (provider evaluation, evidence API verification) during 5–7
- 11∥12 at adapter level only, once IC-010 is frozen
- 16∥18 and 17∥18
- Stage E reviews

### Proposed amendments from dry-run findings (not adopted; each needs an ADR)
```text
NEW P7.5 "Safety corpus + CS harness on mock providers" (safety, qa) ──▶ required by P8 (OD-001 eval), P9 (S10), P10 (OD-002 eval)
P8 split: backend scaffold + auth (backend; needs OD-004 only) ──▶ P10, P11, P12  |  speech integration (needs OD-001/007)
P11 + identifier-provenance validator + CS-17 malformed-payload rejection BEFORE task 5 (Medication Info screen)
P12 = facts-only queries; retrieval-side completion criteria (S16, CS-17, disagreement display, fake-ID fixtures, identifier-free queries)
P13 = candidate-based re-query + synthesis; CS-16 and S17 synthesis assertions move here
OD-005 recommended gate moves from P14 to P13 start (project owner decides)
P14 completion: PRODUCT_SPEC §12 criteria 5, 6, 8; criterion 7 ("edit the generated note") moves to P15
P16 deterministic timeline/diff may start after P6 (AI wording waits for job 14, P13); P17 ∥ P16; P18 manual-note export after P6
CS-12 and CS-23 tests run from P10 (first AI writer), not first in P16/P17
```
**Proposed critical path:** 0→1→2→4→5→6→7→7.5→8→9→10→11→12→13→14→15→21→23→24→25. P16–P18 come off the critical path if the parallelization is adopted.

### Agent dependency edges confirmed by all three specialists
- data-engineer (IC-001/003, guards) → everyone
- backend (IC-004/013/015) → speech, ai, evidence
- ai (facts/candidates) → evidence (queries) → ai (synthesis) → mobile
- product → requirements for all
- all implementers → qa → safety/security → integration → chief
- project owner: OD-001…OD-010

## Tests
none. Documentation/analysis task. Citation spot-check (below) is the verification.

## Evidence
- Delegation start: 2026-10-08T03:43:34Z. Synthesis start: 03:48:44Z.
- agentIds:
  - product-clinical-architect: `a6701a5f7d17b83e8` (147 s)
  - evidence-research-engineer: `aacaa710f181ae3b5` (181 s; self-reported 03:43:58–03:46:03Z)
  - clinical-safety-engineer: `a7628d4d220999cd9` (176 s; 03:44:08–03:46:38Z)
- Handoff file mtimes: 03:46:00, 03:46:40, 03:46:49. Line counts: 78, 106, 84 (`wc -l`). Secret-pattern grep over `docs/agent-handoffs/`: no matches.
- Citations re-read with `sed -n` and all matched the agents' quotes: AI.md:55, DATA_MODEL.md:230, BUILD_PLAN.md:158–176, 292, 336–351, 362, 367, 378, 387, 423, 565, PRODUCT_SPEC.md:95, 347, API_CATALOG.md:378, PRIVACY.md:62, CLINICAL-SAFETY.md:140.
- Nuance: PRIVACY.md:62 *allows* "drug names" and forbids "transcript text". Evidence concern #2 is therefore about the ambiguity of "raw medication wording", not an outright contradiction.

## Known Limitations
- **Concurrent peer session.** ListAgents showed peer session `clinnote-ai-36` (interactive, busy). During the run, `git status` showed new or modified CLAUDE.md, README.md, CLINICAL-SAFETY.md, DECISIONS.md (ADR-018/019/020), PRODUCT_SPEC.md and seven `docs/AGENT-*`/QUALITY-GATES/INTEGRATION-CONTRACTS files. Their mtimes (03:44:24–03:46:06) fall inside the subagent window. The content is agent-system setup, and two subagents explicitly disclaimed it. Attributing it to the peer session is an **inference**: the filesystem cannot prove authorship. This session did not touch those files.
- Line numbers refer to the working tree on 2026-10-08 and may shift as the peer session keeps editing.

## Risks — Consolidated Concerns
| # | Source | File / section | Concern | Proposed owner |
|---|---|---|---|---|
| 1 | evidence (TOP), product #2, safety reply | AI.md:55; DATA_MODEL §4.15:230; ARCHITECTURE §6.4:177; BUILD_PLAN P12:378 vs P13:387 | Evidence/possibility order inverted. The CS-16 gate could PASS in P12 before synthesis exists, which would be a false safety claim. Visit has no candidate stage state. | chief (BUILD_PLAN + ADR), ai, evidence, data |
| 2 | safety (SendMessage reply) | BUILD_PLAN P11 task 5:340 vs P12 task 8:367 | Medication Information screen shows label set IDs before identifier/CS-17 validation exists. This is user-facing. | evidence, safety, qa |
| 3 | evidence #2 | API_CATALOG §19:378 vs PRIVACY §7:62 | "Raw medication wording" to RxNorm is ambiguous against the no-transcript-text rule. P11 has no identifier-free test. The check must run on-device. | security-privacy, evidence |
| 4 | evidence #3, product P4, safety row 12 | BUILD_PLAN overview:35, P11:353; DECISIONS OD-005:203 | US-only medication sources have no jurisdiction gate (non-US brands could match the wrong US label shown as Tier 1). Possibility generation (P13) is built before the OD-005 recommended gate. | project owner via chief |
| 5 | product #1 | BUILD_PLAN P14:423; PRODUCT_SPEC §12:347 | P14 completion requires "edit the generated note", which is P15 work. P14 cannot complete. | chief |
| 6 | safety #2, product #3 | CLINICAL-SAFETY §15:140; BUILD_PLAN P9:292; AI.md §6:108; DATA_MODEL §3.2/§4.5; P6 task 3:211 | Provenance derivation contradicts itself (UNKNOWN role; manual CLINICIAN_STATED vs CLINICIAN_CONFIRMED; no rule for editing a PROVISIONAL fact). | data, safety, product |
| 7 | safety #3 | PRODUCT_SPEC §5.4:95; TESTING S4:120; CLAUDE.md §4 | AI-extracted fact is labeled MEASURED with no derivation rule. | safety, data, ai (ADR) |
| 8 | safety #1 | CLINICAL-SAFETY §9/§14; TESTING §6/S22; DATA_MODEL §4.5/§4.7; AI.md §3 | Clarification flag and "Conflict — review" marker have no data field and no producing job. P4 schema cannot satisfy CS-14/S11/S12/S22. | data, ai, safety |
| 9 | safety #4 | BUILD_PLAN P8:260, P9:302, P10:325–327, P21:565; DECISIONS OD-002:180 | No task builds the golden synthetic corpus, CS harness or AI evaluation set before P8. | safety, qa; chief adds task |
| 10 | safety #5 | CLINICAL-SAFETY §5:54; FR-23.2; BUILD_PLAN P15:432–443 | "Finalize ≠ confirm" has no CS row or test. P15 omits the "AI draft" label and the unreviewed-facts indicator. | safety, mobile, qa |
| 11 | product #4 | FR-9.1, FR-25.1; UI-UX Screen 4; DATA_MODEL §1 | "Active problems" and "current medications" have no derivation rule, so provisional AI items could surface as active. | product, data |
| 12 | product #5 | PRIVACY §6:54; UI-UX Screens 1, 18; PRODUCT_SPEC §7 | Cloud-AI on/off and onboarding acknowledgement have no FR and no phase. | product, ux, security |
| 13 | evidence #4, #5 | EVIDENCE-SOURCES:17–20, 116; API_CATALOG §29; BUILD_PLAN P12:361, 364; ADR-012 | Ranking/dedup undefined. NCI is in two tiers. Routing gaps. Cache location and freshness integrity are unspecified (a backend cache would conflict with the stateless backend). | evidence, backend, security |
| 14 | evidence dep 1 | BUILD_PLAN P8; ADR-012 | Backend scaffold is bundled with the OD-001 speech decision, so an OD-001 slip blocks P10–P12. | chief, backend |
| 15 | chief | AGENT-TASK-GRAPH §7 (written 03:44:54); §1 | §7 claims concerns are "tracked in PROJECT-STATUS.md (Open Findings)", but that section does not exist (forward-dated claim). §1 macro graph puts TESTING (21) before SECURITY (19–20), contradicting §2 and BUILD_PLAN. IC-010 "first needed P12" is too late (INTEGRATION-CONTRACTS:37). | chief (with peer-session owner) |
| 16 | chief | process | Two Claude sessions edited the same repository concurrently with no lock or ownership handshake. AGENT-OWNERSHIP's one-editor-per-core-file rule cannot be enforced across sessions. | chief, project owner |

Minor, not tabled: UI-UX Screen 8 "provisional salient phrases" is undefined (safety). Appointment entity has no FR/task. Visits list screen is missing from UI-UX §3. FR-26.1 draft export does not require draft marking (product).

## Messaging Test (Step 3)
- Sent to `safety-dryrun` (spawn name). Harness result: `{"success":true,"message":"Resuming agent safety-dryrun","resumedAgentId":"a7628d4d220999cd9"}`.
- Reply received and quoted (excerpt): "Safety assessment of the evidence phase-order concern: real, moderate severity, and it must keep Phase 12 from being marked TESTED as currently written. [...] A CS-16 PASS recorded against a synthesis job that does not exist yet (or a stub) would be a false safety claim. [...] A sharper user-facing risk is in Phase 11. Task 5 (Medication Information screen) displays label EvidenceSources with set IDs before Phase 12 task 8 validates identifiers [...] That is a CS-17 exposure. [...] I require (c) as mandatory [...] (b) [...] The validator part of (a), not the whole of it [...] Until then it should be PARTIALLY_TESTED or BLOCKED, never PASS on CS-16."
- The two new claims in the reply (EvidenceSource table exists from P4 task 2; P11 task 5 precedes P12 task 8) were verified against BUILD_PLAN.md:160, 340, 367. No files were changed by the reply.

## Verification Table
| Check | Result | Evidence |
|---|---|---|
| Agent discovery | PASS | 14 project agent types offered to Agent tool; 14 files in `.claude/agents/`; ListAgents returned peer `clinnote-ai-36` |
| Delegation (3 agents) | PASS | 3 Agent calls with the correct subagent_type; agentIds `a6701a5f7d17b83e8`, `aacaa710f181ae3b5`, `a7628d4d220999cd9` |
| Parallel execution | PASS | Issued in one tool block at 03:43:34Z. Run times overlap (evidence 03:43:58–03:46:03, safety 03:44:08–03:46:38; product file 03:46:00). Wall time ≈212 s vs 504 s summed durations |
| Handoff files written | PASS | 3 specialist files (78/106/84 lines, §3 format, Receiving Agent = chief-architect) plus this file |
| SendMessage messaging | PASS | success:true, agent resumed; reply received and quoted above |
| Task list / dependencies | PASS | TaskCreate available. Tasks #1–#4 created; #4 blockedBy [1,2,3]; status updated pending→in_progress→completed |
| Self-reporting | PASS | All 3 agents returned summaries with files, concerns and scope confirmation. Limitation: product agent has no Bash, so it has no timestamps |

## Required Follow-up
1. chief-architect: draft an ADR and BUILD_PLAN amendment for concerns 1, 2, 5, 9 and 14, after owner review.
2. Route concerns 6–8 and 10–12 to product, data and safety for doc fixes.
3. Route concern 3 to security-privacy.
4. Route concern 13 to evidence.
5. Project owner:
   - OD-005 timing (concern 4)
   - coordinate the two concurrent sessions (concern 16)
   - Phase 0 review and push
6. Do not mark Phase 0 TESTED until owner review.

## Receiving Agent
project owner (via terminal report). REVIEW REQUIRED: yes, by the project owner. Integration-reviewer before any BUILD_PLAN change.
