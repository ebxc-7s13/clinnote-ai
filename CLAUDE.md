# ClinNote AI — Repository Instructions

## Project

ClinNote AI is an Android-first ambient clinical documentation and evidence-review application.

The application captures clinician-patient conversations after explicit consent, converts the conversation into structured clinical information, retrieves relevant evidence from authoritative sources, assists the clinician in reviewing the case, generates an editable clinical note, and maintains a longitudinal patient timeline.

ClinNote is a clinical productivity and evidence-review assistant.

ClinNote is not an autonomous doctor.

## Mandatory Engineering Rules

1. Read the relevant documentation before implementing any feature.
2. Follow `docs/PRODUCT_SPEC.md` as the product authority.
3. Follow `docs/ARCHITECTURE.md` as the architecture authority.
4. Follow `docs/BUILD_PLAN.md` for implementation order.
5. Follow `docs/CLINICAL-SAFETY.md` for safety boundaries.
6. Follow `docs/PRIVACY.md` for patient-data handling.
7. Follow `docs/SECURITY.md` for security requirements.
8. Follow `docs/API_CATALOG.md` for external provider strategy.
9. Follow `docs/DATA_MODEL.md` for domain/data structures.
10. Follow `docs/TESTING.md` for validation requirements.
11. Follow `docs/GOOGLE-PLAY.md` for release preparation.
12. Record significant decisions in `docs/DECISIONS.md` and track progress in `docs/PROJECT-STATUS.md`.

### Authority Precedence

If two documents conflict, the following order applies until the conflict is fixed:

1. `CLINICAL-SAFETY.md`
2. `PRIVACY.md`
3. `SECURITY.md`
4. `PRODUCT_SPEC.md`
5. `ARCHITECTURE.md`
6. `DATA_MODEL.md`
7. all other documents

Safety, privacy and security constraints always win over product convenience. The conflict must still be fixed as described below.

## Documentation-First Rule

Do not implement a feature before its intended behavior is documented.

If implementation reveals a contradiction:

1. identify the contradiction
2. document it
3. update the authoritative specification
4. record the architectural decision in DECISIONS.md
5. continue implementation only after the documentation is internally consistent

Never silently override documentation.

## AI Rules

AI must never be treated as an unquestionable source of truth.

Never allow AI output to silently become:

- a confirmed diagnosis
- a confirmed medication change
- a confirmed allergy
- a confirmed investigation result
- a clinician statement
- a measured value
- a completed follow-up

AI-generated information must retain provenance.

## Clinical Information Rules

Every clinical fact carries three independent attributes (defined in `docs/DATA_MODEL.md`). They must never be conflated.

Information state — what was said about the finding:

- NOT_DISCUSSED
- NEGATIVE
- POSITIVE
- UNKNOWN

Provenance — where the information came from:

- PATIENT_REPORTED
- CLINICIAN_STATED
- MEASURED
- TRANSCRIPTION
- AI_EXTRACTED
- EXTERNAL_SOURCE
- CLINICIAN_CONFIRMED
- UNKNOWN

Review status — whether a clinician has accepted it:

- PROVISIONAL
- CONFIRMED
- REJECTED
- UNKNOWN

Never convert "not discussed" into a negative finding.

Never invent missing clinical information.

Never fabricate medical citations.

Never fabricate FDA data.

Never fabricate PMID values.

Never invent medication doses.

Never silently change numerical values.

## Privacy Rules

Never put real patient information into:

- Git
- tests
- example files
- documentation
- screenshots
- analytics
- logs
- crash reports
- issue descriptions

Use synthetic patients only during development.

Never commit API keys.

Never place private API credentials inside the mobile application.

## Model Deployment Rule

Do not download large model weights unless an explicit architecture decision later requires it.

The default architecture is API/cloud-provider based.

Avoid unnecessary local ML infrastructure.

## Provider Abstraction

Every external AI or medical-data provider must be behind an interface.

Never hard-code an external provider throughout the UI.

Provider substitution must be possible.

## Error Handling

External provider failure must not destroy:

- transcript
- clinical facts
- patient record
- draft note

Always degrade gracefully.

## Testing

No feature is considered complete because it compiles.

Critical functionality must be tested.

Clinical safety tests are mandatory.

## Source Verification

External API details, model names, pricing, limits, endpoints, and policy requirements must be verified against official documentation before implementation.

Do not rely on old blog posts when official documentation exists.

Anything marked `VERIFY BEFORE IMPLEMENTATION` must be verified, and the verification date recorded in `docs/API_CATALOG.md`, before code depending on it is merged.

## Autonomous Execution

When implementation begins:

1. inspect the repository
2. read relevant docs
3. plan the task
4. implement
5. test
6. fix
7. document
8. update project status
9. commit
10. continue

Do not repeatedly ask what to do next when BUILD_PLAN.md already defines the next task.

Stop and ask only when an `OPEN DECISION` in `docs/DECISIONS.md` blocks the next task, or when credentials or account actions only the owner can perform are required.

## No False Claims

Never claim:

- clinically validated
- FDA approved
- CDSCO approved
- CE certified
- production ready
- medically accurate

without actual evidence.

## Final Principle

Build ClinNote as:

AN AMBIENT CLINICAL MEMORY AND EVIDENCE-REVIEW SYSTEM

not:

AN AI DOCTOR.
