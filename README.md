# ClinNote AI

> Listen. Organize. Review. Remember.

ClinNote AI is an Android-first ambient clinical documentation and evidence-review assistant designed for healthcare professionals.

ClinNote captures a clinician-patient consultation after explicit consent, converts the conversation into structured clinical information, maintains a longitudinal patient record, retrieves relevant biomedical and regulatory information, and produces an editable clinical note for clinician review.

> **Status:** Documentation phase. No application code exists yet. ClinNote is not clinically validated and holds no regulatory approval. See `docs/PROJECT-STATUS.md`.

## Core Workflow

```text
Patient
   ↓
Consultation
   ↓
Consent
   ↓
Ambient Recording
   ↓
Speech-to-Text
   ↓
Speaker Diarization
   ↓
Clinical Fact Extraction
   ↓
Patient Profile
   ↓
Evidence Retrieval
   ↓
Clinician Review
   ↓
Editable Note
   ↓
Clinician Confirmation
   ↓
Saved Encounter
   ↓
Longitudinal Timeline
```

## Core Product Areas

### Ambient Documentation

ClinNote can capture a clinician-patient conversation and convert it into a structured transcript.

### Clinical Information Extraction

ClinNote extracts:

- symptoms
- symptom duration
- severity
- relevant history
- medications
- allergies
- vital signs
- investigations
- examination findings
- assessments explicitly stated
- plans explicitly stated
- follow-up information

### Longitudinal Patient Memory

Each patient can have multiple encounters.

ClinNote can compare:

- symptoms
- medications
- investigations
- assessments
- follow-up
- other explicitly documented information

across visits.

### Evidence Review

ClinNote can search authoritative sources such as:

- FDA/openFDA
- Drugs@FDA
- DailyMed
- RxNorm
- PubMed
- Europe PMC
- MedlinePlus
- ClinicalTrials.gov
- NLM Clinical Tables
- PubChem
- WHO resources
- NCI resources

The exact production source set will be verified against current official API documentation before implementation.

### Clinician Control

AI-generated information remains provisional until a clinician reviews and confirms it.

## Clinical Safety Position

ClinNote does not replace a clinician.

The initial product must not autonomously:

- diagnose patients
- prescribe treatment
- change medication dosage
- confirm disease
- create undocumented clinical findings

The system should present relevant possibilities and evidence for clinician review.

## Privacy Position

ClinNote follows a local-first and minimum-data architecture.

Development must use synthetic data.

The system should avoid unnecessary collection of patient-identifying information.

## Development Strategy

The project is intentionally documentation-first.

Implementation begins only after:

- product requirements are documented
- architecture is documented
- API providers are documented
- clinical-safety rules are documented
- privacy requirements are documented
- data structures are documented
- testing requirements are documented
- deployment requirements are documented

Contributors (human or AI) must read `CLAUDE.md` before making changes.

## Documentation Map

| Document | Purpose |
|---|---|
| `CLAUDE.md` | Repository rules for all contributors |
| `docs/PRODUCT_SPEC.md` | Product authority |
| `docs/BUILD_PLAN.md` | Implementation order |
| `docs/ARCHITECTURE.md` | Architecture authority |
| `docs/API_CATALOG.md` | External provider registry |
| `docs/DATA_MODEL.md` | Domain entities and enums |
| `docs/SPEECH.md` | Recording, transcription, diarization |
| `docs/AI.md` | LLM usage, prompts, validation |
| `docs/EVIDENCE-SOURCES.md` | Evidence hierarchy and sources |
| `docs/SECURITY.md` | Security requirements |
| `docs/PRIVACY.md` | Privacy requirements |
| `docs/CLINICAL-SAFETY.md` | Clinical safety boundaries |
| `docs/UI-UX.md` | Interface specification |
| `docs/TESTING.md` | Testing strategy |
| `docs/DEPLOYMENT.md` | Build, backend, CI/CD |
| `docs/GOOGLE-PLAY.md` | Play Store preparation |
| `docs/PROJECT-STATUS.md` | Current status |
| `docs/BUILD_REPORT.md` | Phase build reports |
| `docs/DECISIONS.md` | Architectural decisions and open decisions |

## Project Status

See:

`docs/PROJECT-STATUS.md`

## Implementation Plan

See:

`docs/BUILD_PLAN.md`

## Architecture

See:

`docs/ARCHITECTURE.md`

## Safety

See:

`docs/CLINICAL-SAFETY.md`

## Privacy

See:

`docs/PRIVACY.md`

## Security

See:

`docs/SECURITY.md`

## Evidence Sources

See:

`docs/EVIDENCE-SOURCES.md`

## License

The final licensing strategy is an OPEN DECISION (see `docs/DECISIONS.md`, OD-010) and must be documented before public release. Until then, no license is granted.
