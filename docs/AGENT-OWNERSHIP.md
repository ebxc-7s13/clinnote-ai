# ClinNote AI — Agent Ownership

Every area, document and (future) code path has exactly one primary owner. Agents do not modify another agent's owned subsystem without coordination (direct message + Integration Contract where an interface is affected). Security-only fixes by security-privacy-engineer are allowed with immediate notice to the owner.

---

## 1. Area Ownership

| Area | Primary owner | Reviewers |
|---|---|---|
| Orchestration, planning, status, build report | chief-architect | integration-reviewer |
| Product requirements | product-clinical-architect | chief-architect, clinical-safety-engineer |
| Clinical workflow and terminology | product-clinical-architect | clinical-safety-engineer, ux-accessibility-engineer |
| UI specification and accessibility | ux-accessibility-engineer | product-clinical-architect, qa-test-engineer |
| UI implementation | mobile-android-engineer | ux-accessibility-engineer, qa-test-engineer |
| Android app (Expo/React Native) | mobile-android-engineer | devops-android-release-engineer, qa-test-engineer |
| Recording, speech, diarization | speech-diarization-engineer | qa-test-engineer, clinical-safety-engineer, security-privacy-engineer |
| Clinical AI jobs, prompts, schemas, validators | ai-clinical-engineer | clinical-safety-engineer, evidence-research-engineer |
| Evidence retrieval, citations, API verification | evidence-research-engineer | ai-clinical-engineer, clinical-safety-engineer |
| Domain model, local database | data-engineer | security-privacy-engineer, ai-clinical-engineer |
| Backend (serverless), routing, validation | backend-api-engineer | security-privacy-engineer, integration-reviewer |
| Security | security-privacy-engineer | integration-reviewer |
| Privacy | security-privacy-engineer | clinical-safety-engineer |
| Clinical safety rules and safety tests | clinical-safety-engineer | product-clinical-architect, qa-test-engineer |
| Test infrastructure and general tests | qa-test-engineer | all responsible agents |
| CI/CD, builds, signing, environments | devops-android-release-engineer | security-privacy-engineer, qa-test-engineer |
| Play Store preparation | devops-android-release-engineer | security-privacy-engineer, qa-test-engineer, clinical-safety-engineer |
| Cross-layer integration and release review | integration-reviewer | chief-architect |
| Release acceptance | chief-architect (project owner gives final go) | integration-reviewer |

## 2. Document Ownership

| Document | Owner | Contributors (edit with notice) |
|---|---|---|
| `CLAUDE.md`, `README.md` | chief-architect | — |
| `docs/PRODUCT_SPEC.md` | product-clinical-architect | — |
| `docs/BUILD_PLAN.md` | chief-architect | all (propose via message) |
| `docs/ARCHITECTURE.md` | chief-architect | backend, data, mobile (propose via Integration Contract) |
| `docs/API_CATALOG.md` | evidence-research-engineer | speech-diarization-engineer (§4–§7, §31 rows), ai-clinical-engineer (§8–§11), backend-api-engineer (§27–§30) |
| `docs/DATA_MODEL.md` | data-engineer | — |
| `docs/SPEECH.md` | speech-diarization-engineer | — |
| `docs/AI.md` | ai-clinical-engineer | — |
| `docs/EVIDENCE-SOURCES.md` | evidence-research-engineer | — |
| `docs/SECURITY.md` | security-privacy-engineer | — |
| `docs/PRIVACY.md` | security-privacy-engineer | — |
| `docs/CLINICAL-SAFETY.md` | clinical-safety-engineer | — |
| `docs/UI-UX.md` | ux-accessibility-engineer | — |
| `docs/TESTING.md` | qa-test-engineer | clinical-safety-engineer (§6–§7, §13) |
| `docs/DEPLOYMENT.md`, `docs/GOOGLE-PLAY.md` | devops-android-release-engineer | — |
| `docs/PROJECT-STATUS.md`, `docs/BUILD_REPORT.md`, `docs/DECISIONS.md` | chief-architect | — |
| `docs/AGENT-*.md`, `docs/QUALITY-GATES.md`, `docs/INTEGRATION-CONTRACTS.md` | chief-architect | integration-reviewer (contracts) |
| `docs/agent-handoffs/*` | author of each file | — |
| `.claude/agents/*`, `.claude/rules/*`, `.claude/orchestration/*`, `.claude/settings.json` | chief-architect | security-privacy-engineer (settings, hooks) |
| `terminal_report.txt` | chief-architect (append-only by the session that reports) | — |

## 3. Code Ownership (planned paths, created from BUILD_PLAN Phase 1 onward)

| Path | Owner |
|---|---|
| `src/presentation/**` | mobile-android-engineer |
| `src/application/**` | mobile-android-engineer (use cases), data-engineer (repository use) |
| `src/domain/**` | data-engineer |
| `src/infrastructure/sqlite/**` | data-engineer |
| `src/infrastructure/audio/**` | speech-diarization-engineer |
| `src/providers/**` (client interfaces, mocks) | owner of each provider family (speech / ai / evidence) |
| `backend/functions/**`, `backend/schemas/**` | backend-api-engineer |
| `backend/adapters/speech/**` | speech-diarization-engineer (behavior) + backend-api-engineer (transport) |
| `backend/adapters/llm/**`, `prompts/**`, `ai/validators/**` | ai-clinical-engineer |
| `backend/adapters/evidence/**` | evidence-research-engineer |
| `tests/clinical-safety/**` | clinical-safety-engineer |
| `tests/**` (other), test config | qa-test-engineer |
| `.github/workflows/**`, `eas.json`, `.gitignore`, `.env.example` | devops-android-release-engineer |
| `.claude/hooks/**` | security-privacy-engineer (author), chief-architect (approval) |

## 4. Core Files (single-writer at any time)

`docs/DATA_MODEL.md`, `docs/ARCHITECTURE.md`, `docs/INTEGRATION-CONTRACTS.md`, `src/domain/**`, `backend/schemas/**`, provider interface files, database migrations, `package.json`/lockfile, `.claude/settings.json`. chief-architect serializes edits to these.

## 4a. How Simultaneous Edits Are Prevented

Claude Code has no file locking between agents, so the protection is procedural, plus a review backstop:

1. **One writer per core file** (§4). chief-architect assigns a core file to one task at a time and never runs two tasks that touch the same core file in parallel (`AGENT-TASK-GRAPH.md` §4, "Never parallel").
2. **Owned paths only.** Every spawn prompt names the files the agent may edit. Review teammates edit only their own handoff file (Stage A runs 1 and 2).
3. **Separate worktrees for parallel implementation.** Implementation tasks that run at the same time use separate git worktrees or branches (`isolation: "worktree"` on the Agent call, or `claude --worktree`) and merge one at a time (`AGENT-RUNBOOK.md` §1, MERGE).
4. **One orchestrating session per working tree** (`AGENT-RUNBOOK.md` §7).
5. **Interface changes go through an Integration Contract** (`INTEGRATION-CONTRACTS.md`), and affected agents acknowledge them before merge.
6. **Backstop:** chief-architect reviews `git status` and the diff before every commit and rejects edits outside the task's owned paths.

**Stage A exception (ADR-033):** chief-architect applied all cross-document Stage A edits as the single writer; owners reviewed them as a team.

## 5. Ownership Disputes

Resolved by chief-architect per `AGENT-RUNBOOK.md` §5 and recorded in `DECISIONS.md` if the change is architectural.
