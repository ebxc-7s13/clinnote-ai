# ClinNote AI — Team Stages and Concurrency

The chief-architect activates only the agents a stage needs. Exact concurrency is decided per task from dependencies and token cost; the limits below are ceilings, not targets.

## Concurrency ceilings

| Stage | Ceiling (simultaneously active agents, excluding the lead) |
|---|---|
| A — Research / architecture | 3–5 |
| B — Foundations | 4–6 |
| C — Core intelligence | 4–6 |
| D — Integration | 3–4 (plus integration-reviewer) |
| E — Validation | 3–5 |
| F — Release | 3–5 |

Official guidance: start with 3–5 teammates; token cost scales linearly with teammates; aim for 5–6 tasks per teammate.

## Stage A — Research / Architecture

- **Active:** product-clinical-architect, clinical-safety-engineer, evidence-research-engineer, ux-accessibility-engineer; chief-architect acts as architect.
- **BUILD_PLAN phases:** 0 (and re-verification of docs before each later stage).
- **Mode:** agent team (discussion and challenge of findings is valuable) or parallel subagents.
- **Outputs:** consistent specs, open-decision updates, provider verification plans.

## Stage B — Foundations

- **Active:** data-engineer, backend-api-engineer (scaffold only after OD-004 is decided), mobile-android-engineer, ux-accessibility-engineer; devops-android-release-engineer for Phase 1–2 CI; security-privacy-engineer reviews.
- **BUILD_PLAN phases:** 1 Repository Foundation, 2 Expo and Android Foundation, 3 UI System, 4 Local Database, 5 Patient System, 6 Visit System.
- **Precondition for parallel work:** domain types and repository interfaces (Gate 2) and API client contracts (Gate 3) are fixed in `docs/INTEGRATION-CONTRACTS.md`.

## Stage C — Core Intelligence

- **Active:** speech-diarization-engineer, ai-clinical-engineer, evidence-research-engineer, backend-api-engineer; clinical-safety-engineer reviews continuously.
- **BUILD_PLAN phases:** 7 Recording, 8 Speech, 9 Speaker Diarization, 10 Clinical Extraction, 11 Medication Intelligence, 12 Evidence Engine, 13 AI Reasoning.
- **Gating decisions:** OD-001, OD-002, OD-004, OD-007 (project owner).

## Stage D — Integration

- **Active:** mobile-android-engineer, backend-api-engineer, speech-diarization-engineer, ai-clinical-engineer, data-engineer, integration-reviewer (at most 4 implementers at once).
- **BUILD_PLAN phases:** 14 Clinical Review, 15 Note Generation, 16 Longitudinal Memory, 17 Follow-Up, 18 Export.

## Stage E — Validation

- **Active:** qa-test-engineer, security-privacy-engineer, clinical-safety-engineer, integration-reviewer.
- **BUILD_PLAN phases:** 19 Security, 20 Privacy, 21 Testing, 22 Performance.

## Stage F — Release

- **Active:** devops-android-release-engineer, qa-test-engineer, security-privacy-engineer, clinical-safety-engineer, integration-reviewer.
- **BUILD_PLAN phases:** 23 Android Build, 24 Google Play, 25 Final Release Audit.
- **Gating decisions:** OD-003, OD-005, OD-006, OD-010; final go decision by the project owner.

## Subagent vs agent team

| Situation | Use |
|---|---|
| Small, isolated task; one result; no discussion | Subagent |
| Research where findings must be challenged across perspectives | Agent team |
| Parallel implementation of disjoint modules with fixed contracts | Agent team (or subagents in separate worktrees) |
| Same-file edits or tightly sequential work | Single agent, sequential |
| Non-interactive session (`claude -p`) | Subagents only (teams cannot be spawned) |

## Parallelization rules

- Safe to parallelize: API research, UI research, security review, test planning, evidence-source research, architecture review.
- Parallel implementation (mobile, speech, backend, data, AI) only after their shared contracts are frozen for the iteration.
- Never allow two agents to edit the same core file concurrently (`docs/AGENT-OWNERSHIP.md` lists core files).
- Use `isolation: worktree` or separate branches for parallel implementers.
