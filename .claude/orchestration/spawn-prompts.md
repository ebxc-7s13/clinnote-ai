# ClinNote AI — Spawn Prompt Templates

Teammates and subagents do **not** inherit the lead's conversation. Every spawn prompt must be self-contained. Fill the `<…>` fields.

## Universal specialist spawn template

```text
You are the <agent-name> for ClinNote AI (see .claude/agents/<agent-name>.md).
Phase/stage: BUILD_PLAN Phase <n> — <name>; Stage <A–F>.
Task ID: <T-n.m>  Task: <one-sentence task>.
Acceptance criteria:
  1. <criterion with measurable evidence>
  2. ...
Read first: CLAUDE.md, docs/PROJECT-STATUS.md, <specific docs and sections>, <handoff files>.
You may modify: <exact paths>. You must not modify: <paths owned by others>.
Interfaces you must respect: <docs/INTEGRATION-CONTRACTS.md entries>.
Dependencies already satisfied: <task IDs + evidence>.
Required evidence: commands + outputs, test counts, files changed, commit hash (if committing).
Hand off to: <receiving agent> via docs/agent-handoffs/<from>-to-<to>-<topic>.md.
Constraints: synthetic data only; no secrets; no model downloads; clinical-safety rules apply.
Finish with the self-report fields from .claude/rules/reporting.md.
```

## Agent team spawn (lead, interactive session only)

```text
Create an agent team for <goal>. Spawn teammates using these agent types and names:
- "<short-name>" using the <agent-name> agent type: <task, files, acceptance criteria>
- ...
Create tasks with dependencies: <T1> → <T2>, <T3> independent.
Teammates must message each other directly about <contract/finding to discuss>.
Each teammate writes its handoff in docs/agent-handoffs/ and reports with the self-report fields.
Wait for all teammates to finish before synthesizing.
```

## Review chain prompts

- **QA:** "Run <tests> for <commit>. Record command, counts, environment, UTC date. Route failures to owners."
- **Security/privacy:** "Review <diff/handoff> against SECURITY §20 and PRIVACY §17. Verdict PASS/FAIL/BLOCKED with file:line findings."
- **Clinical safety:** "Run CS-<ids> and review <change> against CLINICAL-SAFETY. Verdict PASS/FAIL/BLOCKED."
- **Integration:** "Review <commit range> across layers per integration-reviewer checklist. Verdict with evidence."

## Dry-run prompt used on 2026-10-08

See `docs/agent-handoffs/2026-10-08-dry-run-chief-architect.md` for the exact prompt and outcome.
