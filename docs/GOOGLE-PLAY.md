# ClinNote AI — Google Play Preparation

**Current Google Play policies, forms and requirements must be checked immediately before submission.** Policies change frequently; nothing in this document replaces the current Google Play Developer Policy Center and Play Console Help.

ClinNote holds no regulatory approval, certification or clinical validation, and no Play material may suggest otherwise.

---

## 1. Account Requirements

- A Google Play developer account owned by the project owner (personal or organization). Organization accounts may be required or preferable for health apps — VERIFY.
- Identity verification and contact details completed.
- New personal accounts may need to complete closed testing with a minimum number of testers for a minimum period before production access — VERIFY current numbers.

## 2. Health-App Declaration

ClinNote processes health information and provides AI-assisted clinical documentation and evidence review for healthcare professionals. Complete the Health apps declaration in Play Console describing:

- intended users: healthcare professionals
- functionality: documentation, transcription, evidence lookup
- not intended to diagnose, treat or prescribe
- regulatory status: none; if OD-005 concludes the app is a regulated medical device in a market, provide the required clearance documentation or do not release there

## 3. Sensitive Health Information

- Health data stays on the device; processing by cloud providers is disclosed.
- No health data used for advertising; no advertising SDKs.
- No data sale.

## 4. Microphone Permission

- `RECORD_AUDIO` — core feature; requested at first recording with rationale.
- If the Phase 7 ADR chooses background recording: foreground service (microphone type) permissions, notification permission, and any Play foreground-service declaration with a demonstration video — VERIFY.
- No location, contacts, phone, SMS, or other unrelated permissions.

## 5. Privacy Policy

A public privacy policy URL is required before production. It must accurately describe: audio handling and temporary retention, transcription, AI processing and providers, local storage, absence of cloud backup, third-party services, deletion, security, user controls, contact. Derived from `PRIVACY.md` §7 and reviewed by a qualified person.

## 6. Data Safety

Expected answers (confirm against the built app):

| Topic | Expected |
|---|---|
| Audio collected | Yes — voice/sound recordings, transmitted to service providers for transcription; not stored by ClinNote servers |
| Health info | Yes — processed by AI service providers for app functionality |
| Personal identifiers | Optional name/DOB stored on device only; not transmitted |
| Encrypted in transit | Yes |
| Deletion | Users can delete data in-app |
| Shared for advertising | No |
| Location / contacts / device IDs | Not collected |
| Crash data | Depends on OD-009; scrubbed diagnostics only |

## 7. App Description

States clearly: for healthcare professionals; documentation and evidence-review assistant; AI output requires clinician review; does not diagnose, prescribe or replace clinical judgment.

## 8. Medical Claims

Never claim: FDA approval, CDSCO approval, CE certification, clinical validation, medical-device certification, accuracy guarantees, "replaces doctors", "diagnoses", "definitive medical advice".

## 9. AI-Generated Content

Review current Play policy on AI-generated content; provide in-app reporting/feedback mechanism if required — VERIFY.

## 10. Target SDK

Set target API level to the currently required level for new apps and updates — VERIFY at Phase 23.

## 11. Release Build

Signed AAB from EAS `production` profile; Play App Signing; `versionCode` increment; release notes.

## 12. Store Listing

App name, short description, full description (§7), category (Medical or Productivity — decide at submission), contact email, privacy policy URL, content rating questionnaire.

## 13. Screenshots

Synthetic patients only (`P-9xxxxx`, fictional names); no real clinical data; show provisional labels honestly; no claims in captions that violate §8.

## 14. Support

Support email and web page; response process for data deletion questions and incident reports.

## 15. Testing

Internal testing → closed testing (meeting current account requirements) → production with staged rollout. Testers use synthetic patients and are instructed not to enter real patient information.

## 16. Production Readiness Checklist

- [ ] Current Play policies re-checked on submission date
- [ ] OD-005 regulatory classification resolved for each release country
- [ ] OD-006 retention resolved; OD-010 license resolved
- [ ] Target SDK meets current requirement
- [ ] Signed AAB built and device-tested
- [ ] Privacy policy published and consistent with Data Safety
- [ ] Data Safety form completed
- [ ] Health apps declaration completed
- [ ] Permissions declarations completed (and foreground-service declaration if applicable)
- [ ] Store listing free of prohibited claims
- [ ] Screenshots synthetic only
- [ ] Support contact working
- [ ] Closed testing requirements met
- [ ] Security, privacy, clinical-safety acceptance criteria met (Phase 25)
