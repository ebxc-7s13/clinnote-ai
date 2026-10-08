# ClinNote AI — API Catalog

Registry of every external provider ClinNote may use.

## 1. Purpose

This is the registry of external providers ClinNote may use, their intended role, the data that would flow to and from them, and their verification status.

**API capabilities, pricing, limits, endpoint names, and data-processing terms must be reverified immediately before implementation.**

No provider listed here has been verified yet. Values marked `VERIFY BEFORE IMPLEMENTATION` are deliberately not filled with remembered details, because endpoints, model names, pricing and limits change. "Official documentation URL" entries are the expected starting points for verification and must themselves be confirmed.

## 2. General Rules

- Use APIs; do not download model weights (ADR-002, ADR-003).
- Private keys stay in the backend secret store; never in the app (`SECURITY.md`).
- No API keys or provider accounts exist yet. Credential variables listed below are the names the backend will use once the project owner creates them.
- Every provider sits behind an interface (ADR-004, `ARCHITECTURE.md` §3.6).
- Do not call every provider on every request; use the routing table (§29).
- Never send patient identifiers to evidence providers. Evidence queries contain clinical concepts only.
- Every call creates a `ProviderExecution` record with technical metadata only (`DATA_MODEL.md`).

## 3. Verification Checklist (per provider)

Before implementing a provider, confirm from official documentation and record in §31:

1. current endpoint / API family and version
2. authentication mechanism and whether a key is required
3. rate limits and quotas
4. pricing / free or development availability
5. data retention and whether submitted data is used for training
6. suitability for health data (data-processing agreement, BAA or equivalent where the target jurisdiction requires it — OD-005)
7. terms of use, attribution and redistribution requirements
8. supported languages (speech)
9. client-side streaming options (short-lived tokens) for speech

Field legend used below: **VBI** = VERIFY BEFORE IMPLEMENTATION.

---

## SPEECH PROVIDERS

Primary selection: OPEN DECISION OD-001.

## 4. AssemblyAI

| Field | Value |
|---|---|
| Provider | AssemblyAI |
| Purpose | Live (streaming) and post-recording transcription; speaker diarization |
| Category | Speech-to-text / diarization |
| Potential endpoint/API family | Streaming speech-to-text API; pre-recorded (async) transcription API — VBI |
| Credential required | Yes |
| Credential environment variable | `ASSEMBLYAI_API_KEY` (backend only) |
| Free/development availability | VBI |
| Rate limit | VBI |
| Data sent | Consultation audio stream (no patient metadata) |
| Data received | Transcript segments, timestamps, confidence, speaker labels |
| Latency considerations | Streaming latency must be low enough for live display; diarization may only be available post-recording — VBI |
| Fallback | Configured STT_FALLBACK provider; manual entry |
| Privacy considerations | Audio is health data; check retention, deletion options, training use, processing location |
| Production suitability | Candidate — pending evaluation and terms review |
| Verification status | VBI |
| Official documentation URL | https://www.assemblyai.com/docs |

## 5. Deepgram

| Field | Value |
|---|---|
| Provider | Deepgram |
| Purpose | Live streaming transcription; diarization |
| Category | Speech-to-text / diarization |
| Potential endpoint/API family | Streaming (WebSocket) and pre-recorded speech-to-text APIs — VBI |
| Credential required | Yes |
| Credential environment variable | `DEEPGRAM_API_KEY` (backend only) |
| Free/development availability | VBI |
| Rate limit | VBI |
| Data sent | Consultation audio stream |
| Data received | Transcript, timestamps, confidence, speaker labels |
| Latency considerations | Designed for real-time use — VBI with synthetic tests |
| Fallback | STT_FALLBACK; manual entry |
| Privacy considerations | Retention, training use, processing location — VBI |
| Production suitability | Candidate |
| Verification status | VBI |
| Official documentation URL | https://developers.deepgram.com/docs |

## 6. OpenAI (Speech)

| Field | Value |
|---|---|
| Provider | OpenAI |
| Purpose | High-quality final-transcript pass; diarized transcription where the current API supports it |
| Category | Speech-to-text |
| Potential endpoint/API family | Audio transcription API; realtime API — model names VBI |
| Credential required | Yes |
| Credential environment variable | `OPENAI_API_KEY` (backend only) |
| Free/development availability | VBI |
| Rate limit | VBI |
| Data sent | Audio (final pass) |
| Data received | Transcript, possibly speaker labels — VBI |
| Latency considerations | Final pass is not latency-critical |
| Fallback | Other STT provider |
| Privacy considerations | Retention and training-use terms for API data — VBI |
| Production suitability | Candidate for final pass |
| Verification status | VBI |
| Official documentation URL | https://platform.openai.com/docs |

## 7. Google Gemini (Speech)

| Field | Value |
|---|---|
| Provider | Google (Gemini API) |
| Purpose | Audio transcription and diarization via multimodal model |
| Category | Speech-to-text (multimodal) |
| Potential endpoint/API family | Gemini API audio understanding — VBI |
| Credential required | Yes |
| Credential environment variable | `GEMINI_API_KEY` (backend only) |
| Free/development availability | VBI (free tiers may have different data-use terms than paid tiers) |
| Rate limit | VBI |
| Data sent | Audio (final pass) |
| Data received | Transcript text, possibly speaker attribution |
| Latency considerations | Likely suited to final pass rather than live streaming — VBI |
| Fallback | Other STT provider |
| Privacy considerations | Data-use terms by tier — VBI |
| Production suitability | Candidate |
| Verification status | VBI |
| Official documentation URL | https://ai.google.dev/gemini-api/docs |

---

## LLM PROVIDERS

Primary selection: OPEN DECISION OD-002.

## 8. Google Gemini (LLM)

| Field | Value |
|---|---|
| Provider | Google (Gemini API) |
| Purpose | AI jobs in `AI.md` (extraction, note generation, synthesis, comparison) |
| Category | LLM |
| Potential endpoint/API family | Gemini API content generation with structured (JSON schema) output — model identifiers VBI |
| Credential required | Yes |
| Credential environment variable | `GEMINI_API_KEY` |
| Free/development availability | VBI |
| Rate limit | VBI |
| Data sent | Role-labeled transcript of current visit; structured facts; evidence excerpts; minimal context (age/sex) |
| Data received | Structured JSON per job schema |
| Latency considerations | Post-consultation; several seconds acceptable |
| Fallback | LLM_FALLBACK (OpenAI or Anthropic) |
| Privacy considerations | Data-use and retention by tier — VBI |
| Production suitability | Primary prototype candidate |
| Verification status | VBI |
| Official documentation URL | https://ai.google.dev/gemini-api/docs |

## 9. OpenAI (LLM)

| Field | Value |
|---|---|
| Provider | OpenAI |
| Purpose | AI jobs; fallback or primary |
| Category | LLM |
| Potential endpoint/API family | Responses/Chat API with structured outputs — VBI |
| Credential required | Yes |
| Credential environment variable | `OPENAI_API_KEY` |
| Free/development availability | VBI |
| Rate limit | VBI |
| Data sent | As §8 |
| Data received | Structured JSON |
| Latency considerations | As §8 |
| Fallback | Other LLM provider |
| Privacy considerations | VBI |
| Production suitability | Candidate |
| Verification status | VBI |
| Official documentation URL | https://platform.openai.com/docs |

## 10. Anthropic (LLM)

| Field | Value |
|---|---|
| Provider | Anthropic (Claude API) |
| Purpose | AI jobs; fallback or primary |
| Category | LLM |
| Potential endpoint/API family | Messages API with tool use / structured output — model identifiers VBI |
| Credential required | Yes |
| Credential environment variable | `ANTHROPIC_API_KEY` |
| Free/development availability | VBI |
| Rate limit | VBI |
| Data sent | As §8 |
| Data received | Structured JSON |
| Latency considerations | As §8 |
| Fallback | Other LLM provider |
| Privacy considerations | VBI |
| Production suitability | Candidate |
| Verification status | VBI |
| Official documentation URL | https://docs.anthropic.com (VBI — confirm current documentation location) |

## 11. Speech/LLM Provider Abstraction

- `SpeechProvider`: `startStream(config) → stream handle`, `finalize(audioRef) → segments`, `capabilities()` (streaming, diarization, languages).
- `DiarizationProvider`: `diarize(audioRef | segments) → speaker-labeled segments`.
- `LLMProvider`: `run(job, input, schema) → validated JSON | error`.
- Provider choice is per job/route, configured on the backend (§29). A job may use a different provider than another job.
- Every adapter has a mock used in CI.
- Adding a provider requires: a row in this catalog, verification (§31), adapter + contract tests, privacy table update in `PRIVACY.md`.

---

## LITERATURE

Sources for peer-reviewed biomedical literature.

## 12. PubMed / NCBI E-utilities

| Field | Value |
|---|---|
| Provider | NCBI (National Library of Medicine) |
| Purpose | Biomedical literature search and metadata (PMIDs) |
| Category | Literature |
| Potential endpoint/API family | E-utilities (ESearch, ESummary, EFetch) — VBI |
| Credential required | Optional key for higher usage — VBI |
| Credential environment variable | `NCBI_API_KEY` (secret); `NCBI_EMAIL`, `NCBI_TOOL_NAME` (configuration) |
| Free/development availability | Public service — VBI terms |
| Rate limit | VBI (differs with and without key) |
| Data sent | Concept query terms only |
| Data received | PMIDs, titles, authors, journal, dates, abstracts where available |
| Latency considerations | Multiple sequential calls (search then summary); cache results |
| Fallback | Europe PMC |
| Privacy considerations | No identifiers in queries |
| Production suitability | Suitable as LITERATURE_PRIMARY after verification |
| Verification status | VBI |
| Official documentation URL | https://www.ncbi.nlm.nih.gov/books/NBK25501/ |

## 13. Europe PMC

| Field | Value |
|---|---|
| Provider | Europe PMC (EMBL-EBI) |
| Purpose | Literature discovery, open-access full text discovery, cross-checking |
| Category | Literature |
| Potential endpoint/API family | Europe PMC REST API — VBI |
| Credential required | VBI (believed not required) |
| Credential environment variable | None expected |
| Free/development availability | VBI |
| Rate limit | VBI |
| Data sent | Concept query terms |
| Data received | Article metadata, identifiers (PMID/PMCID/DOI), abstracts, OA links |
| Latency considerations | Cache |
| Fallback | PubMed |
| Privacy considerations | No identifiers |
| Production suitability | LITERATURE_SECONDARY |
| Verification status | VBI |
| Official documentation URL | https://europepmc.org/RestfulWebService |

---

## FDA AND DRUG INFORMATION

U.S. regulatory and drug-labeling sources plus medication terminology.

## 14. openFDA

| Field | Value |
|---|---|
| Provider | U.S. Food and Drug Administration (openFDA) |
| Purpose | Drug labeling, adverse-event reports, enforcement/recalls, shortages, NDC, Drugs@FDA data |
| Category | Regulatory |
| Potential endpoint/API family | openFDA drug endpoints (label, event, enforcement, ndc, drugsfda, shortages) — VBI |
| Credential required | Optional key for higher limits — VBI |
| Credential environment variable | `OPENFDA_API_KEY` (optional, backend) |
| Free/development availability | Public — VBI |
| Rate limit | VBI |
| Data sent | Drug names / identifiers (no patient data) |
| Data received | Regulatory records with metadata |
| Latency considerations | Cache; label data changes infrequently |
| Fallback | DailyMed for labels |
| Privacy considerations | No identifiers |
| Production suitability | Suitable as REGULATORY_SOURCE with displayed disclaimers; openFDA states its data is not for clinical decision-making without validation — VBI exact wording |
| Verification status | VBI |
| Official documentation URL | https://open.fda.gov/apis/ |

## 15. Drugs@FDA

| Field | Value |
|---|---|
| Provider | FDA |
| Purpose | Approval history, application numbers, sponsor, products |
| Category | Regulatory |
| Potential endpoint/API family | openFDA `drugsfda` endpoint and/or downloadable data files — VBI |
| Credential required | As §14 |
| Credential environment variable | `OPENFDA_API_KEY` (optional) |
| Free/development availability | Public — VBI |
| Rate limit | As §14 |
| Data sent | Drug names / application numbers |
| Data received | Application and product records |
| Latency considerations | Cache |
| Fallback | Link out to FDA site |
| Privacy considerations | None (no patient data) |
| Production suitability | Suitable after verification |
| Verification status | VBI |
| Official documentation URL | https://open.fda.gov/apis/drug/drugsfda/ |

## 16. NDC Directory

| Field | Value |
|---|---|
| Provider | FDA |
| Purpose | National Drug Code product identification |
| Category | Regulatory |
| Potential endpoint/API family | openFDA `ndc` endpoint — VBI |
| Credential required | As §14 |
| Credential environment variable | `OPENFDA_API_KEY` (optional) |
| Free/development availability | Public — VBI |
| Rate limit | As §14 |
| Data sent | Product names / NDC codes |
| Data received | Product, packaging, labeler data |
| Latency considerations | Cache |
| Fallback | DailyMed |
| Privacy considerations | None |
| Production suitability | Suitable after verification (US products only) |
| Verification status | VBI |
| Official documentation URL | https://open.fda.gov/apis/drug/ndc/ |

## 17. Orange Book

| Field | Value |
|---|---|
| Provider | FDA |
| Purpose | Approved drug products with therapeutic equivalence evaluations |
| Category | Regulatory |
| Potential endpoint/API family | Downloadable data files; possible openFDA exposure — VBI |
| Credential required | VBI |
| Credential environment variable | None expected |
| Free/development availability | Public — VBI |
| Rate limit | N/A for files — VBI |
| Data sent | None (if data files are imported to backend) or product queries |
| Data received | Product and equivalence data |
| Latency considerations | If file-based, periodic import on backend (non-clinical public data) |
| Fallback | Link out |
| Privacy considerations | None |
| Production suitability | Lower priority for V1; regulatory information, not patient advice |
| Verification status | VBI |
| Official documentation URL | https://www.fda.gov/drugs/drug-approvals-and-databases/approved-drug-products-therapeutic-equivalence-evaluations-orange-book |

## 18. DailyMed

| Field | Value |
|---|---|
| Provider | National Library of Medicine (DailyMed) |
| Purpose | Current submitted labeling (SPL): indications, dosage section, contraindications, warnings, adverse reactions, interactions |
| Category | Regulatory (labeling) |
| Potential endpoint/API family | DailyMed web services (SPL search, setid retrieval) — VBI |
| Credential required | VBI (believed not required) |
| Credential environment variable | None expected |
| Free/development availability | Public — VBI |
| Rate limit | VBI |
| Data sent | Drug names / RxCUI / set IDs |
| Data received | SPL metadata and label sections |
| Latency considerations | Labels are large; fetch sections needed; cache |
| Fallback | openFDA label endpoint |
| Privacy considerations | None |
| Production suitability | MEDICATION_LABEL source after verification |
| Verification status | VBI |
| Official documentation URL | https://dailymed.nlm.nih.gov/dailymed/app-support-web-services.cfm |

## 19. RxNorm

| Field | Value |
|---|---|
| Provider | National Library of Medicine (RxNav) |
| Purpose | Medication normalization to RxCUI; candidate concepts for ambiguous names |
| Category | Terminology (medication) |
| Potential endpoint/API family | RxNorm API via RxNav (approximate match, concept lookup) — VBI |
| Credential required | VBI (believed not required) |
| Credential environment variable | None expected |
| Free/development availability | Public — VBI terms |
| Rate limit | VBI |
| Data sent | Raw medication wording (no patient data) |
| Data received | RxCUI candidates, names, term types |
| Latency considerations | Called per medication post-consultation; cache |
| Fallback | Show raw name unnormalized; clinician confirms |
| Privacy considerations | None |
| Production suitability | MEDICATION_STANDARD after verification; US-centric coverage (OD-005) |
| Verification status | VBI |
| Official documentation URL | https://lhncbc.nlm.nih.gov/RxNav/APIs/ |

---

## HEALTH INFORMATION, TRIALS, TERMINOLOGY, CHEMISTRY, PUBLIC HEALTH

Supporting sources for patient education, trials, terminology, chemistry and population health.

## 20. MedlinePlus

| Field | Value |
|---|---|
| Provider | National Library of Medicine |
| Purpose | Patient-friendly health and medication information |
| Category | Patient education |
| Potential endpoint/API family | MedlinePlus web service and MedlinePlus Connect — VBI |
| Credential required | VBI (believed not required) |
| Credential environment variable | None expected |
| Free/development availability | Public — VBI |
| Rate limit | VBI |
| Data sent | Condition / medication terms or codes |
| Data received | Topic summaries, links |
| Latency considerations | Cache |
| Fallback | NCI patient resources (cancer topics); link out |
| Privacy considerations | None |
| Production suitability | PATIENT_EDUCATION after verification |
| Verification status | VBI |
| Official documentation URL | https://medlineplus.gov/about/developers/webservices/ |

## 21. ClinicalTrials.gov

| Field | Value |
|---|---|
| Provider | National Library of Medicine |
| Purpose | Trial discovery, status, eligibility text |
| Category | Clinical trial |
| Potential endpoint/API family | ClinicalTrials.gov data API (current version) — VBI |
| Credential required | VBI |
| Credential environment variable | None expected |
| Free/development availability | Public — VBI |
| Rate limit | VBI |
| Data sent | Condition terms (no location, no identifiers) |
| Data received | Study records with NCT numbers |
| Latency considerations | Clinician-initiated, not automatic |
| Fallback | NCI trial resources for cancer |
| Privacy considerations | No location or patient data |
| Production suitability | TRIALS after verification; never recommends enrollment |
| Verification status | VBI |
| Official documentation URL | https://clinicaltrials.gov/data-api/api |

## 22. NLM Clinical Tables

| Field | Value |
|---|---|
| Provider | National Library of Medicine (Lister Hill Center) |
| Purpose | Autocomplete/lookup of conditions and terminology |
| Category | Terminology |
| Potential endpoint/API family | Clinical Table Search Service — VBI |
| Credential required | VBI |
| Credential environment variable | None expected |
| Free/development availability | Public — VBI |
| Rate limit | VBI |
| Data sent | Partial term strings |
| Data received | Matching terms and codes |
| Latency considerations | Interactive lookup; debounce |
| Fallback | Free text entry |
| Privacy considerations | Terms only |
| Production suitability | Suitable for lookup; never creates diagnoses or billing codes automatically |
| Verification status | VBI |
| Official documentation URL | https://clinicaltables.nlm.nih.gov/ |

## 23. PubChem

| Field | Value |
|---|---|
| Provider | NCBI (PubChem) |
| Purpose | Chemical identity and compound information |
| Category | Chemical information |
| Potential endpoint/API family | PUG-REST — VBI |
| Credential required | VBI |
| Credential environment variable | None expected |
| Free/development availability | Public — VBI usage policy |
| Rate limit | VBI |
| Data sent | Compound names |
| Data received | Compound records (CID, synonyms, properties) |
| Latency considerations | On demand only |
| Fallback | None needed (optional source) |
| Privacy considerations | None |
| Production suitability | Supplementary; never replaces regulatory labeling |
| Verification status | VBI |
| Official documentation URL | https://pubchem.ncbi.nlm.nih.gov/docs/pug-rest |

## 24. WHO

| Field | Value |
|---|---|
| Provider | World Health Organization |
| Purpose | Public-health and epidemiological context |
| Category | Public health |
| Potential endpoint/API family | Global Health Observatory (GHO) data API; other WHO content is linked, not scraped — VBI |
| Credential required | VBI |
| Credential environment variable | None expected |
| Free/development availability | VBI terms |
| Rate limit | VBI |
| Data sent | Indicator / topic queries |
| Data received | Population-level indicators |
| Latency considerations | On demand; cache |
| Fallback | Link out |
| Privacy considerations | None |
| Production suitability | Context only; never patient-specific advice |
| Verification status | VBI |
| Official documentation URL | https://www.who.int/data/gho/info/gho-odata-api |

## 25. NCI

| Field | Value |
|---|---|
| Provider | National Cancer Institute |
| Purpose | Cancer information, patient education, cancer trial resources |
| Category | Health information / clinical trial |
| Potential endpoint/API family | NCI clinical trials API and other NCI APIs — VBI (some may require a key) |
| Credential required | VBI |
| Credential environment variable | `NCI_API_KEY` if required — VBI |
| Free/development availability | VBI |
| Rate limit | VBI |
| Data sent | Cancer-related terms |
| Data received | Information pages, trial records |
| Latency considerations | On demand |
| Fallback | MedlinePlus; ClinicalTrials.gov |
| Privacy considerations | None |
| Production suitability | Supplementary; never implies malignancy |
| Verification status | VBI |
| Official documentation URL | https://www.cancer.gov/ and https://clinicaltrialsapi.cancer.gov/ (VBI) |

## 26. Google Search Grounding

| Field | Value |
|---|---|
| Provider | Google (grounding with Google Search via Gemini API) |
| Purpose | Secondary discovery when authoritative APIs return nothing; results must be resolved back to an authoritative source before display |
| Category | General web (Tier 6) |
| Potential endpoint/API family | Gemini API grounding tool — VBI |
| Credential required | Yes (Gemini key) |
| Credential environment variable | `GEMINI_API_KEY` |
| Free/development availability | VBI (pricing may differ from base model) |
| Rate limit | VBI |
| Data sent | Concept query |
| Data received | Generated text with source links |
| Latency considerations | Slower; optional |
| Fallback | None — absence is shown as "no evidence found" |
| Privacy considerations | No identifiers; check display/attribution requirements |
| Production suitability | Not enabled in V1 without a dedicated ADR |
| Verification status | VBI |
| Official documentation URL | https://ai.google.dev/gemini-api/docs/grounding |

---

## INFRASTRUCTURE

Platform services that host the backend and support operations.

## 27. Supabase

| Field | Value |
|---|---|
| Provider | Supabase |
| Purpose | Serverless backend (Edge Functions), possibly authentication (OD-004) |
| Category | Infrastructure |
| Potential endpoint/API family | Edge Functions, Auth, project secrets — VBI |
| Credential required | Yes |
| Credential environment variable | `SUPABASE_URL`, `SUPABASE_ANON_KEY` (public client config), `SUPABASE_SERVICE_ROLE_KEY` (secret, backend only) |
| Free/development availability | VBI |
| Rate limit | VBI |
| Data sent | All provider requests in transit |
| Data received | Provider responses |
| Latency considerations | Function cold starts — measure in Phase 22 |
| Fallback | Equivalent serverless platform via ADR |
| Privacy considerations | Processing region, logging configuration (must not log bodies) |
| Production suitability | Chosen for V1 (ADR-012), pending verification |
| Verification status | VBI |
| Official documentation URL | https://supabase.com/docs |

## 28. Crash Reporting

Provider: OPEN DECISION OD-009 (e.g. Sentry). If Sentry is chosen, `SENTRY_DSN` is client configuration, and scrubbing is mandatory (`SECURITY.md`). VBI.

## 29. Provider Routing

```text
STT_PRIMARY           OD-001
STT_FALLBACK          OD-001
LLM_PRIMARY           OD-002
LLM_FALLBACK          OD-002
LITERATURE_PRIMARY    PubMed
LITERATURE_SECONDARY  Europe PMC
MEDICATION_STANDARD   RxNorm
MEDICATION_LABEL      DailyMed (fallback: openFDA label)
REGULATORY_SOURCE     openFDA / Drugs@FDA
PATIENT_EDUCATION     MedlinePlus
TRIALS                ClinicalTrials.gov
TERMINOLOGY           NLM Clinical Tables
```

Routing lives in backend configuration and can disable a provider without an app release.

## 30. Environment Variables

| Variable | Location | Secret |
|---|---|---|
| GEMINI_API_KEY | backend | yes |
| ASSEMBLYAI_API_KEY | backend | yes |
| DEEPGRAM_API_KEY | backend | yes |
| OPENAI_API_KEY | backend | yes |
| ANTHROPIC_API_KEY | backend | yes |
| NCBI_API_KEY | backend | yes |
| NCBI_EMAIL | backend | no |
| NCBI_TOOL_NAME | backend | no |
| OPENFDA_API_KEY | backend | yes (optional) |
| NCI_API_KEY | backend | yes (if required) |
| SUPABASE_SERVICE_ROLE_KEY | backend | yes |
| SUPABASE_URL | app + backend | no |
| SUPABASE_ANON_KEY | app | no (public by design) |
| SENTRY_DSN | app | no (if OD-009 selects Sentry) |

These must never contain real values in Git. `.env.example` lists names only.

## 31. Verification Log

| Provider | Date verified | Documentation consulted | Confirmed details | Verified by |
|---|---|---|---|---|
| (none) | — | — | No provider verified as of 2026-10-08 (documentation phase) | — |

Add one row per verification. Re-verify all providers in Phase 25.
