# Rule: Reporting (always loaded)

- End every substantial piece of work with: STATUS · TASK COMPLETED · FILES CHANGED · COMMANDS RUN · TESTS RUN · RESULTS · RISKS · BLOCKERS · DEPENDENCIES · HANDOFF · NEXT ACTION.
- Blocked work is reported as: BLOCKED · BLOCKER · WHY · WHAT WAS COMPLETED · WHAT IS REQUIRED · WHICH AGENT CAN HELP · ALTERNATIVE PATH. Never fabricate a solution.
- The session's final report shown in the terminal is also appended to `terminal_report.txt` at the repository root, under a header line `===== <UTC ISO-8601 timestamp> — <short title> =====`. Append only; never rewrite earlier entries.
- After the final verification of a completed task, the project owner has asked that the work be committed and pushed to GitHub (`origin main`) without asking first, provided every verification passed. If any verification fails, do not push; report instead.
