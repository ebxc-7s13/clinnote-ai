# Stage A — Agent-Team Test, Run 2 (Brief)

**Lead:** the interactive Claude Code session acting as chief-architect (Claude Code v2.1.294, agent teams enabled, Task tools enabled per ADR-037). Team: `session-b983a4a0`.

**Why run 2:** Run 1 (handoffs `2026-10-08-stage-a-team-{product,evidence,safety}.md`) was interrupted by a session limit before synthesis. It found residual conflicts, which the lead fixed (ADR-034, ADR-035, ADR-036). Run 2 reviews the corrected specifications and completes the messaging, dependency, plan-approval, quality-gate and handoff tests.

**No application code may be written. Teammates edit no file except their own handoff file.**

## 1. Team

| Teammate name | Agent type (`.claude/agents/`) | Purpose |
|---|---|---|
| `product` | product-clinical-architect | Task A |
| `evidence` | evidence-research-engineer | Task B |
| `safety` | clinical-safety-engineer | Task C |
| `backend` | backend-api-engineer | Task E (plan-approval and handoff test) |

## 2. Shared task list

The TaskCreated and TaskCompleted hooks enforce the description tags (`docs/QUALITY-GATES.md` "Task tags").

| Task | Owner | Handoff | Blocked by |
|---|---|---|---|
| A — Product specification review | product-clinical-architect | `2026-10-08-stage-a-team2-product.md` | — |
| B — Evidence architecture review | evidence-research-engineer | `2026-10-08-stage-a-team2-evidence.md` | — |
| C — Clinical safety review | clinical-safety-engineer | `2026-10-08-stage-a-team2-safety.md` | — |
| D — Integration conclusion | chief-architect | `2026-10-08-stage-a-team2-synthesis.md` | A, B, C |
| E — Mock architecture review + plan | backend-api-engineer | `2026-10-08-stage-a-team2-backend.md` | — |
| QG-1…QG-4 — quality-gate probes | qa-test-engineer / clinical-safety-engineer / security-privacy-engineer | scratchpad files outside the repository | — (never completed; deleted after the probe) |

## 3. Shared review question (A, B, C)

"Review the reconciled ClinNote specifications and identify any remaining conflicts between product workflow, evidence retrieval, and clinical safety."

Required direct messages (SendMessage, first line starts with `[STAGE-A2-MSG]`): `product → evidence`, `evidence → safety`, `safety → product`. Each recipient replies. All three report to `team-lead`.

## 4. Plan approval (E)

`backend` plans BUILD_PLAN Phase 7 task group 7B without modifying files, sends the plan to `team-lead`, and waits. The lead approves only a plan that contains implementation steps, tests, security considerations, documentation updates and a handoff. The native plan-mode approval is described in §5 of the synthesis.

## 5. Dependency and quality-gate tests

The lead tries to complete Task D before A, B and C are done, and records the result. The QG probes use deliberately non-compliant tasks to show the hooks block them.
