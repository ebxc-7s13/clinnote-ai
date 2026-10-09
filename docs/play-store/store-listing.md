# ClinNote — Google Play Store Listing (draft for 1.2.0)

Prepared 2026-10-09. Owner must review before pasting into Play Console. Prohibited claims (`GOOGLE-PLAY.md` §8) are excluded: no FDA/CDSCO/CE, no "clinically validated", no "diagnoses", no accuracy guarantee.

| Field | Value |
|---|---|
| App name (≤ 30) | `ClinNote — Clinical Notes` |
| Package | `ai.clinnote.app` (permanent) |
| Default language | English (United States) — en-US |
| App or game | App |
| Free or paid | Free (no in-app purchases, no ads) |
| Category | Medical |
| Tags | Medical, Productivity (choose from the Play list) |
| Contact email | **OWNER: required** |
| Website | optional |
| Privacy policy URL | **OWNER: publish `docs/play-store/privacy-policy.md` at a public HTTPS URL** (the repository is private, so a GitHub link to it is not public) |

## Short description (≤ 80 characters)

```
Consultation notes and evidence review for clinicians. You stay in control.
```

## Full description (≤ 4000 characters)

```
ClinNote is a documentation and evidence-review assistant for healthcare professionals.

With the patient's consent, ClinNote listens to a consultation using your device's speech recognition, turns it into a transcript you can correct, and organizes what was said into clinical facts that you review. Every fact keeps where it came from (patient-reported, clinician-stated, measured) and stays provisional until you confirm it. Nothing is confirmed on your behalf.

WHAT CLINNOTE DOES
• Records consultations in segments: pause, resume, add more conversation, finalize
• Lets you correct the transcript, speaker roles, splits and merges
• Organizes history, medications, allergies, investigations and follow-up from what was said, keeping "not discussed" separate from "denied"
• Keeps conflicting statements side by side for you to resolve
• Builds a structured encounter report and an editable draft note
• Shows public reference information for medications and topics already mentioned (U.S. National Library of Medicine, openFDA, DailyMed, PubMed, Europe PMC, MedlinePlus, ClinicalTrials.gov), each with its source
• Compares visits over time for returning patients
• Exports to PDF, text or JSON

PRIVACY
• Patient records stay on your device, encrypted with a key held in Android secure storage
• No accounts, no analytics, no advertising, no crash-reporting SDK
• Audio is temporary and deleted after transcription
• Only clinical terms (never names, dates of birth or transcript sentences) are sent to public reference sources

IMPORTANT
ClinNote is not a medical device and does not diagnose, treat, cure or prevent any medical condition. It does not prescribe, change doses or triage. It is intended for healthcare professionals, who remain responsible for every clinical decision. For medical advice, diagnosis or treatment, consult a qualified healthcare professional. ClinNote is not clinically validated and has no regulatory approval. Transcription quality depends on your device's speech service. Automatic fact extraction currently works in English only.
```

## Graphics (OWNER / design task — not produced in this session)

| Asset | Requirement | Status |
|---|---|---|
| App icon | 512 × 512 PNG, 32-bit | `mobile/assets/icon.png` exists — export at 512 × 512 |
| Feature graphic | 1024 × 500 PNG/JPEG | NOT CREATED |
| Phone screenshots | 2–8, synthetic patients only (`P-9xxxxx`, fictional names, DEMO label visible) | NOT CREATED |

## Release notes — 1.2.0 (versionCode 3)

```
• First Google Play release build, signed for Play App Signing
• Adds a "not a medical device" notice and a reminder to consult a healthcare professional on the About screen
• No change to recording, transcription, facts, reports or privacy behaviour
```
