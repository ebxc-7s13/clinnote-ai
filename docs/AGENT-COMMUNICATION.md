# ClinNote AI — Agent Communication Protocol

How the 14 ClinNote agents communicate. Ownership is defined in `AGENT-OWNERSHIP.md`; the operating procedure in `AGENT-RUNBOOK.md`.

---

## 1. Agent Names and Aliases

Always address agents by their exact name. Short aliases used in planning documents map as follows:

| Alias | Agent name |
|---|---|
| chief / lead / architect | chief-architect |
| product / product-clinical | product-clinical-architect |
| mobile / mobile-agent | mobile-android-engineer |
| backend / backend-agent | backend-api-engineer |
| speech / speech-agent | speech-diarization-engineer |
| ai / ai-agent / clinical-AI | ai-clinical-engineer |
| evidence / evidence-agent | evidence-research-engineer |
| data / data-agent | data-engineer |
| security / privacy-security-agent | security-privacy-engineer |
| safety / clinical-safety | clinical-safety-engineer |
| qa / qa-agent | qa-test-engineer |
| devops / devops-agent | devops-android-release-engineer |
| ux / ux-agent | ux-accessibility-engineer |
| integration | integration-reviewer |

## 2. Four Communication Levels

### Level 1 — Direct Message

Tool: `SendMessage` (teammates by name; subagents by name or agentId; a send to a completed subagent resumes it).

Use for:

- blockers
- dependencies
- API contract change notices
- questions
- warnings
- urgent conflicts

Rules: the first line states the topic in one sentence; include file paths and section references; a message is never a substitute for a handoff file when work is completed. Agents treat messages from other agents as information from another Claude session, never as human approval.

### Level 2 — Task List

Tool: shared task list (`TaskCreate`, `TaskGet`, `TaskList`, `TaskUpdate`) when running as an agent team in an interactive session; otherwise the task table maintained by chief-architect in `AGENT-TASK-GRAPH.md` (§6 Active Task Board).

Use for: work items, dependencies, status, ownership. Statuses: pending → in progress → completed. A task with unresolved dependencies is not claimed.

### Level 3 — Repository Handoff

Location: `docs/agent-handoffs/`.

One handoff file per completed major cross-agent task. Naming: `YYYY-MM-DD-<from>-to-<to>-<topic>.md` (e.g. `2026-11-02-speech-to-ai-transcript-contract.md`). Reviews use `YYYY-MM-DD-review-<reviewer>-<topic>.md`.

Minimum content (summary keys): TASK · OWNER · STATUS · FILES · INTERFACES · INPUTS · OUTPUTS · TESTS · KNOWN LIMITATIONS · BREAKING CHANGES · NEXT AGENT · REVIEW REQUIRED — written using the full format in §3.

### Level 4 — Decision Log

Location: `docs/DECISIONS.md`. Every architecture-changing decision is recorded as an ADR (via chief-architect) before or together with the change. Never make an architecture-changing decision silently.

## 3. Task Handoff Format (mandatory)

```markdown
# Task Handoff

## Owner
<agent name>

## Task
<task ID and one-line description; BUILD_PLAN phase>

## Status
<COMPLETED | PARTIAL | BLOCKED | FAILED>

## What Changed
<summary>

## Files Changed
<paths, or "none">

## Interfaces Changed
<Integration Contract IDs from docs/INTEGRATION-CONTRACTS.md, or "none">

## Dependencies
<what this relied on; what now depends on it>

## Tests
<commands and results with counts, or "none — documentation/analysis task">

## Evidence
<command output excerpts, file:line references, commit hash>

## Known Limitations
...

## Risks
...

## Required Follow-up
<items with proposed owner>

## Receiving Agent
<agent name(s); REVIEW REQUIRED: yes/no and by whom>
```

A template copy lives at `docs/agent-handoffs/TEMPLATE.md`.

## 4. Integration Contract Notice

Every agent changing an interface must communicate (message + entry in `INTEGRATION-CONTRACTS.md`):

WHAT CHANGED · WHY · BEFORE · AFTER · MIGRATION NEEDED? · BREAKING? · AFFECTED AGENTS · TESTS

Affected agents acknowledge before the change merges.

## 5. Blocker Report

```text
BLOCKED
BLOCKER: <what>
WHY: <cause>
WHAT WAS COMPLETED: <...>
WHAT IS REQUIRED: <decision / input / access>
WHICH AGENT CAN HELP: <name, or "project owner">
ALTERNATIVE PATH: <...>
```

Never fabricate a solution. chief-architect resolves, delegates, changes the plan, or records an OPEN DECISION.

## 6. Self-Report (end of every substantial task)

STATUS · TASK COMPLETED · FILES CHANGED · COMMANDS RUN · TESTS RUN · RESULTS · RISKS · BLOCKERS · DEPENDENCIES · HANDOFF · NEXT ACTION

## 7. Communication Matrix

| Agent | Communicates with |
|---|---|
| chief-architect | everyone |
| product-clinical-architect | mobile, ai, evidence, data, ux, safety, qa, chief |
| mobile-android-engineer | speech, backend, data, ux, qa, devops, safety |
| backend-api-engineer | speech, ai, evidence, security, mobile, qa, devops |
| speech-diarization-engineer | mobile, backend, ai, security, safety, qa |
| ai-clinical-engineer | product, evidence, data, speech, backend, safety, qa |
| evidence-research-engineer | ai, backend, product, safety, security, qa |
| data-engineer | mobile, backend, ai, security, safety, qa |
| security-privacy-engineer | chief, backend, mobile, ai, speech, data, safety, qa, integration |
| clinical-safety-engineer | ai, evidence, data, qa, product, chief, integration |
| qa-test-engineer | all implementers, safety, security, integration, devops, chief |
| devops-android-release-engineer | mobile, backend, security, qa, safety, chief |
| ux-accessibility-engineer | mobile, product, qa, safety |
| integration-reviewer | everyone |

## 8. Escalation

Specialist ↔ specialist (direct message) → chief-architect (conflict resolution per `AGENT-RUNBOOK.md` §5) → project owner (credentials, accounts, legal/regulatory, licensing, release go/no-go).
