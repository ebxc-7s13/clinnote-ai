# ClinNote AI — API Catalog

## Purpose

This file defines the intended external-provider ecosystem.

Every provider must be verified against current official documentation before implementation.

Do not assume that an endpoint, model, pricing tier, rate limit, SDK, or feature remains unchanged.

## Verification Status

| Provider | Last verified | Status |
|---|---|---|
| AssemblyAI | not yet verified | VERIFY BEFORE IMPLEMENTATION |
| Deepgram | not yet verified | VERIFY BEFORE IMPLEMENTATION |
| OpenAI | not yet verified | VERIFY BEFORE IMPLEMENTATION |
| Google Gemini | not yet verified | VERIFY BEFORE IMPLEMENTATION |
| Anthropic | not yet verified | VERIFY BEFORE IMPLEMENTATION |
| NCBI E-utilities / PubMed | not yet verified | VERIFY BEFORE IMPLEMENTATION |
| Europe PMC | not yet verified | VERIFY BEFORE IMPLEMENTATION |
| openFDA | not yet verified | VERIFY BEFORE IMPLEMENTATION |
| Drugs@FDA | not yet verified | VERIFY BEFORE IMPLEMENTATION |
| FDA Orange Book | not yet verified | VERIFY BEFORE IMPLEMENTATION |
| DailyMed | not yet verified | VERIFY BEFORE IMPLEMENTATION |
| RxNorm | not yet verified | VERIFY BEFORE IMPLEMENTATION |
| MedlinePlus | not yet verified | VERIFY BEFORE IMPLEMENTATION |
| ClinicalTrials.gov | not yet verified | VERIFY BEFORE IMPLEMENTATION |
| NLM Clinical Tables | not yet verified | VERIFY BEFORE IMPLEMENTATION |
| PubChem | not yet verified | VERIFY BEFORE IMPLEMENTATION |
| WHO | not yet verified | VERIFY BEFORE IMPLEMENTATION |
| NCI | not yet verified | VERIFY BEFORE IMPLEMENTATION |
| Supabase | not yet verified | VERIFY BEFORE IMPLEMENTATION |

No provider was verified during the documentation phase (2026-10-08). Provider descriptions below state the **intended role** only; they are not guarantees of current capability. When a provider is verified, update its row with the date, the official documentation URL consulted, and a short list of what was confirmed.

## General Rule

Use APIs where practical.

Do not download large AI model weights.

The application should be able to function with cloud/API providers.

Private keys must remain server-side.

No API keys or accounts exist yet. Where a secret is listed below it is the environment-variable name the backend will use once the project owner creates the account; it is not an existing credential.

## Per-Provider Verification Checklist

Before implementing any provider, verify and record:

- current endpoint / SDK
- authentication mechanism
- rate limits and quota
- pricing / free allocation
- data retention and training-use terms
- suitability for health data (e.g. availability of a data-processing agreement / BAA where relevant to the target jurisdiction)
- terms of use, attribution and redistribution requirements
- supported languages (speech providers)

## 1. Speech Providers

Primary provider selection is OPEN DECISION OD-001.

### AssemblyAI

Potential role:

- streaming transcription
- speaker diarization
- conversation transcription

Server-side secret (future):

ASSEMBLYAI_API_KEY

Architecture:

SpeechProvider, DiarizationProvider

Verification required before implementation:

- current streaming endpoint
- current speaker-diarization behavior (including whether diarization is available in streaming or only in post-recording processing)
- current Android/client architecture (including short-lived client tokens)
- current pricing/free allocation
- current privacy/data-retention terms
- current supported languages

### Deepgram

Potential role:

- streaming speech-to-text
- diarization
- real-time transcription

Server-side secret (future):

DEEPGRAM_API_KEY

Architecture:

SpeechProvider, DiarizationProvider

VERIFY BEFORE IMPLEMENTATION (same checklist as AssemblyAI).

### OpenAI

Potential role:

- high-quality transcription (e.g. final-transcript pass)
- diarized transcription where the currently available model/API supports it

Server-side secret (future):

OPENAI_API_KEY

Do not assume model names are permanent.

VERIFY BEFORE IMPLEMENTATION against current official OpenAI documentation.

### Google Gemini

Potential role:

- transcription
- diarization
- multimodal processing where useful

Server-side secret (future):

GEMINI_API_KEY

VERIFY BEFORE IMPLEMENTATION: current supported transcription model and API.

## 2. LLM Providers

Primary model selection is OPEN DECISION OD-002.

### Gemini

Primary prototype candidate.

Use for:

- clinical information extraction
- structured JSON output
- note generation
- evidence synthesis
- visit comparison

Never expose the API key to the Android application.

Use structured output.

Server-side secret (future): `GEMINI_API_KEY`

### OpenAI

Fallback candidate (`LLM_FALLBACK`). Server-side secret (future): `OPENAI_API_KEY`.

### Anthropic (Claude)

Fallback candidate (`LLM_FALLBACK`). Server-side secret (future): `ANTHROPIC_API_KEY`.

All LLM providers: VERIFY BEFORE IMPLEMENTATION — current model identifiers, structured-output support, context limits, data-retention terms, pricing.

## 3. Literature

### NCBI E-utilities / PubMed

Purpose:

- literature search
- PubMed metadata
- publication retrieval

Provider:

NCBI

Configuration:

NCBI_API_KEY where applicable for elevated API usage (secret, future)

NCBI_EMAIL (configuration, not secret)

NCBI_TOOL_NAME (configuration, not secret)

VERIFY BEFORE IMPLEMENTATION: current usage requirements, rate limits with and without key.

### Europe PMC

Purpose:

- biomedical literature discovery
- open-access literature discovery
- literature cross-checking

VERIFY BEFORE IMPLEMENTATION.

## 4. FDA

### openFDA

Purpose:

- drug labeling
- adverse-event data
- enforcement
- NDC
- shortages
- Orange Book-related data where exposed
- Drugs@FDA-related data

Important:

Not all openFDA datasets are validated for clinical or production use.

Display source and metadata.

Do not treat openFDA as an autonomous clinical decision source.

VERIFY BEFORE IMPLEMENTATION: current endpoints/datasets, key requirement, rate limits, disclaimer text.

### Drugs@FDA

Purpose:

- regulatory drug information
- approval information
- application information

VERIFY BEFORE IMPLEMENTATION: current API/data-access mechanism (openFDA endpoint vs. downloadable data files).

### FDA Orange Book

Purpose:

- approved drug products
- therapeutic equivalence information

Do not confuse regulatory product information with patient-specific clinical advice.

VERIFY BEFORE IMPLEMENTATION: current access mechanism.

## 5. DailyMed

Purpose:

- current submitted drug labeling
- medication label sections
- warnings
- contraindications
- adverse reactions
- indications
- other label information

Use source attribution.

VERIFY BEFORE IMPLEMENTATION: current REST endpoints.

## 6. RxNorm

Purpose:

- medication normalization
- RxCUI
- standardized medication concepts

Use for normalization, not as a substitute for FDA labeling.

Architecture: MedicationProvider.

VERIFY BEFORE IMPLEMENTATION: current RxNav REST endpoints and terms of use.

Note: RxNorm covers medications marketed in the US. If OD-005 selects non-US jurisdictions, coverage of local brand names must be evaluated and a supplementary terminology source may be required.

## 7. MedlinePlus

Purpose:

- patient-friendly explanations
- disease information
- symptom information
- medication education

Architecture: HealthInformationProvider.

VERIFY BEFORE IMPLEMENTATION: current official web services/API documentation.

## 8. ClinicalTrials.gov

Purpose:

- clinical trial discovery
- recruitment status
- study information

Do not automatically recommend enrollment.

Architecture: ClinicalTrialProvider.

VERIFY BEFORE IMPLEMENTATION: current API version.

## 9. NLM Clinical Tables

Purpose:

- terminology search
- condition lookup
- coding support

Do not silently convert a phrase into a billing diagnosis.

VERIFY BEFORE IMPLEMENTATION.

## 10. PubChem

Purpose:

- chemical identity
- compound information
- molecular data

Do not use as a replacement for medication regulatory information.

VERIFY BEFORE IMPLEMENTATION: PUG-REST endpoints and usage policy.

## 11. WHO

Purpose:

- public-health information
- epidemiology
- population-level information

Do not use population-level statistics as direct patient-specific medical advice.

VERIFY BEFORE IMPLEMENTATION: which WHO resources expose a programmatic API (e.g. the Global Health Observatory) and their terms. WHO content without an API is linked, not scraped.

## 12. NCI

Purpose:

- cancer information
- cancer education
- clinical-trial resources

Do not convert NCI information into automatic cancer diagnosis.

VERIFY BEFORE IMPLEMENTATION: current NCI APIs and terms.

## 13. Search Engine Grounding

A general search engine may be used as a secondary discovery mechanism.

It must not replace:

- regulatory sources
- primary literature
- government medical information
- validated guidelines

Where possible, resolve search results back to the authoritative underlying source.

No search-engine provider is selected for V1. Adding one requires an ADR.

## 14. Reference Images

Architecture: ImageProvider.

Source selection is OPEN DECISION OD-008. No image provider is integrated until it is resolved.

## 15. Backend and Infrastructure

### Supabase

Role: Edge Functions as the serverless backend (ADR-010).

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are designed to be public client configuration. `SUPABASE_SERVICE_ROLE_KEY` is a private secret and must never reach the device.

### Crash reporting

Provider selection is OPEN DECISION OD-009. If Sentry is chosen, `SENTRY_DSN` is client configuration; crash payloads must be scrubbed of clinical content (`SECURITY.md`).

## 16. Provider Routing

Default architecture:

```text
STT_PRIMARY
STT_FALLBACK

LLM_PRIMARY
LLM_FALLBACK

LITERATURE_PRIMARY      (PubMed)
LITERATURE_SECONDARY    (Europe PMC)

MEDICATION_STANDARD     (RxNorm)
MEDICATION_LABEL        (DailyMed)

REGULATORY_SOURCE       (openFDA / Drugs@FDA)

PATIENT_EDUCATION       (MedlinePlus)

TRIALS                  (ClinicalTrials.gov)
```

Do not call every provider on every request.

Routing is configured server-side so a provider can be disabled without an app release (`DEPLOYMENT.md`, Rollback).

## 17. Environment Variables

Potential future variables:

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
| SUPABASE_SERVICE_ROLE_KEY | backend | yes |
| SUPABASE_URL | app + backend | no |
| SUPABASE_ANON_KEY | app | no (public by design) |
| SENTRY_DSN | app | no |

These must never contain real values in Git. A future `.env.example` lists names only.
