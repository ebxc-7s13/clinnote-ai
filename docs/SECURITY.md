# ClinNote AI — Security Requirements

Security requirements and acceptance criteria for ClinNote.

## 1. Objective

Protect patient information, clinician information, transcripts, notes, temporary audio, the local database, exported files, API credentials and the backend from disclosure, tampering and abuse.

## 2. Threat Model Summary

| Threat | Primary controls |
|---|---|
| Lost or stolen device | Device lock, app lock, SQLCipher-encrypted local database (ADR-031) |
| Reverse-engineered APK | No private secrets in the app |
| Backend abused as a free AI proxy | Clinician authentication (ADR-032), per-user rate limits, quotas |
| Prompt injection via transcript or evidence | Data/instruction separation, schema output, validators (`AI.md` §10) |
| Clinical data leaking via logs, analytics, crash reports | Logging rules; no analytics and no crash SDK in V1 (ADR-030) |
| Secrets committed to Git | `.gitignore`, CI secret scanning, push protection |
| Compromised dependency | Audits, lockfile, provenance checks |
| Malicious or malformed provider responses | Response schema validation |
| Interception in transit | HTTPS/TLS only |

## 3. Secrets

Private secrets (backend only):

`GEMINI_API_KEY`, `ASSEMBLYAI_API_KEY`, `DEEPGRAM_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `NCBI_API_KEY`, `OPENFDA_API_KEY`, `NCI_API_KEY` (if required), `SUPABASE_SERVICE_ROLE_KEY`.

No secrets exist yet. They are created by the project owner when needed.

## 4. API Keys

Private keys must never be placed in:

- the APK/AAB
- JavaScript/TypeScript source
- Expo public environment variables (`EXPO_PUBLIC_*`) or app config
- Git (including history)
- screenshots, documentation, issues, logs

## 5. Environment Variables

- `.env*` files are gitignored; `.env.example` contains names only.
- App-side variables are limited to public configuration (`SUPABASE_URL`, `SUPABASE_ANON_KEY`); no crash SDK DSN in V1 (ADR-030).
- Separate values per environment (development, preview, production); production secrets are never available to development.

## 6. Server-Side Credentials

- Stored in the backend platform's secret store.
- Accessible only to the functions that need them.
- Rotated on suspected exposure and at least before production launch.
- Streaming speech uses short-lived, scoped tokens minted by the backend, or a backend proxy.

## 7. Local Storage

- Clinical data only in the app-private SQLite database and app-private files.
- Temporary audio in app-private storage; deleted per ADR-014.
- No clinical data in shared/external storage except explicit exports.
- The database encryption key is a random 256-bit value stored in Android Keystore-backed secure storage (ADR-031).

## 8. Encryption Decision

- In transit: TLS for all network traffic; cleartext traffic disabled.
- At rest: Android provides file-based encryption on supported devices. In addition, ClinNote encrypts its database with **SQLCipher via expo-sqlite (`useSQLCipher`)**. This was verified in the official Expo SDK 57 docs on 2026-10-08 and is re-verified at Phase 4 (ADR-031, OD-003 resolved for planning).
- The key is set with `PRAGMA key` from Keystore-backed secure storage. SQLCipher is unavailable in Expo Go, so development uses EAS development builds.
- Encryption is enabled from BUILD_PLAN Phase 4 onward. No unencrypted database build is distributed.
- If the key is lost (app data cleared), the data is unrecoverable, consistent with ADR-017. The clinician is told this.

## 9. Network Security

- HTTPS only; certificate validation never disabled.
- App talks only to the ClinNote backend and, for streaming speech, to the provider endpoint authorized by a short-lived token.
- Request timeouts and size limits on all calls.

## 10. Authentication

The app must authenticate to the backend so that paid provider calls cannot be made anonymously.

**Decision (ADR-032, OD-004 resolved for planning):** clinician accounts via Supabase Auth. Edge Functions verify the JWT (default `verify_jwt = true`, per the Supabase docs read on 2026-10-08) and apply per-user rate limits. The exact sign-in method is verified at Phase 7. Platform app-integrity attestation is evaluated as extra hardening in Phase 19. Required properties:

- no shared static secret embedded in the app as the sole control
- tokens short-lived and revocable
- per-client identification for rate limiting

## 11. Authorization

- Each backend function checks the caller is authenticated and authorized for that function.
- No backend function returns data belonging to another user (V1 backend stores no user clinical data).
- Service-role credentials are never used on behalf of client input without validation.

## 12. Rate Limiting and Abuse Prevention

- Per-client and global limits on speech minutes, LLM calls and evidence calls.
- Counter storage (ADR-042): non-clinical rows `(opaque user id, endpoint class, window start, count)` only, with no content, IP or email. Rows are deleted after the longest window plus 24 h and on account deletion. Access is through the service role inside functions only.
- Backend R2 enforcement: jobs 12, 13 and 16 are refused with `FEATURE_DISABLED` when their flags are OFF (ADR-042).
- `/health` is unauthenticated and returns only `{status, version}`. Flags and routing are served only by the authenticated `/config` endpoint.
- Request-size caps (e.g. transcript length, audio chunk size).
- Daily spend alerts on provider accounts.
- Ability to disable a client or a provider route without an app release.

## 13. Prompt Injection

Transcript and external content never override system instructions (`AI.md` §10). Outputs are schema-validated and grounded.

## 14. Malicious Input and API Validation

Treat as untrusted: transcript, clinician text, patient-reported content, external API responses.

Backend validates request size, data types, IDs, enums, strings (length, encoding), dates and numbers. Provider responses are validated against schemas before use; unexpected shapes are rejected and reported as provider errors.

## 15. Dependency Vulnerabilities

- Lockfile committed.
- Dependency audit in CI; high/critical advisories block release.
- Remove abandoned dependencies; check package provenance and maintainers for new dependencies.

## 16. Repository Security, Secret Scanning and Git History

- Never commit `.env`, keys, keystores, certificates, recordings, real patient data.
- CI secret scanning on every push/PR; enable GitHub secret scanning and push protection where available.
- If a secret is ever committed: revoke and rotate first, then purge from history (e.g. history rewrite tool), force-push only with owner approval, and record the incident. Treat the secret as compromised even after purge.

## 17. Logging and Crash Reports

Never log: transcripts, patient names or references, medication lists, diagnoses, notes, audio, evidence query text, request/response bodies of AI/speech/evidence endpoints.

Allowed: event name, stage, provider ID, duration, status code, error class, random request ID.

V1 includes **no crash-reporting or analytics SDK** (ADR-030). Stability uses Google Play Console Android vitals. Any future crash SDK requires an ADR and a scrubbing allow-list that removes breadcrumbs, screen text and request bodies.

## 18. Export Security and Secure Deletion

- Exports only on explicit clinician action, with a warning that the file leaves protected storage; each export audited.
- Deleting a patient/visit removes database rows and related files (temporary audio, cached exports in app storage). Database vacuum after bulk deletion.
- ClinNote cannot delete files already exported to other apps; the warning says so.

## 19. Incident Response

| Incident | Steps |
|---|---|
| Leaked API credential | Revoke/rotate at provider → update backend secret → review provider usage → purge from Git if committed → record |
| Compromised account (developer, provider, backend) | Revoke sessions → rotate credentials → enable/verify MFA → review access logs |
| Patient-data exposure | Contain → assess scope → follow notification obligations of the applicable jurisdiction (OD-005) with legal advice → record → fix root cause |
| Malicious requests | Block client → tighten limits → review validation |
| Provider compromise | Disable route → switch to fallback → assess exposure → notify as required |

## 20. Security Acceptance Criteria

Release (Phase 25) requires all of the following, each with test or review evidence:

1. A scan of the built AAB/JS bundle finds no private key patterns.
2. CI secret scanning passes on the full Git history.
3. Every backend endpoint rejects unauthenticated requests (test).
4. Every backend endpoint rejects oversized, malformed and wrong-type requests (tests).
5. Rate limits trigger at configured thresholds (test).
6. Provider responses with unexpected schema are rejected (test with fake FDA/PubMed responses).
7. Prompt-injection test transcript produces no diagnosis or instruction-following behavior (test).
8. Local database is encrypted at rest with SQLCipher (ADR-031), verified on device: the database file is unreadable without the key.
9. No clinical content appears in backend logs during the full synthetic E2E suite (log inspection). The built app contains no crash or analytics SDK (dependency inspection).
10. Dependency audit has no unresolved high/critical advisories.
11. Cleartext network traffic is disabled (config review).
12. Exports show the warning and write an AuditEvent (test).
13. Patient deletion removes all related records and files (test).
14. Incident response contacts and steps are documented and current.
