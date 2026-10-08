# ClinNote AI — Hook Plan

Status (2026-10-08, Stage A): **H1, H2, H3, H6 and H8 are ENABLED** in `.claude/settings.json` (scripts `.claude/hooks/secret_guard.py` and `.claude/hooks/task_gate.py`; 23 unit tests in `.claude/hooks/tests/test_hooks.py`; live probes in `docs/agent-handoffs/2026-10-08-stage-a-team2-synthesis.md`). H6 also enforces task dependencies, because Claude Code's `blockedBy` does not stop an explicit completion. H4, H5, H7, H9 and H10 stay proposed until there is application code, a test runner, a linter and a type checker.

Hook events used below were verified against the official hooks reference (code.claude.com/docs/en/hooks) on 2026-10-08 for Claude Code v2.1.293. Exit code 2 blocks the action and sends stderr to Claude; exit code 1 does **not** block.

## Safety principles for all ClinNote hooks

- Hooks never delete, revert, or rewrite code or Git history.
- Hooks only read, check, and block with an explanation (exit 2) or warn (exit 0 with a message).
- Hook scripts live in `.claude/hooks/` (created when the first hook is enabled), are committed, reviewed by security-privacy-engineer, and are documented here before enabling.
- Hooks must be fast (seconds) and must not call external networks.

## Proposed hooks

| # | Event | Matcher | Purpose | Behavior | Enable in |
|---|---|---|---|---|---|
| H1 | PreToolUse | `Bash` | Block `git commit`/`git push` when staged changes contain secret patterns (`AIza…`, `sk-…`, `hf_…`, `BEGIN … PRIVATE KEY`, `*_API_KEY=<value>`) | exit 2 with the matching file:line | Phase 1 |
| H2 | PreToolUse | `Write\|Edit` | Block writes of real-looking secrets into any file; block writes of `.env` (except `.env.example`) | exit 2 | Phase 1 |
| H3 | PreToolUse | `Bash` | Block commands that download model weights or install PyTorch/CUDA (`pip install torch`, `huggingface-cli download`, `*.safetensors`, `*.gguf`) | exit 2 citing ADR-003 | Phase 1 |
| H4 | PostToolUse | `Edit\|Write` | Run formatter check and lint on the edited file only | warn (exit 0 + message); never auto-rewrite unrelated files | Phase 2 |
| H5 | PostToolUse | `Edit\|Write` | Type-check affected project | warn | Phase 2 |
| H6 | TaskCompleted | — | Prevent marking a task complete unless the task's handoff file exists in `docs/agent-handoffs/` and contains Tests and Evidence sections with content | exit 2 with missing items | Phase 2 (agent teams) |
| H7 | TeammateIdle | — | If the teammate's last report lacks the self-report fields, keep it working to produce them | exit 2 | Phase 2 (agent teams) |
| H8 | TaskCreated | — | Reject tasks without an owner from `docs/AGENT-OWNERSHIP.md` | exit 2 | Phase 2 (agent teams) |
| H9 | Stop | — | Remind to append the final report to `terminal_report.txt` if it was not updated this session | warn | Phase 1 |
| H10 | PreToolUse | `Bash` | Run the clinical-safety test suite before `git push` when files under AI/evidence/data paths changed | exit 2 on failure | Phase 10 |

## Enabling procedure

1. Write the script in `.claude/hooks/`, with a test that feeds sample hook JSON on stdin.
2. security-privacy-engineer reviews; chief-architect approves.
3. Add to `.claude/settings.json` `hooks` block using the documented structure:

```json
{
  "hooks": {
    "PreToolUse": [
      { "matcher": "Bash", "hooks": [ { "type": "command", "command": ".claude/hooks/secret-scan.sh" } ] }
    ]
  }
}
```

4. Record the enablement in `docs/DECISIONS.md` and `docs/AGENT-SYSTEM.md`.
