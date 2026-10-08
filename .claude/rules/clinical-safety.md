# Rule: Clinical Safety (always loaded)

Authoritative source: `docs/CLINICAL-SAFETY.md`.

- ClinNote is a documentation and evidence-review assistant, never an autonomous doctor.
- Never diagnose, prescribe, change doses, decide treatment, confirm disease, or triage.
- Use "POSSIBILITY TO REVIEW" / "CLINICAL TOPIC TO REVIEW" — never "FINAL DIAGNOSIS". No probability percentages.
- Never invent findings, lab values, medications, allergies, history, normal results, citations, PMIDs, FDA records, labels, trials or URLs.
- Keep information state (NOT_DISCUSSED / NEGATIVE / POSITIVE / UNKNOWN), provenance (PATIENT_REPORTED / CLINICIAN_STATED / MEASURED / TRANSCRIPTION / AI_EXTRACTED / EXTERNAL_SOURCE / CLINICIAN_CONFIRMED / UNKNOWN) and review status separate.
- "Allergies were not discussed" → NOT_DISCUSSED, never "no known allergies". "Patient denies fever" → NEGATIVE. "Doctor says the patient has asthma" → CLINICIAN_STATED, PROVISIONAL until confirmed in-app.
- AI output stays PROVISIONAL (and AI inference stays AI_EXTRACTED) until a clinician confirms it. Only clinician actions confirm, finalize, complete or discontinue.
- Preserve negation, uncertainty, numbers and units exactly. Absence ≠ discontinuation.
- Provenance is assigned by deterministic code from the clinician-confirmed speaker role (`docs/DATA_MODEL.md` §3.2/§8), never by the model.
- AI inference is labeled AI_EXTRACTED / "AI inference — verify". AI never assigns MEASURED or CLINICIAN_CONFIRMED.
- Contradictions: keep both statements and create a FactConflict (§9). A later statement supersedes an earlier one only after clinician resolution. A positive allergy is never hidden.
- Evidence is retrieved before possibilities are generated (ADR-023). Possibilities (R2) stay behind a default-off flag until a formal regulatory assessment (ADR-025).
- Possibilities run only with the flag ON and citable evidence. They never run on facts alone, and never enter notes or exports (ADR-034). Job 16 patient explanations are R2 too (ADR-041).
- Model output never reaches the clinician as unchecked prose or an ungrounded concept. Code computes concept keys, renders AI note text from fact values, and builds evidence queries from stated facts only (ADR-039, ADR-043).
- Only facts eligible for automatic input (current, not SOURCE_CHANGED) feed notes, queries, comparisons and views (`docs/DATA_MODEL.md` §3.3a).
- No AI phase is complete without the safety test corpus and Gate 6 PASS (ADR-024).
- Never relax a safety rule or test to make work pass.
