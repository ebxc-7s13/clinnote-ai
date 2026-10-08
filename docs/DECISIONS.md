# ClinNote AI — Architectural Decisions

This file records important decisions (ADRs) and genuinely unresolved decisions (OPEN DECISIONS).

ADR statuses: PROPOSED, ACCEPTED, SUPERSEDED, DEPRECATED.

## ADR-001 — Android First

Status:

ACCEPTED

Decision:

Build Android first.

Reason:

The initial product target is Android distribution through Google Play.

## ADR-002 — API-First AI

Status:

ACCEPTED

Decision:

Use cloud/API providers rather than downloading large AI models during initial development.

Reason:

- easier Codespace development
- lower storage usage
- no GPU dependency
- easier provider switching
- faster iteration

## ADR-003 — Local-First Patient Storage

Status:

ACCEPTED FOR V1 ARCHITECTURE

Decision:

Prefer local patient/visit storage.

Reason:

Minimize unnecessary cloud storage of health data.

## ADR-004 — Provider Abstraction

Status:

ACCEPTED

Decision:

All AI, speech and medical-data providers must use adapters/interfaces.

Reason:

Provider capabilities, pricing and policies change.

## ADR-005 — Clinical Possibilities Instead of Autonomous Diagnosis

Status:

ACCEPTED

Decision:

The initial product presents possibilities for clinician review rather than autonomous final diagnosis.

Reason:

Clinical safety, transparency, validation requirements and product trust.

## ADR-006 — Synthetic Data During Development

Status:

ACCEPTED

Decision:

Use only synthetic clinical information during development and testing.

Reason:

Privacy and security.

## ADR-007 — Provenance

Status:

ACCEPTED

Decision:

Important clinical facts and AI outputs must retain provenance.

Reason:

Traceability and clinician trust.

## ADR-008 — Staged Evidence Retrieval

Status:

ACCEPTED

Decision:

Do not query external evidence sources continuously during every spoken sentence.

Reason:

Latency, cost, relevance and API efficiency.

Evidence retrieval occurs primarily after sufficient clinical context exists.

## ADR-009 — React Native + Expo + TypeScript

Status:

ACCEPTED

Decision:

The mobile app is built with React Native and Expo using TypeScript in strict mode, built with EAS Build.

Reason:

Fast iteration in Codespaces without a local Android toolchain, managed builds, cross-platform option for later, strong typing for clinical data structures.

## ADR-010 — Serverless Backend on Supabase Edge Functions, Stateless for Clinical Content

Status:

ACCEPTED

Decision:

Use Supabase Edge Functions as the minimal backend for key protection, validation, routing and rate limiting. The backend does not persist transcripts, facts, notes or audio.

Reason:

Keeps private keys off the device without introducing server-side storage of health data; low operational overhead. Replaceable by an equivalent serverless platform through a new ADR.

## ADR-011 — SQLite as Local Clinical Store

Status:

ACCEPTED

Decision:

Use SQLite (via the Expo SQLite library current at implementation time) as the on-device database.

Reason:

Relational structure fits the data model (patients → visits → facts), works offline, supports local search, is mature on Android. The encryption mechanism is OD-003.

## ADR-012 — Temporary Audio Maximum Retention

Status:

ACCEPTED

Decision:

Temporary audio is deleted after successful processing, when the visit is discarded, or after at most 24 hours, whichever comes first, unless the clinician explicitly opts in to retention for that visit.

Reason:

Allows retry after network/provider failure while bounding exposure of raw audio. The 24-hour value may change if OD-006 sets different retention rules.

## ADR-013 — Information State, Provenance and Review Status Are Independent

Status:

ACCEPTED

Decision:

Each clinical fact carries three separate attributes: information state (NOT_DISCUSSED / NEGATIVE / POSITIVE / UNKNOWN), provenance, and review status (PROVISIONAL / CONFIRMED / REJECTED / UNKNOWN).

Reason:

Mixing them (e.g. treating CLINICIAN_CONFIRMED as an information state) causes "not discussed" to be confused with "negative" and AI output to be confused with clinician statements. The original repository instructions listed these values in one list; this ADR clarifies their separation (see `DATA_MODEL.md`).

## ADR-014 — No Numerical Probabilities for Possibilities

Status:

ACCEPTED

Decision:

Possibilities to review are never shown with probability scores or likelihood rankings.

Reason:

LLM-produced probabilities are not calibrated and would imply diagnostic certainty the system cannot support.

## ADR-015 — V1 Is Single-Clinician, Single-Device, No Cloud Sync

Status:

ACCEPTED

Decision:

V1 stores patient records only on one device for one clinician. No cloud backup or sync.

Reason:

Follows ADR-003 and data minimization, and avoids server-side health-data storage and multi-user access control in V1. Consequence: device loss or uninstall loses data; the clinician is told this and can export.

---

# Open Decisions

Each open decision below cannot reasonably be made from the documentation alone.

## OD-001 — Primary Speech Provider

- **Why open:** Quality, diarization, latency, pricing, data terms and language support must be tested on real (synthetic-content) audio and against current provider terms.
- **Information required:** Comparative test results on synthetic consultations; verified provider terms (`API_CATALOG.md` checklist); OD-007 language list.
- **Who decides:** Project owner, based on engineering evaluation.
- **When:** Start of Phase 6.

## OD-002 — Primary LLM Provider and Model

- **Why open:** Model identifiers, structured-output support, pricing and data terms change frequently; Gemini is the prototype candidate but not committed.
- **Information required:** Verified current models; evaluation results on the synthetic AI evaluation set (`TESTING.md`); data-retention terms.
- **Who decides:** Project owner, based on engineering evaluation.
- **When:** Start of Phase 8.

## OD-003 — Local Storage Encryption Mechanism

- **Why open:** Depends on what encrypted-SQLite support the Expo SDK current at implementation time offers, and on key storage via Android Keystore-backed secure storage.
- **Information required:** Verified Expo SQLite encryption options; key management approach; performance on target devices.
- **Who decides:** Engineering, approved by project owner.
- **When:** Before any build is distributed beyond the developer (preview) and in any case before Phase 14 production build.

## OD-004 — Backend Authentication / Clinician Accounts

- **Why open:** The backend must not be an open proxy to paid AI APIs, but V1 has no cloud records. Options include anonymous device attestation (e.g. Play Integrity), Supabase Auth clinician accounts, or both. Choice affects privacy disclosures and onboarding.
- **Information required:** Verified Play Integrity / Supabase Auth capabilities; whether clinician identity verification is required in target markets (OD-005).
- **Who decides:** Project owner.
- **When:** Start of Phase 6 (first backend endpoint).

## OD-005 — Target Jurisdictions and Regulatory Classification

- **Why open:** Applicable privacy law (e.g. India DPDP Act, HIPAA, GDPR), medical-device classification (e.g. CDSCO, FDA, EU MDR) and consent rules for recording depend on where the app is released. This requires legal/regulatory advice, not engineering judgment.
- **Information required:** Target countries; qualified regulatory and legal opinion on whether the V1 feature set is a medical device in each.
- **Who decides:** Project owner with legal/regulatory advisers.
- **When:** Before Phase 15 (Google Play); ideally before Phase 10 since it may constrain clinical-review features.

## OD-006 — Data Retention Policy

- **Why open:** Medical-record retention obligations vary by jurisdiction and institution.
- **Information required:** OD-005 outcome; clinician/institution requirements.
- **Who decides:** Project owner with legal advice.
- **When:** Before Phase 15.

## OD-007 — Supported Consultation Languages

- **Why open:** Target clinicians may consult in English, regional languages or code-mixed speech; provider support varies.
- **Information required:** Target user research; provider language verification.
- **Who decides:** Project owner.
- **When:** Before OD-001 is decided (start of Phase 6).

## OD-008 — Reference Image Source

- **Why open:** Images must be legally usable with clear licensing; no candidate source has been verified.
- **Information required:** Candidate sources (e.g. government or openly-licensed medical image collections) with verified licenses and API terms.
- **Who decides:** Project owner.
- **When:** Before any ImageProvider implementation (not needed for V1 core workflow).

## OD-009 — Crash Reporting Provider

- **Why open:** Crash reporting is useful but must support strict scrubbing of clinical content; provider not yet evaluated.
- **Information required:** Verified scrubbing capabilities and data terms of candidates (e.g. Sentry).
- **Who decides:** Engineering, approved by project owner.
- **When:** Phase 12, before any preview build is distributed to testers.

## OD-010 — License

- **Why open:** Choice between proprietary and open-source licensing is a business decision.
- **Information required:** Business model and distribution intent.
- **Who decides:** Project owner.
- **When:** Before public release (Phase 15) or before making the repository public, whichever is first.

## Future Decisions

Future significant architecture decisions must be recorded here.
