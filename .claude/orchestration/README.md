# ClinNote AI — Orchestration Directory

This directory holds the operational configuration that the chief-architect uses to run the ClinNote agent organization. It complements the human-readable system documentation in `docs/AGENT-*.md`.

| File | Purpose |
|---|---|
| `team-stages.md` | Development stages A–F, which agents are active in each, concurrency limits, subagent-vs-team choice |
| `spawn-prompts.md` | Reusable, self-contained spawn prompt templates for each agent and for teams |
| `hooks-plan.md` | Hook plan: H1–H3, H6 and H8 enabled (Stage A); the rest proposed, with the conditions for enabling them |

Related configuration:

- `.claude/agents/*.md` — the 14 agent definitions (project scope).
- `.claude/rules/*.md` — always-loaded project rules (clinical safety, privacy, security, testing/evidence, Git, documentation/scope, reporting).
- `.claude/settings.json` — sets `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` (agent teams are experimental; see ADR-020).

## How to start the organization

Recommended (interactive, enables agent teams):

```bash
claude --agent chief-architect
```

Then give the chief-architect a goal, e.g. *"Execute BUILD_PLAN Phase 1 per the agent system."* The chief-architect reads the docs, builds the task graph, and spawns the specialists named in `docs/AGENT-OWNERSHIP.md`.

Non-interactive (`claude -p`) sessions can delegate to subagents but **cannot spawn agent-team teammates** (documented Claude Code behavior); use them for isolated research or verification only.

## Version note

Configuration verified against Claude Code v2.1.293 and the official docs at code.claude.com (sub-agents, agent-teams, hooks, memory) on 2026-10-08, and re-verified against v2.1.294 (agent-teams, hooks, tools-reference) in Stage A on the same date. Re-verify after Claude Code upgrades, because agent teams are experimental.
