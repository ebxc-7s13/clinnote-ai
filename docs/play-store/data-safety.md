# ClinNote 1.2.0 — Play Console "App content" answers (draft)

Prepared 2026-10-09 from the built 1.2.0 app and its source, not from intentions. The project owner submits these forms and is responsible for their accuracy. This is not legal advice and does not claim compliance with any law.

## Facts about the 1.2.0 build (verified)

| Fact | Evidence |
|---|---|
| Permissions: INTERNET, RECORD_AUDIO, VIBRATE (+ internal DYNAMIC_RECEIVER_NOT_EXPORTED) | `aapt2 dump badging` on the 1.2.0 APK (BUILD_REPORT.md) |
| No ClinNote backend configured: no Supabase URL in the bundle → no Gemini cloud AI calls | no `mobile/.env`; Settings shows "Cloud AI backend not configured" |
| No account / sign-in | no auth code in `mobile/src` |
| No analytics, advertising or crash SDK | `package.json` dependencies; ADR-030 |
| Patient data stored on device, encrypted (AES-GCM, key in expo-secure-store / Android Keystore) | ADR-046; `storage.test.ts` |
| Speech: Android `SpeechRecognizer` via expo-speech-recognition; on-device when the device supports it, otherwise the device's speech service (normally Google) | `liveSpeech.ts` `requiresOnDeviceRecognition` |
| Evidence lookups send clinical terms only (medication/condition names) to NLM, openFDA, DailyMed, Europe PMC, ClinicalTrials.gov, PubChem over HTTPS | `providers/evidence`, safety tests |
| `allowBackup=false` | `app.json` |
| R2 "possibilities to review" cannot be enabled (production variant) | `container.ts` `R2_SELECTABLE` |

## Data safety form — recommended answers

- **Does your app collect or share any of the required user data types?** Yes (conservative; see note on speech).
- **Is all user data encrypted in transit?** Yes (HTTPS only; no cleartext endpoints).
- **Do you provide a way for users to request deletion?** Yes — in-app: delete visit, patient, or all local data (Settings). There is no server-side copy.

| Data type | Collected | Shared | Processed ephemerally | Required/optional | Purpose |
|---|---|---|---|---|---|
| Audio → Voice or sound recordings | Yes, if the device speech service is not on-device (VERIFY how Play treats system `SpeechRecognizer`) | No | Yes | Optional (recording is user-initiated; manual notes possible) | App functionality |
| Health and fitness → Health info | Yes — clinical terms sent to public reference APIs when the user opens evidence | Yes — to public reference sources (NLM, FDA, EBI) that are not ClinNote's service providers | Yes (ClinNote keeps no server copy) | Optional | App functionality |
| Personal info (name, DOB, patient reference) | **No** — stays on device, never transmitted | No | — | — | — |
| Location, contacts, photos, files, messages, app activity, device IDs, financial info | No | No | — | — | — |
| Crash logs / diagnostics | No (Play vitals are collected by Google, not by the app) | No | — | — | — |

Data stored only on the device and never sent off it is **not** "collected" in Play's definition.

## Health apps declaration

- Select the health features the app offers. Closest Play categories: **Healthcare services and management** (clinical documentation / records) and possibly **Clinical decision support** (evidence lookup for clinicians). The owner chooses; R2 possibilities are disabled in this build.
- **Medical device:** ClinNote does not claim to be a regulated medical device and has none of FDA/CDSCO/CE clearance. Whether it *is* one in a target market is the open ADR-025 regulatory assessment (OD-011). **This is a release blocker for production**, not for internal testing.
- In-app reminder to consult a healthcare professional and "not a medical device" statement: About screen (added in 1.2.0). Same text in the store description.

## Other App content forms

| Form | Recommended answer |
|---|---|
| Privacy policy | URL of the published `privacy-policy.md` (OWNER) |
| Ads | No ads |
| App access | All functionality available without login; reviewers can use the synthetic demo patient (Home → "Create synthetic demo patient") |
| Content rating (IARC) | Reference/utility app; no violence, sexual content, gambling, user-to-user communication or location sharing |
| Target audience | 18 and over (healthcare professionals); not designed for children |
| News app | No |
| Government app | No |
| Financial features | None |
| Data safety | as above |
| Health apps | as above |
| Foreground service / background microphone | Not used: recording runs only with the app in the foreground, no FOREGROUND_SERVICE permission in the manifest |
| Account deletion | Not applicable (no accounts) |
| Photo and video permissions | Not requested (blocked in `app.json`) |
