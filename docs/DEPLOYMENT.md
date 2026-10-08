# ClinNote AI — Deployment

## Development

Development occurs in:

GitHub Codespaces

Use synthetic data.

No GPU, CUDA, PyTorch or model weights are required (ADR-002).

## Application

Target:

Android

Framework:

React Native + Expo (TypeScript) — ADR-009

Use the current compatible versions at implementation time.

iOS is not a V1 target, but the stack does not preclude it.

## Build

Use:

EAS Build

Build profiles:

development

preview

production

Production builds produce an Android App Bundle (AAB) for Google Play. Signing credentials are managed by EAS or the project owner and never committed to Git.

An Expo account and EAS project are required; they are created by the project owner when Phase 14 begins.

## Backend

Use a serverless backend.

Preferred architecture:

Supabase Edge Functions (ADR-010). An equivalent serverless platform may replace it via a new ADR; the provider-abstraction design keeps the app independent of the hosting choice.

The backend is stateless with respect to clinical content (`ARCHITECTURE.md` Section 4).

## API Secrets

Store secrets server-side.

Never embed private API keys in the Android application.

No secrets exist yet. Each is created by the project owner when the phase needing it begins and stored in the backend secret store.

## CI/CD

GitHub Actions should eventually run:

- formatting
- linting
- TypeScript checking
- tests
- dependency/security checks
- secret scanning
- build validation

From Phase 1, CI runs formatting, linting, type checking, tests and secret scanning on every pull request. CI uses mock providers and needs no provider secrets.

## Environments

Development

Preview

Production

Do not share production secrets with development.

Each environment has its own backend project/secrets and its own EAS build profile.

## Production

Before production:

- security review
- privacy review
- clinical-safety review
- API review
- Android review
- Google Play policy review
- synthetic end-to-end testing
- all blocking OPEN DECISIONS resolved (`DECISIONS.md`)

## Rollback

A release strategy must support:

- identifying the previous release
- disabling problematic provider integrations
- disabling problematic AI features
- emergency app rollback where supported
- provider fallback

Provider routing and AI feature flags are controlled server-side so they can be changed without an app release. Google Play does not support downgrading installed apps; an app-side rollback means shipping a new release with a higher version code built from the previous known-good source, or halting a staged rollout.
