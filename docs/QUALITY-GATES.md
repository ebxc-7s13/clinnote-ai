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
- **Pass criteria:** all applicable CS-01…CS-24 tests pass; no diagnosis/prescribing/dose/probability output; NOT_DISCUSSED never rendered as negative/normal; citations only from provider responses; review of AI/evidence/data changes completed.
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
- **Pass criteria:** `GOOGLE-PLAY.md` §16 checklist complete with evidence; policies re-checked on submission date; no prohibited claims; OD-005, OD-006, OD-010 resolved.
- **Evidence:** checklist with dates and links.

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
| 10 Play Store readiness | BLOCKED | No app; OD-005/006/010 open |
