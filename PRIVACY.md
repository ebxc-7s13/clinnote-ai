# ClinNote AI — Privacy Policy

Applies to: the ClinNote Android app (`ai.clinnote.app`) version 1.2.0, as distributed on the project's [GitHub Releases](https://github.com/ebxc-7s13/clinnote-ai/releases) page.
Last updated: 2026-10-09.

This document describes what the app actually does, based on its source code in this repository. It is a description of the software, **not a statement of legal compliance** with HIPAA, GDPR, India's DPDP Act or any other law. Whoever uses ClinNote with patients is responsible for their own legal basis, consent and record-keeping obligations.

The ClinNote project runs **no server and receives no data from the app.** There is no account, no sign-in, no analytics, no advertising and no crash-reporting service.

> **Synthetic data restriction.** ClinNote is a development-stage project. It is not clinically validated and has no regulatory approval. Use it with synthetic (made-up) patients. If you choose to use it with real patients, you do so at your own responsibility, and the optional cloud AI described in §7 is never used for them.

---

## 1. Summary

| Information | Where it is processed | Sent off the device? | Retained | How to delete |
|---|---|---|---|---|
| Patient records, visits, transcripts, facts, notes, reports | On the device | No | Until you delete it | Delete visit / Delete patient / Settings → Delete all local data; or uninstall |
| Microphone audio (live transcription) | The Android speech-recognition service on the device | Depends on the device's speech service (see §4) | Not stored by ClinNote | — |
| Temporary audio files | App cache on the device | Only with an optional, self-configured backend, for demo patients (§7) | Until the final transcript is made; never more than 24 hours | Automatic; Settings → Delete temporary audio now |
| Clinical search terms (e.g. a medication or symptom name) | Public U.S./EU biomedical services (§6) | Yes, when Cloud processing is on | Evidence cache on the device, until deleted | Settings → Delete all local data |
| Settings (language, theme, note type) | On the device | No | Until deleted | Settings → Delete all local data |
| Exported PDF / JSON / text files | Wherever you send them | Only where you share them | Outside ClinNote's control | In the app you shared to |

## 2. Local patient storage

- **What is processed:** patient reference (assigned automatically, e.g. `P-000001`), optional name, age, sex, occupation and preferred language, visits with timestamps, consent records, transcripts, clinical facts, notes, report versions and an audit trail.
- **Where:** in ClinNote's private app storage on the device (`clinnote/data/…` in the app's document directory). There is no cloud database.
- **Why:** to keep a longitudinal record that the clinician reviews.
- **Encryption:** every stored document is encrypted with **AES-256-GCM** (random 96-bit nonce per write) using a 256-bit key kept in Android secure storage (Keystore-backed `expo-secure-store`, *when-unlocked, this device only*). Other apps cannot read it. Encryption at rest does not protect data from someone who can unlock and use the phone.
- **Backup:** Android cloud backup is **disabled** (`allowBackup=false`), so records are not copied to Google Drive. This also means records do not move to a new phone automatically — export them.
- **Retained:** until you delete them.
- **Deletion:** *Delete visit* on a visit, *Delete patient* on a patient, or *Settings → Delete all local data* (also destroys the encryption key). Uninstalling the app deletes all app data.

## 3. Microphone permission and recording consent

- ClinNote requests one runtime permission: **RECORD_AUDIO** (microphone). It is requested only when you start recording. Camera, location, contacts, storage, phone and SMS permissions are explicitly blocked in the app manifest.
- Before any recording, the app requires the clinician to attest that the patient consented (verbal or written). Without consent you can continue with manual documentation. Consent can be withdrawn during recording.
- The other Android permissions present in the APK are INTERNET (evidence look-ups), VIBRATE (haptics) and an app-internal broadcast permission added by the Android build tools.

## 4. Speech recognition

- **What:** microphone audio during a recording segment.
- **Where:** the speech-recognition service installed on the phone (on most phones, Google's speech service). ClinNote asks for **on-device recognition** when the device reports it is available; otherwise the device's service decides how recognition is done, which **may involve sending audio to that service's provider** under that provider's own terms. ClinNote cannot control or inspect this.
- **Retained:** ClinNote stores the resulting text (transcript) locally and encrypted. It does not store the live audio.
- **Voice:** ClinNote does not identify people by voice and creates no voiceprints. Speaker roles (Doctor/Patient/Other) are set by the clinician.

## 5. Temporary audio

In the public APK, **no audio file is written** unless an optional AI backend has been configured at build time (§7) and the patient is a synthetic demo patient. When that happens, audio is kept in the app cache only until the final transcript is made, is deleted afterwards, and is never kept longer than 24 hours. *Settings → Delete temporary audio now* removes any remaining file. Replay of audio is not available.

## 6. External evidence providers

- **What is sent:** only clinical concepts — for example a medication name or a condition term. **Never** a patient name, date of birth, patient reference, visit code or transcript sentence. This is enforced in code and covered by automated tests.
- **When:** only while *Cloud processing* is turned on (chosen at first launch; changeable in Settings). With it off, nothing leaves the device.
- **To whom (HTTPS only):** U.S. National Library of Medicine (RxNorm/RxNav, DailyMed, PubMed/NCBI E-utilities, PubChem, MedlinePlus, Clinical Tables, ClinicalTrials.gov), U.S. FDA (openFDA, Drugs@FDA) and Europe PMC (EMBL-EBI). These are free public services; no account or key is used. Each service has its own terms and may log requests (including your IP address).
- **Retained:** results are cached, encrypted, on the device.

## 7. Cloud AI (optional, not active in the public APK)

- The public APK contains **no API key and no AI backend address**, so cloud AI is **not configured** in it. The app shows "Cloud AI backend not configured" in Settings and uses rule-based extraction and manual entry instead.
- Developers can build their own APK pointing at their own backend (Supabase Edge Functions calling the Google Gemini API free tier; see the README). In such a build:
  - only **synthetic demo patients** are ever sent to the AI service, because free-tier terms allow submitted content to be used to improve the provider's products. Visits of non-demo patients stay on the device;
  - what is sent is the transcript text (and, for the final transcript, temporary audio) of that demo visit, without name or patient reference;
  - the private Gemini key stays in the backend's secret store, never in the app.

## 8. Provider credentials

The app does not hold or ask for private API keys. The only build-time values the app can carry are a Supabase project URL and its *anon* key, which are public by design; the public APK carries neither.

## 9. Analytics, crash logs and logging

None. ClinNote includes no analytics, advertising, tracking or crash-reporting SDK and does not write clinical content to the system log. Android itself may keep generic crash information according to your device settings.

## 10. Export and sharing

You can export a report as PDF, JSON or text and a patient summary through the Android share sheet. Exported files leave ClinNote's encrypted storage; their protection then depends on where you send them. ClinNote cannot delete copies you have shared.

## 11. Redaction is not anonymization

Removing names or references from a text does not make it anonymous: clinical details can still identify a person. ClinNote never describes its data minimization as anonymization.

## 12. Children

ClinNote is intended for healthcare professionals, not for patients or children.

## 13. Changes and contact

Changes to this policy are recorded in the repository history and in [CHANGELOG.md](CHANGELOG.md). Questions: open a [GitHub issue](https://github.com/ebxc-7s13/clinnote-ai/issues) (never include patient information), or report security problems privately as described in [SECURITY.md](SECURITY.md).
