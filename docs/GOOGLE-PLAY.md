# ClinNote AI — Google Play Preparation

All Play policy details below must be verified against current Google Play Console Help and Developer Policy Center pages at release time. VERIFY BEFORE IMPLEMENTATION.

## App Category

Health-related productivity/application (Medical or Productivity category; final choice made at release).

The exact Play Store category and declarations must be verified before release.

## Health Functionality

ClinNote handles health-related information and provides AI-assisted clinical documentation/evidence review.

Therefore the release process must evaluate:

- Health Apps declaration
- privacy policy
- Data Safety requirements
- sensitive permissions
- medical functionality requirements
- AI-generated content policy requirements
- current Play policies

If a target market treats ClinNote as a medical device (OD-005), Play may require evidence of regulatory clearance; release cannot proceed without it.

## Permissions

Expected core permission:

RECORD_AUDIO

Possibly required, depending on the Phase 5 decision about background recording (`SPEECH.md`, Android Recording Constraints):

- foreground service permission(s) for a microphone-type foreground service
- notification permission (for the persistent recording notification on recent Android versions)

Each must be justified in the Play Console where required.

Only request permissions required by implemented features.

Do not request unnecessary:

- location
- contacts
- phone
- SMS

## Privacy Policy

A public privacy policy must be available before production publication.

It must accurately describe:

- audio handling
- transcription
- AI processing
- data storage
- third-party services
- deletion
- security
- user controls

The policy is derived from the provider table in `PRIVACY.md` and must be consistent with the Data Safety form.

## Data Safety

Expected declarations (to be confirmed against the implemented app):

- audio is collected and sent to a speech provider for processing (transmitted, not stored by ClinNote's backend)
- health information is processed by an AI provider
- data is encrypted in transit
- users can request deletion (local deletion in-app)
- no data shared for advertising
- no location, contacts or advertising IDs collected

## Medical Claims

Do not claim:

FDA approval

CDSCO approval

CE certification

clinical validation

medical-device certification

unless documented evidence actually exists.

## Store Description

Store listing language must not claim that ClinNote:

- replaces doctors
- diagnoses disease autonomously
- guarantees accuracy
- provides definitive medical advice

The listing states that ClinNote is intended for healthcare professionals and that AI output requires clinician review.

## Testing

Complete the current Google Play testing requirements applicable to the developer account before production release (e.g. closed-testing requirements for new personal developer accounts — VERIFY current rules).

Do not rely on an outdated understanding of Play Console requirements.

The testing track uses synthetic patients only. Testers must be instructed not to enter real patient information.

## Final Review

Before submission:

- verify current Play policy
- verify target SDK requirements
- verify privacy policy
- verify Data Safety answers
- verify Health Apps declaration
- verify permissions
- verify store screenshots (synthetic data only)
- verify app description
- verify contact/support information
- verify license decision (OD-010)
