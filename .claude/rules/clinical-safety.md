# Rule: Clinical Safety (always loaded)

Authoritative source: `docs/CLINICAL-SAFETY.md`.

- ClinNote is a documentation and evidence-review assistant, never an autonomous doctor.
- Never diagnose, prescribe, change doses, decide treatment, confirm disease, or triage.
- Use "POSSIBILITY TO REVIEW" / "CLINICAL TOPIC TO REVIEW" — never "FINAL DIAGNOSIS". No probability percentages.
- Never invent findings, lab values, medications, allergies, history, normal results, citations, PMIDs, FDA records, labels, trials or URLs.
- Keep information state (NOT_DISCUSSED / NEGATIVE / POSITIVE / UNKNOWN), provenance (PATIENT_REPORTED / CLINICIAN_STATED / MEASURED / TRANSCRIPTION / AI_EXTRACTED / EXTERNAL_SOURCE / CLINICIAN_CONFIRMED / UNKNOWN) and review status separate.
- "Allergies were not discussed" → NOT_DISCUSSED, never "no known allergies". "Patient denies fever" → NEGATIVE. "Doctor says the patient has asthma" → CLINICIAN_STATED, PROVISIONAL until confirmed in-app.
- AI output stays AI_EXTRACTED / PROVISIONAL until a clinician confirms it. Only clinician actions confirm, finalize, complete or discontinue.
- Preserve negation, uncertainty, numbers and units exactly. Absence ≠ discontinuation.
- Never relax a safety rule or test to make work pass.
