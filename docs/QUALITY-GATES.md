# ClinNote AI — Quality Gates

Gates are evaluated by their gate owner with evidence and accepted by chief-architect. Each gate is **PASS**, **FAIL** or **BLOCKED** (cannot be evaluated yet, e.g. an open decision or missing artifact). A gate never passes on a claim.

**A FAIL of Gate 6 (Clinical safety) or Gate 7 (Security/privacy) prevents release. No agent can override it; only re-evaluation after a fix can change it.**

---

## Gate Definitions

### Gate 1 — Architecture

- **Owner:** chief-architect; **reviewer:** integration-reviewer
- **Pass criteria:** implementation structure matches `ARCHITECTURE.md` layers and processing locations; every deviation has an accepted ADR; provider abstraction respected (no provider SDK in UI/domain).
- **Evidence:** directory tree, import-boundary check output, ADR references.

### Gate 2 — Data Model

- **Owner:** data-engineer; **reviewers:** security-privacy-engineer, ai-clinical-engineer, clinical-safety-engineer
- **Pass criteria:** schema matches `DATA_MODEL.md`; information state / provenance / review status separate; state-machine and actor rules enforced; cascade delete works; migrations run from empty.
- **Evidence:** schema dump, test command + counts.

### Gate 3 — API Contracts

- **Owner:** backend-api-engineer; **reviewer:** integration-reviewer
- **Pass criteria:** every endpoint and provider interface has an entry in `INTEGRATION-CONTRACTS.md`; client and backend schemas match; providers verified in `API_CATALOG.md` §31 before use; contract tests pass.
- **Evidence:** contract test output, verification log rows.

### Gate 4 — Feature Implementation

- **Owner:** the responsible feature agent; **reviewer:** qa-test-engineer
- **Pass criteria:** BUILD_PLAN completion criteria for the phase met; FR IDs covered by tests; loading/empty/error states present; handoff written.
- **Evidence:** test output, screenshots (synthetic), handoff file.

### Gate 5 — Integration

- **Owner:** integration-reviewer
- **Pass criteria:** cross-layer flows work end to end with mock providers; full regression suite re-run after integration; no unacknowledged breaking contract changes; no dependency conflicts.
- **Evidence:** E2E output, regression run, commit hash.

### Gate 6 — Clinical Safety (release-blocking)

- **Owner:** clinical-safety-engineer
- **Pass criteria:** all applicable CS-01…CS-46 tests (including CS-16a) pass, and a **pending test never counts as passing**; the phase's safety corpus cases exist (`TESTING.md` §13a); with `possibilitiesEnabled` OFF no R2 job runs (CS-37); no diagnosis/prescribing/dose/probability output; NOT_DISCUSSED never rendered as negative/normal; citations only from provider responses; review of AI/evidence/data changes completed.
- **Evidence:** safety suite output (command, counts), review file.

### Gate 7 — Security / Privacy (release-blocking)

- **Owner:** security-privacy-engineer
- **Pass criteria:** `SECURITY.md` §20 and `PRIVACY.md` §17 acceptance criteria applicable to the scope pass; secret scan clean; no clinical content in logs/crash/analytics; no secrets in client.
- **Evidence:** scan output, audit output, log inspection notes, review file.

### Gate 8 — Testing

- **Owner:** qa-test-engineer
- **Pass criteria:** `TESTING.md` §15 acceptance criteria; synthetic scenarios required for the phase pass; coverage targets met; flaky tests listed.
- **Evidence:** test runs with command, counts, environment, UTC date.

### Gate 9 — Android Build

- **Owner:** devops-android-release-engineer; **reviewer:** qa-test-engineer
- **Pass criteria:** signed AAB built from the reviewed commit; target SDK meets current Play requirement (verified date); device test checklist (`TESTING.md` §12) complete.
- **Evidence:** EAS build ID/logs, artifact name, versionCode, device test record.

### Gate 10 — Play Store Readiness

- **Owner:** devops-android-release-engineer; **reviewers:** security-privacy-engineer, clinical-safety-engineer, qa-test-engineer
- **Pass criteria:** `GOOGLE-PLAY.md` §16 checklist complete with evidence; policies re-checked on submission date; no prohibited claims; the formal regulatory assessment required by ADR-025 (OD-005 engineering gate) documented for each target market; OD-006, OD-010 and OD-011 resolved; release build has `possibilitiesEnabled` OFF unless that assessment permits R2.
- **Evidence:** checklist with dates and links.

## Enforcement Mechanism (hooks, enabled Stage A)

The gates are enforced partly by people (reviewers) and partly by **read-only Claude Code hooks** configured in `.claude/settings.json`. The hooks never modify or delete anything. They only allow (exit 0) or block with a reason (exit 2), as described in the official hooks reference.

| Hook | Event | Script | Enforces |
|---|---|---|---|
| H1–H3 | PreToolUse (`Write\|Edit\|Bash`) | `.claude/hooks/secret_guard.py` | blocks writing secrets, `.env` files, staged secrets on `git commit`/`push`, and model-weight or ML-framework downloads (Gate 7, ADR-003) |
| H8 | TaskCreated | `.claude/hooks/task_gate.py` | every task names an `Owner:` that is a ClinNote agent or `project-owner` |
| H6 | TaskCompleted | `.claude/hooks/task_gate.py` | the tag rules below (Gates 4, 6, 7, 8), and **task dependencies**: completion is blocked while any `blockedBy` task is unfinished. Claude Code's own `blockedBy` only prevents claiming (Stage A finding). The hook reads the session task list read-only |

Hook tests: `python3 -I .claude/hooks/tests/test_hooks.py` (23 tests). Live probes (an ownerless task, a missing-tests task, a safety-sensitive task without review, and a dependency) were re-run in the Stage A resume session and are recorded in `docs/agent-handoffs/2026-10-08-stage-a-team2-synthesis.md` §5 and Tests. Run-2 probe output was not preserved. Credential exposure in handoffs is covered by the unit tests.

### Task tags

Each tag goes on its own line in the task description.

| Tag | Meaning | Enforced at completion |
|---|---|---|
| `Owner: <agent-name>` | responsible agent | required at creation |
| `Handoff: docs/agent-handoffs/<file>.md` | handoff file for the task | file must exist with non-empty `## Tests`, `## Evidence` and `## Receiving Agent` sections, and must contain no credential |
| `Tests-required: yes\|no` | the task changes behavior | `yes` → `## Tests` must contain test commands with result counts. A task without tests is **not release-complete** |
| `Safety-sensitive: yes\|no` | the task touches clinical data, AI, evidence, provenance or notes | `yes` → the handoff must contain `Safety review: PASS` (from clinical-safety-engineer) |
| `Security-sensitive: yes\|no` | the task touches secrets, auth, network, storage, logging or exports | `yes` → the handoff must contain `Security review: PASS` (from security-privacy-engineer) |

A gated task without a `Handoff:` line cannot be completed. Credential exposure in a handoff always fails.

### Scope of hook enforcement

The hooks are a backstop, not the whole gate. Reviewers still assess quality, and chief-architect still accepts each gate on evidence.

TaskCreated and TaskCompleted fire only for the shared task list (agent teams, or sessions with the Task tools). PreToolUse fires for every session that loads the project settings.

## Gate Order per Phase

Feature work: Gate 4 → Gate 8 → Gate 6/7 (when patient data, AI, evidence, audio, secrets or providers are involved) → Gate 5 → chief-architect acceptance. Gates 1–3 are evaluated when architecture, data model or contracts change. Gates 9–10 apply to Phases 23–25.

## Current Gate Status

Phase 0 — documentation and agent system only. No application exists, so implementation gates cannot be evaluated.

| Gate | Status | Evidence / reason |
|---|---|---|
| 1 Architecture | BLOCKED | No implementation yet; architecture documented in `ARCHITECTURE.md` |
| 2 Data model | BLOCKED | No schema yet; model documented in `DATA_MODEL.md` |
| 3 API contracts | BLOCKED | No endpoints yet; contract register initialized in `INTEGRATION-CONTRACTS.md`; no provider verified |
| 4 Feature implementation | BLOCKED | No features |
| 5 Integration | BLOCKED | No integration |
| 6 Clinical safety | BLOCKED | Requirements documented only |
| 7 Security/privacy | BLOCKED | Requirements documented only |
| 8 Testing | BLOCKED | No test suite yet |
| 9 Android build | BLOCKED | No app |
| 10 Play Store readiness | BLOCKED | No app; ADR-025 formal assessment not yet performed; OD-006/010/011 open |
