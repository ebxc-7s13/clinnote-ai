# ClinNote AI — Security Requirements

## Security Objective

Protect:

- patient information
- clinician information
- transcripts
- medical notes
- API credentials
- evidence requests
- local database
- exported files
- temporary audio

## Threat Model Summary

| Threat | Primary control |
|---|---|
| Lost / stolen device | Device lock + app-level lock + encrypted local storage (OD-003) |
| Extracted APK | No private secrets in the app |
| Abuse of backend as free AI proxy | Backend authentication (OD-004) + rate limiting |
| Prompt injection via transcript or evidence | Data/instruction separation, schema-constrained output (`AI.md`) |
| Clinical data leaking via logs/analytics/crashes | Scrubbing rules below, privacy tests |
| Secrets committed to Git | `.gitignore`, CI secret scanning |
| Compromised dependency | Dependency audits, provenance checks |
| Malicious / malformed provider response | Response validation |

## API Keys

Private keys must remain server-side.

Never put private keys inside:

- APK / AAB
- JavaScript
- TypeScript
- Expo public environment variables (`EXPO_PUBLIC_*`)
- Git
- screenshots
- documentation

No API keys exist for this project yet. They are created by the project owner when the relevant phase begins.

## Secrets

Potential secrets:

GEMINI_API_KEY

ASSEMBLYAI_API_KEY

DEEPGRAM_API_KEY

OPENAI_API_KEY

ANTHROPIC_API_KEY

NCBI_API_KEY

SUPABASE_SERVICE_ROLE_KEY

These must be stored securely in the backend's secret store (e.g. Supabase project secrets) and in GitHub Actions secrets only where CI needs them. See `API_CATALOG.md` Section 17 for which variables are public configuration.

Streaming speech from the device uses short-lived, scoped tokens issued by the backend, or a backend proxy (`ARCHITECTURE.md` Section 4). Long-lived provider keys never reach the device.

## Client Security

Use minimum permissions.

Do not request:

- location
- contacts
- SMS
- phone

unless explicitly required by a future feature.

Local app lock: the app supports an app-level lock using device authentication (biometric or device credential). Mechanism to be verified with the chosen Expo libraries in Phase 12.

## Input Security

Treat:

- transcript
- patient-entered information
- clinician-entered text
- external API responses

as untrusted input.

## Prompt Injection

Medical transcript content must never override AI system instructions.

See `AI.md`, Prompt Injection, for mitigations.

## API Validation

Validate:

- request size
- data types
- IDs
- enums
- strings
- dates
- numbers

Validate on the backend for every request, and validate provider responses against expected schemas before returning them to the app.

## Rate Limiting

Rate limit:

- speech requests
- LLM requests
- evidence requests

Limits are per authenticated client (OD-004) and global, configured server-side.

## Logging

Do not log:

- transcripts
- patient names
- patient references
- medication lists
- diagnosis
- clinical notes
- audio
- evidence query text
- request or response bodies from AI/speech/evidence endpoints

Use safe structured technical logging (event name, stage, provider, duration, status code, error class, random request ID).

## Crash Reporting

Never send clinical text to crash reports.

Crash reporting (provider: OD-009) must be configured with a scrubbing hook that removes breadcrumbs, request bodies, screen text and any field not on an allow-list.

## Storage

Protect local clinical records.

The exact encryption mechanism must be selected based on the final React Native/Expo architecture and documented before production release (OPEN DECISION OD-003). Until resolved, only synthetic data is stored, which is already required for development.

Temporary audio is stored only in app-private storage and deleted per `SPEECH.md`.

## Export Security

Warn users that exported files may leave the secure application environment.

Exports are generated on explicit clinician action only, and each export is recorded as an AuditEvent.

## Repository Security

Never commit:

- .env
- API keys
- certificates
- signing keys
- keystores
- real patient data
- recordings

## Dependency Security

Before release:

- run dependency audits
- remove abandoned dependencies
- verify package provenance
- check security advisories

## Secret Scanning

CI must scan commits for secrets.

GitHub secret scanning / push protection should be enabled on the repository where available, plus a CI scanner step (configured in Phase 1).

## Incident Handling

Document a response process for:

- leaked API credentials
- compromised accounts
- patient-data exposure
- malicious requests
- provider compromise

Minimum process (to be expanded before production):

1. **Leaked credential:** revoke and rotate the key at the provider immediately, redeploy backend secrets, review provider usage logs, purge from Git history if committed.
2. **Compromised account:** revoke sessions, rotate credentials, review access logs.
3. **Patient-data exposure:** contain, assess scope, follow the notification obligations of the applicable jurisdiction (depends on OD-005), record the incident.
4. **Malicious requests:** tighten rate limits, block the offending client, review validation rules.
5. **Provider compromise:** disable the provider via server-side routing (`API_CATALOG.md` Section 16), switch to fallback, assess data exposure.
