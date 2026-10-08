# ClinNote AI — Agent System

The multi-agent engineering organization that will build ClinNote AI. This document is the overview; details live in the linked files.

---

## 1. Why Multiple Agents

ClinNote spans an Android app, a serverless backend, a speech pipeline, sixteen AI jobs, a dozen evidence sources, a local clinical database, security/privacy controls, clinical-safety validation and a Play Store release. One agent holding all of that in context drifts and makes unreviewed cross-layer changes. Separate agents give:

- **focused context** — each agent reads only the specs for its area
- **clear ownership** — one owner per file and interface, fewer conflicting edits
- **independent review** — safety, security, QA and integration review work they did not write
- **parallelism** — independent research and implementation run at the same time
- **least privilege** — each agent gets only the tools its role needs

The cost is coordination overhead and more tokens. The chief-architect activates only the agents a stage needs (§7).

## 2. Agent Roles

| # | Agent | Model | Role | Key tools |
|---|---|---|---|---|
| 01 | chief-architect | opus | Orchestrates: plans, delegates, verifies evidence, integrates, gates, records status | Agent, SendMessage, Task tools, Read/Write/Edit, Bash |
| 02 | product-clinical-architect | opus | Product requirements, clinical workflows, terminology, semantics | Read/Write/Edit (docs), SendMessage |
| 03 | mobile-android-engineer | sonnet | Expo/React Native/TypeScript Android app | Read/Write/Edit, Bash, WebFetch |
| 04 | backend-api-engineer | sonnet | Serverless backend: auth, validation, routing, secrets, rate limits | Read/Write/Edit, Bash, WebFetch |
| 05 | speech-diarization-engineer | sonnet | Recording, transcription, diarization, role mapping | Read/Write/Edit, Bash, WebFetch, WebSearch |
| 06 | ai-clinical-engineer | opus | 16 AI jobs, schemas, validators, hallucination/injection defense | Read/Write/Edit, Bash, WebFetch |
| 07 | evidence-research-engineer | opus | API verification, staged evidence retrieval, citations | Read/Write/Edit, Bash, WebFetch, WebSearch |
| 08 | data-engineer | sonnet | Domain model, SQLite, migrations, provenance, integrity | Read/Write/Edit, Bash |
| 09 | security-privacy-engineer | opus | Security/privacy review with rejection authority | Read, Grep, Glob, Bash, Write/Edit (own docs), WebFetch |
| 10 | clinical-safety-engineer | opus | Safety tests and reviews; can reject a build | Read, Grep, Glob, Bash, Write/Edit (safety tests/docs) |
| 11 | qa-test-engineer | sonnet | All test automation and test evidence | Read/Write/Edit, Bash |
| 12 | devops-android-release-engineer | sonnet | CI, EAS builds, signing, environments, Play prep | Read/Write/Edit, Bash, WebFetch |
| 13 | ux-accessibility-engineer | sonnet | UX specification, accessibility, design review | Read, Grep, Glob, Write/Edit (UX docs) |
| 14 | integration-reviewer | opus | Cross-layer and release-readiness review | Read, Grep, Glob, Bash, Write (reviews) |

Only chief-architect has the `Agent` tool, so only it delegates. Specialists communicate with `SendMessage`. In an agent team, Claude Code adds `SendMessage` and the Task tools to in-process teammates automatically.

Definitions: `.claude/agents/<name>.md`.

## 3. Ownership

One primary owner per area, document and code path. See `AGENT-OWNERSHIP.md`. Core files (data model, schemas, provider interfaces, migrations, lockfile, settings) have a single writer at a time.

## 4. Dependencies

The phase graph, critical path and safe parallel sets are in `AGENT-TASK-GRAPH.md`. Owner decisions on the critical path are OD-007, OD-001, OD-004, OD-002, OD-005, OD-003, OD-006 and OD-010 (`DECISIONS.md`).

## 5. Communication

There are four levels: direct message, task list, repository handoff, and decision log. `AGENT-COMMUNICATION.md` defines them, along with the handoff format, the Integration Contract notice, blocker reports and self-reports. Interfaces are registered in `INTEGRATION-CONTRACTS.md`.

## 6. Task Flow

```text
chief-architect: DISCOVER → PLAN → DELEGATE → PARALLELIZE
specialist:      START → DISCOVER → READ DOCS → CHECK DEPS → CLAIM → IMPLEMENT → TEST → REPORT → HANDOFF
review chain:    responsible agent → qa-test-engineer → security-privacy / clinical-safety (if relevant)
                 → integration-reviewer → chief-architect acceptance
chief-architect: INTEGRATE → REGRESSION → GATES → STATUS → COMMIT → CONTINUE
```

Procedure: `AGENT-RUNBOOK.md`.

## 7. Stages and Concurrency

| Stage | Active agents | Ceiling |
|---|---|---|
| A Research / architecture | product, clinical safety, evidence, UX, chief as architect | 3–5 |
| B Foundations | data, backend, mobile, UX (+ devops for CI) | 4–6 |
| C Core intelligence | speech, AI, evidence, backend | 4–6 |
| D Integration | mobile, backend, speech, AI, data, integration | 3–4 + reviewer |
| E Validation | QA, security, clinical safety, integration | 3–5 |
| F Release | DevOps, QA, security, clinical safety, integration | 3–5 |

Details: `.claude/orchestration/team-stages.md`.

## 8. Quality Gates

There are ten gates: Architecture, Data model, API contracts, Feature implementation, Integration, Clinical safety, Security/privacy, Testing, Android build and Play Store readiness. Each gate is PASS, FAIL or BLOCKED, and only evidence can pass it. A FAIL on clinical safety (Gate 6) or security/privacy (Gate 7) blocks release. See `QUALITY-GATES.md`.

## 9. Escalation

Specialist → specialist (message) → chief-architect (conflict resolution, `AGENT-RUNBOOK.md` §5) → project owner. The project owner handles credentials, accounts, legal and regulatory questions (OD-005, OD-006), licensing (OD-010), provider selection approvals, and the final release decision.

## 10. Handoff

Every completed major cross-agent task produces a handoff file in `docs/agent-handoffs/` (`TEMPLATE.md`) and a message to the receiving agent. No handoff means no completion.

## 11. Release Process

Phases 23–25: devops builds a signed AAB → QA runs device tests → security and clinical safety give their gate verdicts → integration-reviewer reviews release readiness → chief-architect accepts → **the project owner makes the go decision**. No agent may claim "release ready" or "production ready" without Gates 1–10 evidence.

## 12. Runtime Configuration

| Item | Configuration | Status |
|---|---|---|
| Project subagents | `.claude/agents/*.md` (14) | Created; a fresh session discovered all 14 (see BUILD_REPORT) |
| Project rules | `.claude/rules/*.md` (7, always loaded) | Created |
| Agent teams | `.claude/settings.json` → `env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = "1"` | Enabled (experimental, ADR-020) |
| Hooks | `.claude/orchestration/hooks-plan.md` | Documented, **not enabled** |
| Lead session | `claude --agent chief-architect` (interactive, for teams) | Documented |

### How to run

- **Full team (recommended for multi-layer phases):** start an interactive session with `claude --agent chief-architect`. Then ask it to execute the next BUILD_PLAN phase with an agent team. Teammates can only be spawned from an interactive session, and only the lead manages the team.
- **Subagent mode (fallback):** use any session, interactive or `claude -p`. chief-architect, or the main session, delegates to the specialists with the Agent tool and relays messages with SendMessage. Coordination happens through handoff files and the Active Task Board (`AGENT-TASK-GRAPH.md` §6).

### Known platform limitations (Claude Code v2.1.293, verified 2026-10-08)

- Agent teams are experimental. Teammates can't be restored after `/resume`. Task status can lag, and there is one team per session.
- Teammates cannot spawn teammates. Only the lead manages the team.
- Non-interactive (`-p`) sessions cannot spawn teammates.
- A session only watches agent directories that existed when it started. If `.claude/agents/` is created during a session, that session must be restarted to see the agents.

## 13. Terminal Report

At the end of each orchestrated session, the final report is shown in the terminal and also appended to `terminal_report.txt` at the repository root, under a UTC timestamp header (`.claude/rules/reporting.md`).
