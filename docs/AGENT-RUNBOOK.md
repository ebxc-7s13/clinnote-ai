# ClinNote AI — Agent Runbook

The standard operating procedure every ClinNote agent follows. A teammate must not mark a task complete without evidence.

---

## 1. Task Lifecycle

```text
START → DISCOVER → READ DOCS → CHECK TASK DEPENDENCIES → CLAIM TASK → IMPLEMENT → TEST
→ REPORT → HANDOFF → REQUEST REVIEW → MERGE / INTEGRATE → RUN REGRESSION → CONTINUE
```

### START

Confirm your identity (agent name), the task ID, acceptance criteria, allowed paths and receiving agent from the spawn prompt. If any is missing, ask chief-architect before acting.

### DISCOVER

Inspect the actual repository: `git status`, `git log --oneline -5`, the files in your area. Do not trust earlier reports — the filesystem and command output are the truth.

### READ DOCS

Always: `CLAUDE.md`, `docs/PROJECT-STATUS.md`, your agent definition. Then the specs named in your definition and the task, and the handoff files your task depends on. Respect the authority order (`CLAUDE.md` §2).

### CHECK TASK DEPENDENCIES

Check `docs/AGENT-TASK-GRAPH.md` and the shared task list. If a dependency is not completed with evidence, do not start — report BLOCKED or pick another unblocked task.

### CLAIM TASK

Claim in the shared task list (TaskUpdate) or confirm assignment with chief-architect. One owner per task. Announce intent to edit any core file (`AGENT-OWNERSHIP.md` §4) before editing.

### IMPLEMENT

Within your owned paths only. Follow clinical-safety, privacy and security rules. Interface change → Integration Contract first (`INTEGRATION-CONTRACTS.md`). Synthetic data only. Verify external APIs in official docs immediately before use.

### TEST

Run the tests named in BUILD_PLAN for the phase plus any you added. Record command, counts, environment, UTC date. Never claim a test result you did not observe.

### REPORT

Produce the self-report: STATUS · TASK COMPLETED · FILES CHANGED · COMMANDS RUN · TESTS RUN · RESULTS · RISKS · BLOCKERS · DEPENDENCIES · HANDOFF · NEXT ACTION.

### HANDOFF

Write `docs/agent-handoffs/<date>-<from>-to-<to>-<topic>.md` in the Task Handoff format (`AGENT-COMMUNICATION.md` §3) and message the receiving agent.

### REQUEST REVIEW

Review chain: responsible agent → qa-test-engineer → security-privacy-engineer and/or clinical-safety-engineer (when relevant) → integration-reviewer → chief-architect acceptance.

### MERGE / INTEGRATE

chief-architect (or the owner on its instruction) merges after reviews pass. Parallel work on separate branches/worktrees is merged one at a time.

### RUN REGRESSION

After every merge, qa-test-engineer re-runs the regression suite (including clinical safety). A regression reopens the task.

### CONTINUE

Update `PROJECT-STATUS.md` (chief-architect), then take the next unblocked task in `BUILD_PLAN.md` order.

## 2. Definition of Done

A task is done only when all are true:

1. acceptance criteria met
2. tests run and passing (evidence recorded)
3. relevant gates evaluated (`QUALITY-GATES.md`)
4. handoff written
5. reviews passed
6. docs updated if behavior or interfaces changed
7. committed (hash recorded)

## 3. Evidence Standard

Accepted evidence: file paths, diffs, exact commands and outputs, test counts, build output, synthetic API responses, screenshots of synthetic data, commit hashes. Not evidence: "implemented", "should work", "tests pass" without output, another agent's claim.

## 4. Anti-Drift Checklist (before every task)

- [ ] read CLAUDE.md and relevant docs
- [ ] checked PROJECT-STATUS and dependencies
- [ ] task is in BUILD_PLAN scope — no invented requirements
- [ ] no feature silently removed
- [ ] no architecture change without ADR
- [ ] files to edit are owned by me or coordinated

## 5. Conflict Resolution

1. identify the conflict
2. inspect authoritative documentation
3. inspect actual implementation
4. identify impact
5. ask the relevant specialist agents to evaluate
6. chief-architect makes the integration decision
7. document architectural changes (ADR)
8. update affected agents
9. test

Never resolve an architectural disagreement by silently overwriting another agent's work.

## 6. Blocker Protocol

Report BLOCKED · BLOCKER · WHY · WHAT WAS COMPLETED · WHAT IS REQUIRED · WHICH AGENT CAN HELP · ALTERNATIVE PATH. Do not fabricate. chief-architect resolves, delegates, re-plans, or records an OPEN DECISION; owner-only items (keys, accounts, legal, regulatory, licensing, release go) go to the project owner.

## 7. One Orchestrating Session per Working Tree

Only one lead (orchestrating) Claude session writes to a given working tree at a time. A second concurrent session must use its own git worktree or branch (`claude --worktree`), or stay read-only. Before writing, a lead session checks `git status` for uncommitted changes it did not make, and asks the project owner how to proceed if it finds any. (Added after dry-run concern 16, where the dry-run lead correctly detected edits made concurrently by the setup session and did not touch them.)

## 8. Session Close

At the end of an orchestrated session, chief-architect: updates `PROJECT-STATUS.md`, `AGENT-STATUS.md`, `BUILD_REPORT.md`; commits; appends the final terminal report with a UTC timestamp to `terminal_report.txt`; pushes after a clean final verification (`.claude/rules/reporting.md`).
