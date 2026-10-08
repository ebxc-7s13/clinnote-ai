# Task Handoff

## Owner

backend-api-engineer (teammate `backend`)

## Task

Task E (#5) — Backend 7B plan and mock architecture review of IC-004, IC-013, IC-015, IC-019 — BUILD_PLAN Phase 7 task group 7B (Stage A team test, run 2)

## Status

COMPLETED

## What Changed

Documentation-review task. No application code, no backend project, no installs, no external calls. Plan v2 for task group 7B was approved. The review of IC-004, IC-013, IC-015 and IC-019 against the specs found 8 findings (below). Nothing in the specs was edited; the findings are proposals for the owning agents.

### Contract review findings

Ownership, consumers, source of truth and first-needed phase match BUILD_PLAN for all four contracts (all Phase 7 / task group 7B), except where noted.

F-1 (IC-004, MEDIUM). `AGENT-TASK-GRAPH.md` says IC-001..IC-004 are "frozen" at Gate 2/3 (Phase 4), but `INTEGRATION-CONTRACTS.md` lists IC-004 as first needed in Phase 7 and ADR-032/SECURITY §10 leave the sign-in method VBI until Phase 7. A contract cannot be frozen before its mechanism is chosen. Proposal: freeze IC-004 as "error shapes + header format" at Phase 4, finalize the method at Phase 7 (owner chief-architect, with backend).

F-2 (IC-004, LOW). Consumers list only mobile-android-engineer. security-privacy-engineer reviews every endpoint (agent rules) and qa-test-engineer writes the auth tests, but neither is a named consumer. The wire contract is also unspecified: Authorization header format, token refresh, 401 vs 403 vs 429 body shapes (no content), and behavior when signed out (FR-28.4). Proposal: add them to the IC-004 change notice.

F-3 (IC-013, MEDIUM). Source of truth is `DATA_MODEL.md` §4.20, which defines the stored entity (on-device) but not the transport. Gaps: who generates `executionId` (backend vs client); how it is returned (response envelope field); `visitId` is optional and would be a client-supplied identifier sent to the backend, which should be reviewed against PRIVACY §7 (minimum data) or dropped from the request and attached on-device; how `attempt` and `FALLBACK_USED` are reported when the fallback route served the request. Proposal: add an "envelope" subsection to IC-013, owner backend, acknowledged by data-engineer.

F-4 (IC-013, LOW). Producers of adapter calls are speech, ai-clinical and evidence engineers, but only data and mobile are listed as consumers. They must populate `job`, `jobVersion`, `model`. Add them as affected agents.

F-5 (IC-015, MEDIUM). Source of truth is `API_CATALOG.md` §29, which lists route names and values but no schema: no per-route enabled flag, order of primary/fallback, retry count, or timeout; and no way to express ADR-036 constraints "clinician-requested only" (TRIALS, CHEMICAL, PUBLIC_HEALTH) or "automatic returns information pages only" (CANCER_INFO). Also STT/LLM values are blank until OD-001/OD-002, so the schema must allow "unset = route disabled". Also `AGENT-OWNERSHIP` gives API_CATALOG to evidence-research-engineer with backend owning §27-§30, so schema changes need that co-ordination. Proposal: define the routing config schema in the IC-015 notice and reference it from §29.

F-6 (IC-019, HIGH). The enforcement point for `possibilitiesEnabled` is undefined. ADR-034 says with the flag OFF jobs 12-13 are "never called" and no ProviderExecution exists (CS-37), but no document says who decides. The pipeline orchestrator is on-device, so today the only gate is the app. A device-local flag can be altered, and ADR-025 treats R2 as a regulatory gate. Proposal: two-layer enforcement. (a) Authoritative flag in server config, returned via an authenticated `/config`; the app reads it and does not start the candidate stage when OFF. (b) Backend refuses job 12/13 requests when the server flag is OFF with a typed FEATURE_DISABLED error and no ProviderExecution. Needs an ADR-034 clarification (chief-architect), an AI.md job-name list the router can match (ai-clinical-engineer), and a CS-37 test at both layers (clinical-safety-engineer, qa).

F-7 (IC-019, MEDIUM). The contract mixes two different kinds of flag. `cloudProcessingEnabled` is a user choice stored locally in AppSettings (DATA_MODEL §4.24, FR-28.1). `possibilitiesEnabled` is not in AppSettings at all (§4.24 does not list it) and is a release/regulatory control. The "server flags + AppSettings" owner split is therefore unclear: whether `possibilitiesEnabled` is global, per environment or per user, and whether there is any user-visible toggle in release builds (it must not be). Proposal: split IC-019 into IC-019a (user setting, mobile owns) and IC-019b (server release flags, backend owns), or document the split inside IC-019. Consumers should also include clinical-safety-engineer and data-engineer.

F-8 (cross-cutting, MEDIUM). Rate-limit counters (plan step 5) are server-side state keyed by user id, which ADR-012 and ARCHITECTURE §3.5 do not allow for as written ("stateless"). Also, `/config` and `/health` are not named in ARCHITECTURE §3.5. Needs an ADR clarification and PRIVACY §7 / SECURITY §12 updates (see Plan, section C).

## Files Changed

docs/agent-handoffs/2026-10-08-stage-a-team2-backend.md (this file, created). No other files.

## Interfaces Changed

none — review only. Change notices proposed for IC-004, IC-013, IC-015 and IC-019 (see findings F-1 to F-7); none filed.

## Dependencies

Relied on: CLAUDE.md, BUILD_PLAN Phase 7 / 7B, ADR-012, 025, 026, 028, 032, 034, 036, ARCHITECTURE §3.5 and §11, SECURITY §10-§14, §17, PRIVACY §7, DATA_MODEL §4.20 and §4.24, INTEGRATION-CONTRACTS, API_CATALOG §27, §29, §30, AGENT-OWNERSHIP, AGENT-TASK-GRAPH. Depends on this: chief-architect triage of F-1, F-6, F-7, F-8; later implementation of 7B.

## Tests

none — documentation review task (0 tests)

## Evidence

- Grep and read of INTEGRATION-CONTRACTS §2 rows IC-004, IC-013, IC-015, IC-019 (first needed = Phase 7 for all four).
- BUILD_PLAN lines 272-275 (7B tasks 10-12).
- AGENT-TASK-GRAPH line 14 ("IC-001…IC-004 frozen" at Phase 4) vs INTEGRATION-CONTRACTS IC-004 "Phase 7" (F-1).
- DATA_MODEL §4.24 AppSettings lists cloudProcessingEnabled but not possibilitiesEnabled (F-7).
- DECISIONS ADR-034 decision 2 and CLINICAL-SAFETY CS-37 define the behavior but not the enforcement point (F-6).
- Lead's reply: plan v2 APPROVED.

## Known Limitations

Review is against the documents only; no code exists. Supabase details (Auth method, logging, rate-limit options) were not verified against supabase.com/docs in this task (no external calls allowed). Findings are not triaged or acknowledged by affected agents.

## Risks

- F-6: if enforcement stays app-only, an R2 function could be invoked against the backend in a release build.
- F-8: undocumented server-side counters would contradict the "stateless" claim in PRIVACY and the Data Safety form.

## Required Follow-up

- chief-architect: ADR for rate-limit counters (clarify ADR-012); ADR-034 clarification of enforcement point; decide IC-019 split; fix IC-004 freeze timing (F-1, F-6, F-7, F-8). Update PROJECT-STATUS.md (owned by chief-architect, AGENT-OWNERSHIP §2).
- security-privacy-engineer: PRIVACY §7 Supabase and Auth rows, SECURITY §10, §12, §17; Data Safety note.
- devops-android-release-engineer: DEPLOYMENT backend environments, secret store, function deploy, routing-config change procedure.
- backend (me): IC-004/013/015/019 change notices and routing schema once triaged; API_CATALOG §27 and §31 after docs verification.
- ai-clinical-engineer: job-name list for router matching of jobs 12-13.

## Receiving Agent

chief-architect — REVIEW REQUIRED: yes, by chief-architect (triage of F-1 to F-8). Copy to security-privacy-engineer for F-6 and F-8.

## Next Action

chief-architect triages findings F-1 to F-8; then backend files the IC change notices and starts task group 7B.

## Plan

Task: BUILD_PLAN Phase 7 task group 7B (backend foundation, ADR-026), tasks 10-12.

Version history
- v1 — REJECTED by team-lead. Reasons: (1) documentation updates incomplete (rate-limit counters need ADR, PRIVACY, SECURITY, DEPLOYMENT, IC change notices with owners); (2) handoff underspecified (path pattern, receivers, tags); (3) `/health` ambiguous.
- v2 — APPROVED by team-lead (with one ownership correction: PROJECT-STATUS.md is owned by chief-architect; backend reports completion in its handoff).

Approved plan v2 summary
1. Verify Supabase Edge Functions and Auth docs; record date and URL in API_CATALOG §31 and §27. Project creation and keys are project-owner actions; CI uses mocks, no fake keys.
2. Skeleton under `backend/`: `functions/_shared/` (auth, validate, ratelimit, routing, execution, errors, logger), `health`, `config`, `mock-provider`, routing config, `.env.example` with names only.
3. Auth (IC-004): `verify_jwt = true` plus claim checks; 401 generic body; no patient data on the account.
4. Validation framework: schema-first, size cap before parse, enums, UUIDs, strings, dates, numbers, unknown keys rejected; provider responses validated, unexpected shapes become PROVIDER_ERROR.
5. Rate limits and quotas per user and globally. Counter table `rate_counters(user_id, endpoint_class, window_start, count)`; no content, IP or email; rows deleted after the longest window plus 24 h; service role only; removed on account deletion.
6. Routing config (IC-015): server-side, per-route enabled flag, primary and fallback order, fallback only on failure, switchable without app release.
7. ProviderExecution (IC-013): technical fields of DATA_MODEL §4.20 only, returned to the device, never persisted server-side.
8. `/health` unauthenticated returning exactly `{status, version}`; `/config` authenticated (flags and routing); `/mock-provider` authenticated and disabled in production.
9. Feature flags (IC-019): `possibilitiesEnabled` default OFF; backend refuses job 12/13 when OFF with FEATURE_DISABLED and no ProviderExecution (CS-37, ADR-034).
10. Logging allow-list of technical fields; no body logging; no response cache (ADR-028).
11. Tests (mocks): 401; expired and tampered JWT; oversized, malformed, wrong-type; unknown keys; per-user and global rate limit; fallback only on failure; fake FDA/PubMed rejection; flag-OFF zero executions; log-capture no bodies; `/health` exactly two keys; secret-pattern scan.
12. Gates: security-privacy-engineer review of every endpoint; IC acknowledgements; handoffs; lint, type check and tests before commit.

Documentation updates (before step 5 implementation): DECISIONS ADR (chief-architect); PRIVACY §7 and Data Safety note, SECURITY §10, §12, §17 (security-privacy-engineer); DEPLOYMENT backend environments (devops); API_CATALOG §27, §31 (backend); IC-004/013/015/019 change notices with affected agents (backend); PROJECT-STATUS (chief-architect).

Implementation handoff (future task, not this one): `docs/agent-handoffs/<date>-backend-api-engineer-to-<receiver>-7b-foundation.md` for mobile-android-engineer (IC-004/IC-019 client side), security-privacy-engineer (REVIEW REQUIRED: yes — Security review: PASS) and qa-test-engineer; tags Tests-required: yes, Security-sensitive: yes. This run's task #5 carries Tests-required: no and uses the path of this file.

Lead's decision: APPROVED (v2).
