# ClinNote AI — Deployment Specification

No secrets are ever committed to Git. No accounts or credentials exist yet; the project owner creates them when the relevant phase begins.

---

## 1. Environments

| Environment | Purpose | App build | Backend | Data |
|---|---|---|---|---|
| Development | daily engineering | EAS `development` profile / dev client | dev backend project, dev secrets, mock-provider mode available | synthetic only |
| Preview | internal testing, QA | EAS `preview` profile (installable APK or internal AAB) | preview backend project | synthetic only |
| Production | Google Play release | EAS `production` profile (AAB) | production backend project | real clinical use only after Phase 25 go decision |

Production secrets are never available to development or preview.

## 2. GitHub Codespaces

- Primary development environment.
- Node.js LTS (exact version pinned in Phase 1 via `.nvmrc` or devcontainer).
- No GPU, CUDA, PyTorch, Python ML stack or model weights (ADR-003).
- Android emulators are generally unavailable in Codespaces; device testing uses EAS development builds on a physical device or a local emulator outside Codespaces.
- Codespaces secrets may hold development-only values when needed; never production values.

## 3. Expo

- React Native + Expo + TypeScript (ADR-011); SDK version chosen at Phase 2 from current Expo documentation.
- App configuration (`app.json`/`app.config.ts`) contains only public configuration.
- Permissions declared explicitly; only RECORD_AUDIO plus what Phase 7 ADR requires.
- Over-the-air updates (EAS Update): not used in V1 unless a Phase 23 ADR enables them; if enabled, updates must pass the same test gates as binary releases and cannot change native permissions.

## 4. EAS

- EAS Build profiles: `development`, `preview`, `production` in `eas.json`.
- EAS environment variables hold only public client configuration per environment.
- Requires an Expo account and EAS project created by the project owner.

## 5. Supabase (Backend)

- Supabase Edge Functions (ADR-012); separate Supabase projects per environment.
- Functions: speech token/proxy, LLM jobs, evidence/medication lookups.
- Secrets stored in the Supabase project secret store.
- Function logging configured to exclude request/response bodies.
- No database tables for clinical content. Any operational tables (e.g. rate-limit counters) hold no clinical content.
- Processing region chosen with OD-005 in mind.

## 6. Environment Variables and Secrets

See `API_CATALOG.md` §30 for the full list and which are secret.

- App: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SENTRY_DSN` (if OD-009 selects Sentry).
- Backend: all provider keys, `SUPABASE_SERVICE_ROLE_KEY`, NCBI configuration.
- CI: only what build/test steps need; tests use mocks so no provider keys are needed in CI.
- `.env.example` lists names only.

## 7. CI/CD (GitHub Actions)

On every pull request and push to `main`:

1. install with lockfile
2. format check
3. lint
4. TypeScript type check
5. unit and integration tests (mock providers)
6. clinical safety test suite
7. dependency audit
8. secret scanning
9. backend function type check and tests

On release tags: EAS build for the matching profile (triggered manually or by tag), artifact retention, release notes.

CD to Google Play is manual (upload or EAS Submit) after the checklist in `GOOGLE-PLAY.md` §16.

## 8. Android Builds, AAB and Signing

- Production artifact: Android App Bundle (AAB).
- Signing: EAS-managed credentials or owner-held upload keystore; never in Git. Google Play App Signing is expected — VERIFY current requirement.
- `versionCode` increments every upload; `versionName` follows semantic versioning.
- Target SDK set to the level Google Play currently requires (VERIFY at Phase 23).

## 9. Release Management

- Branches: feature branches → `main`; release tags `vX.Y.Z`.
- Each release has: changelog, test results, `BUILD_REPORT.md` update, Play track (internal → closed → production), staged rollout percentages for production.
- Backend deployments are versioned and deployed before app releases that depend on them; backend remains backward compatible with the previous app version.

## 10. Rollback

- **Backend:** redeploy the previous function version; provider routing and AI feature flags switched in server-side configuration without an app release.
- **Provider problems:** disable route; fall back to secondary provider or manual mode.
- **AI feature problems:** feature flag off → app shows manual workflows.
- **App:** Google Play does not allow downgrading installed apps. Options: halt staged rollout; ship a new build with a higher `versionCode` from the last known-good source.
- **Local data:** database migrations are forward-only and tested; a migration failure leaves the previous database intact and reports an error.

## 11. Monitoring

- Backend: request counts, error rates, latency per function and provider, rate-limit hits, provider spend — no content.
- Provider dashboards for usage and billing alerts.
- App: ProviderExecution outcomes visible locally for debugging; not uploaded.

## 12. Error Tracking

Crash reporting provider is OD-009. Requirements: scrubbing allow-list, no breadcrumbs with screen text, no request bodies, opt-out capability, disclosed in privacy policy and Data Safety.

## 13. Provider Fallback

Configured per route on the backend (`API_CATALOG.md` §29). Fallback providers must be verified and pass the AI evaluation set before being enabled.

## 14. Production Configuration Checklist

- separate production backend project and secrets
- production provider accounts with appropriate data terms
- rate limits and spend alerts configured
- logging excludes bodies (verified)
- crash scrubbing verified
- encryption at rest enabled (OD-003)
- authentication enforced (OD-004)
- cleartext traffic disabled
- feature flags default safe
- all OPEN DECISIONS resolved
- security, privacy and clinical-safety reviews complete (Phase 25)
