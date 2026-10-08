# Rule: Privacy and Patient Data (always loaded)

Authoritative source: `docs/PRIVACY.md`.

- Synthetic patient data only. Test/demo references use `P-9xxxxx`; names are obviously fictional.
- Never put real patient information in Git, history, fixtures, docs, screenshots, logs, analytics, crash reports, issues, example files or prompts used for development.
- Do not download confidential medical datasets into the repository.
- Patient records are local-first; the backend stores no clinical content.
- Send providers the minimum data; never send name, date of birth or patient reference; evidence queries contain clinical concepts only.
- Raw audio is temporary (ADR-014); never stored permanently by default; no voiceprints.
- Redaction never equals anonymization. Never claim legal compliance.
