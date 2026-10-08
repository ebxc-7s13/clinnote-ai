# Stage A — Real Agent-Team Test Brief

This brief was given to the lead session (`claude --agent chief-architect`, interactive, agent teams enabled) on 2026-10-08. It is kept as the record of what the team was asked to do. **No application code may be written. Teammates may create only the files named here.**

## 1. Team

Spawn an **agent team** (named teammates, not plain subagents) using the project agent definitions:

| Teammate name | Agent type |
|---|---|
| `product` | product-clinical-architect |
| `evidence` | evidence-research-engineer |
| `safety` | clinical-safety-engineer |
| `backend` | backend-api-engineer (plan-approval and handoff test only) |

Spawn `product`, `evidence` and `safety` in parallel. Spawn `backend` after Task D's dependencies exist.

## 2. Shared task list (use TaskCreate / TaskUpdate)

Every task description must include the tag lines shown (the TaskCreated/TaskCompleted hooks enforce them; see `docs/QUALITY-GATES.md` "Task tags").

- **Task A — Product specification review.** Description lines: `Owner: product-clinical-architect` · `Handoff: docs/agent-handoffs/2026-10-08-stage-a-team-product.md` · `Tests-required: no`
- **Task B — Evidence architecture review.** `Owner: evidence-research-engineer` · `Handoff: docs/agent-handoffs/2026-10-08-stage-a-team-evidence.md` · `Tests-required: no`
- **Task C — Clinical safety review.** `Owner: clinical-safety-engineer` · `Handoff: docs/agent-handoffs/2026-10-08-stage-a-team-safety.md` · `Tests-required: no`
- **Task D — Integration conclusion.** `Owner: chief-architect` · `Handoff: docs/agent-handoffs/2026-10-08-stage-a-team-synthesis.md` · `Tests-required: no` · **blocked by A, B, C**
- **Task E — Mock architecture review and plan (backend).** `Owner: backend-api-engineer` · `Handoff: docs/agent-handoffs/2026-10-08-stage-a-team-backend.md` · `Tests-required: no`
- **Task QG — Quality-gate probe.** `Owner: qa-test-engineer` · `Handoff: docs/agent-handoffs/2026-10-08-stage-a-qg-probe.md` · `Tests-required: yes`. Do **not** create the handoff file. The lead attempts to complete this task, records the hook's blocking message, then deletes the task. It must never be completed.

**Dependency test.** Immediately after creating the tasks, *before* A, B and C are done, the lead attempts to mark Task D completed. It records what happens (blocked by the dependency, the hook, or both), then sets D back to pending if needed. D is completed only after A, B and C are completed.

## 3. Shared review task for product, evidence and safety

"Review the reconciled ClinNote specifications and identify any remaining conflicts between product workflow, evidence retrieval, and clinical safety."

Each teammate:

1. reads `CLAUDE.md`, `docs/PROJECT-STATUS.md` (Stage A findings), `docs/DECISIONS.md` (ADR-021–ADR-033), plus its own documents:
   - **product:** PRODUCT_SPEC, UI-UX, DATA_MODEL §8–§10
   - **evidence:** EVIDENCE-SOURCES, API_CATALOG, ARCHITECTURE §6.4, AI.md §3
   - **safety:** CLINICAL-SAFETY, TESTING §6–§7 and §13a, DATA_MODEL §3.2/§8/§9, AI.md §5–§6/§15
2. reviews independently
3. **sends the required direct message with SendMessage** (each message must start with `[STAGE-A-MSG]`):
   - `product` → `evidence`: one question or concern about the evidence/possibility order from the workflow perspective
   - `evidence` → `safety`: one concern about citation or evidence safety
   - `safety` → `product`: one concern about provenance or contradiction semantics in the product spec
4. replies to any message it receives
5. writes its handoff file in the format of `docs/agent-handoffs/TEMPLATE.md`. Every section has content, including Next Action. Tests: "none — documentation review task (0 tests)". It records the messages it sent and received (recipient or sender, first line, time)
6. sends its findings to the lead: remaining conflicts (file + section), severity, and a proposed fix

Teammates edit **no file other than their own handoff file.**

## 4. Plan-approval test (backend)

`backend` must **not modify any file except its own handoff**. It prepares a plan for BUILD_PLAN Phase 7 task group 7B (backend foundation) and sends the plan to the lead with SendMessage. The lead reviews the plan against this checklist:

- implementation steps
- tests
- security considerations
- documentation updates
- handoff

The lead **rejects** the first plan if any item is missing, with specific feedback, and **approves** only a complete plan. The lead records both the decision and the reason.

If the native plan-approval mechanism is used, the lead records how it behaved. Per the official docs, a teammate spawned while the lead is in plan mode sends a plan approval request that Claude Code approves automatically.

`backend` then completes Task E: a mock architecture review of IC-004, IC-013, IC-015 and IC-019 (`docs/INTEGRATION-CONTRACTS.md`). It writes its handoff with these sections: Owner, Task, Status, Files, Interfaces, Tests, Risks, Limitations, Receiving Agent, Next Action.

## 5. Lead synthesis

After A, B and C are complete, the lead writes `docs/agent-handoffs/2026-10-08-stage-a-team-synthesis.md`. It must contain:

- the team members and their agent types
- the tasks with their final statuses
- the dependency test result
- the quality-gate probe result (the exact hook message)
- a message log (sender → recipient, first line) for every inter-agent message
- the plan-approval record
- the consolidated remaining conflicts (with owner and proposed fix)
- a verification table: team spawning, direct messaging, shared task list, dependency test, plan approval, quality gate, handoffs. Each row is PASS, FAIL or NOT AVAILABLE, with evidence

The lead then completes Task D, asks all teammates to shut down, and ends with the self-report fields.
