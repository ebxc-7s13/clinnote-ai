# Rule: Git Discipline (always loaded)

- Inspect `git status` and the diff before every commit.
- Small, focused commits with conventional prefixes: `docs:`, `feat:`, `fix:`, `test:`, `chore:`, `ci:`.
- Run lint, type check and tests before committing code.
- One agent edits a given core file at a time (`docs/AGENT-OWNERSHIP.md`). Parallel implementation uses separate branches or worktrees.
- Never commit secrets, patient data, recordings, model weights or build artifacts.
- Never rewrite published history except to purge a leaked secret with owner approval.
- Report whether work was pushed; never claim a remote state you did not verify.
