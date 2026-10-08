# ClinNote AI — Agent Handoffs

This directory is Level 3 of the agent communication protocol (`docs/AGENT-COMMUNICATION.md`). Each completed major cross-agent task, review or verdict gets one file here.

## Naming

- Handoff: `YYYY-MM-DD-<from-agent>-to-<to-agent>-<topic>.md`
- Review: `YYYY-MM-DD-review-<reviewer-agent>-<topic>.md`
- Dry runs / system tests: `YYYY-MM-DD-dry-run-<agent>.md`

## Rules

- Use the Task Handoff format (`TEMPLATE.md`). Every section must have content; write "none" when nothing applies.
- Handoffs are append-only records. Corrections go in a new file that references the old one.
- No real patient data, no secrets, no unverifiable claims.

## Index

| File | Owner | Topic |
|---|---|---|
| `TEMPLATE.md` | chief-architect | Blank handoff template |
| `2026-10-08-dry-run-chief-architect.md` | chief-architect | Multi-agent dry-run synthesis and verification |
| `2026-10-08-dry-run-product-clinical-architect.md` | product-clinical-architect | Dry-run findings: product and workflow dependencies |
| `2026-10-08-dry-run-evidence-research-engineer.md` | evidence-research-engineer | Dry-run findings: evidence and API dependencies |
| `2026-10-08-dry-run-clinical-safety-engineer.md` | clinical-safety-engineer | Dry-run findings: clinical safety dependencies |
| `2026-10-08-review-chief-architect-dry-run-clarification.md` | chief-architect | Clarifies dry-run concerns 15–16; routes F-01…F-14 |
