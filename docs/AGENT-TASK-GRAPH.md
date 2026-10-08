# ClinNote AI — Agent Task Graph

Dependency graph of the ClinNote build, mapping `BUILD_PLAN.md` phases to development stages (`.claude/orchestration/team-stages.md`) and owning agents. chief-architect parallelizes independent tasks and serializes tasks that touch the same core interfaces.

---

## 1. Macro Graph

```text
FOUNDATION (Phase 0 docs + agent system)
        ↓
ARCHITECTURE (Gate 1; ADRs; repository + Expo foundation — Phases 1–3)
        ↓
DATA + API CONTRACTS (Gate 2 + Gate 3; Phase 4 freezes IC-001…IC-003 and IC-016/IC-017;
                      API contracts IC-004, IC-013, IC-015 and IC-019a are frozen at the start of Phase 7)
        ↓
MOBILE + BACKEND + SPEECH + AI + EVIDENCE (Phases 5–13, parallel where contracts allow)
        ↓
INTEGRATION (Phases 14–18; Gate 5)
        ↓
SECURITY + PRIVACY (Phases 19–20; Gate 7; Gate 6 re-verified)
        ↓
TESTING (Phase 21 consolidation + Phase 22 performance; Gate 8)
        ↓
ANDROID BUILD (Phase 23; Gate 9)
        ↓
PLAY RELEASE (Phases 24–25; Gate 10; owner go decision)
```

Order follows `BUILD_PLAN.md` (security/privacy reviews 19–20 precede consolidated testing 21; corrected 2026-10-08 after dry-run concern 15). Testing and security are also continuous in every phase (BUILD_PLAN Cross-Phase Rules); these nodes are the dedicated consolidation and review phases.

## 2. Phase-Level Dependency Table

| Phase | Name | Stage | Owner(s) | Depends on | Gating ODs | Can run in parallel with |
|---|---|---|---|---|---|---|
| 0 | Documentation + agent system | A | chief-architect, product, safety, evidence, ux | — | — | — |
| 1 | Repository Foundation | B | devops | 0 | — | UX research for Phase 3 |
| 2 | Expo and Android Foundation | B | mobile, devops | 1 | — | data-engineer schema design (docs only) |
| 3 | UI System | B | mobile, ux | 2 | — | Phase 4 (disjoint files) |
| 4 | Local Database (SQLCipher, conflict detector, derived views) | B | data | 2 | — (ADR-031) | Phase 3 |
| 5 | Patient System | B | mobile, data | 3, 4 | — | speech provider research (OD-001 prep) |
| 6 | Visit System (manual workflow) + safety test corpus | B | mobile, data; safety + qa (corpus) | 5 | — | evidence API verification research; corpus (disjoint files) |
| 7 | Recording + 7B backend foundation | C | speech, mobile; backend (7B) | 6 | — (ADR-026, ADR-032) | 7B runs in parallel (disjoint files) |
| 8 | Speech | C | speech, backend | 7 | OD-007 → OD-001 | AI job schema design (docs/tests only) |
| 9 | Speaker Diarization | C | speech | 8 | OD-001 | Phase 11 research |
| 10 | Clinical Extraction | C | ai, backend | 9 | OD-002 | evidence adapters for Phase 11 |
| 11 | Medication Intelligence + evidence foundation | C | evidence, ai | 10 | OD-011 | Phase 12 adapters after IC-010 frozen |
| 12 | Evidence Engine | C | evidence, backend | 10, 11 | — | — |
| 13 | AI Reasoning (R2 behind flag) | C | ai | 12 | OD-002; ADR-025 | — |
| 14 | Clinical Review | D | mobile, ai, ux | 13 | ADR-025 (R2 release) | — |
| 15 | Note Generation | D | ai, mobile | 14 | OD-002 | Phase 18 |
| 16 | Longitudinal Memory | D | data, mobile, ai | 15 | — | Phase 17 prep |
| 17 | Follow-Up | D | mobile, data | 16 | — | Phase 18 |
| 18 | Export | D | mobile | 15 | — | Phases 16–17 |
| 19 | Security | E | security | 1–18 | — (verify ADR-030/031/032) | Phase 21 planning |
| 20 | Privacy | E | security | 19 | OD-006 | — |
| 21 | Testing | E | qa, safety | 20 | — | — |
| 22 | Performance | E | qa, mobile | 21 | — | — |
| 23 | Android Build | F | devops | 22 | — | — |
| 24 | Google Play | F | devops | 23 | ADR-025 assessment, OD-006, OD-010, OD-011 | — |
| 25 | Final Release Audit | F | integration, chief + all reviewers | 24 | all | — |

## 3. Critical Path

0 → 1 → 2 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 12 → 13 → 14 → 15 → 16 → 21 → 23 → 24 → 25

Owner decisions on the critical path: OD-007 → OD-001 (before Phase 8), OD-002 (before Phase 10), OD-011 (before Phase 11), the formal regulatory assessment (before any R2 release and before Phase 24, ADR-025), OD-006 and OD-010 (before Phase 24). OD-003, OD-004, OD-005, OD-008 and OD-009 were resolved in Stage A (ADR-025, ADR-029–ADR-032).

## 4. Safe Parallel Sets

| When | Parallel set | Condition |
|---|---|---|
| Stage A | product + safety + evidence + ux reviews | read-only analysis |
| Phases 3 ∥ 4 | mobile/ux (UI system) ∥ data (schema) | IC-001 drafted first |
| Phases 5–7 | speech provider evaluation ∥ evidence API verification ∥ feature work | research is read-only + synthetic audio |
| Phases 11 ∥ 12 adapters | evidence adapters per provider | disjoint adapter files, shared IC-010 frozen |
| Phases 16 ∥ 18 | longitudinal (data/mobile) ∥ export (mobile, separate screens) | different files |
| Stage E | security ∥ privacy prep ∥ safety suite ∥ QA coverage | review/test work, no shared core files |

Never parallel: two agents editing `DATA_MODEL.md`, `src/domain/**`, `backend/schemas/**`, provider interfaces, migrations, lockfile.

## 5. Agent Dependency Edges

```text
product-clinical-architect ──requirements──▶ ux, mobile, ai, evidence, data, safety
data-engineer ──IC-001/002/003──▶ mobile, ai, speech, evidence
backend-api-engineer ──IC-004/005/013/015──▶ mobile, speech, ai, evidence
speech-diarization-engineer ──IC-007 transcript──▶ ai-clinical-engineer
ai-clinical-engineer ──facts/candidates──▶ evidence (queries), mobile (review UI)
evidence-research-engineer ──EvidenceSources──▶ ai (synthesis), mobile (cards)
all implementers ──▶ qa-test-engineer ──▶ safety / security ──▶ integration-reviewer ──▶ chief-architect
devops-android-release-engineer ◀── all (builds, CI)
```

## 6. Active Task Board

Fallback task list when the shared Task tools are unavailable. chief-architect maintains it.

| Task | Owner | Depends on | Status | Evidence |
|---|---|---|---|---|
| P0-AS-1 Create agent definitions (14) | chief-architect | — | completed | `.claude/agents/` (validation in BUILD_REPORT) |
| P0-AS-2 Create rules, settings, orchestration docs | chief-architect | P0-AS-1 | completed | `.claude/rules/`, `.claude/settings.json`, `.claude/orchestration/` |
| P0-AS-3 Dry run: dependency-graph analysis (3 specialists) | chief-architect → product, evidence, safety | P0-AS-1 | see `2026-10-08-dry-run-chief-architect.md` | handoff files |
| P0-AS-4 Stage A: reconcile F-01…F-14, OD review, real agent-team validation | chief-architect + team (product, evidence, safety, backend) | P0-AS-3 | completed (2026-10-08) | `PROJECT-STATUS.md`; `docs/agent-handoffs/2026-10-08-stage-a-team2-*.md`; ADR-021…ADR-043 |
| P0-AS-5 Owner review of Stage A | project owner | P0-AS-4 | pending | — |
| P1-1 Repository Foundation | devops-android-release-engineer | P0-AS-5 + explicit owner instruction | pending (not started) | — |

## 7. Dry-Run and Stage A Synthesis

The 2026-10-08 dry run (`docs/agent-handoffs/2026-10-08-dry-run-*.md`) produced concerns F-01…F-16. Stage A resolved F-01…F-14 in the specifications, with ADRs (ADR-021…ADR-043). The phase-order amendments it adopted:
- the safety corpus moves to Phase 6
- the evidence foundation moves to Phase 11
- the backend foundation moves to Phase 7B
- R2 runs behind flags

The phase-level table above reflects them. Stage A team reviews: `docs/agent-handoffs/2026-10-08-stage-a-team-*.md` (run 1, interrupted) and `2026-10-08-stage-a-team2-*.md` (run 2 with re-checks and synthesis).
