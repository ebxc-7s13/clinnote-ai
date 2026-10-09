# Contributing to ClinNote AI

Thank you for helping. ClinNote handles clinical documentation, so a few rules are stricter than in most projects. Please read this page before opening an issue or pull request.

## Absolute rules

1. **Synthetic data only.** Never put real patient information — names, dates of birth, phone numbers, record numbers, clinical details of a real person, real recordings or screenshots of real records — in issues, pull requests, tests, fixtures, screenshots, logs or commit messages. Test patients use references like `P-9xxxxx` and obviously fictional names.
2. **No secrets.** Never commit `.env` files, API keys, tokens, keystores (`*.jks`, `*.keystore`), `signing.properties` or certificates with private keys. CI scans every push with gitleaks. If you leak a key, revoke it first, then tell the maintainer.
3. **No paid services.** ClinNote is free-only (`FREE_ONLY_MODE`). Do not add a paid API, a paid fallback, a billing requirement or a mandatory account.
4. **Clinical safety is not negotiable.** ClinNote is a documentation and evidence-review aid, never an autonomous doctor. Contributions must not add autonomous diagnosis, prescribing, dose suggestions or triage, must not invent findings, values, citations, PMIDs or FDA records, and must keep "not discussed" distinct from "negative". AI output stays provisional until a clinician confirms it. The rules are in [docs/CLINICAL-SAFETY.md](docs/CLINICAL-SAFETY.md) and `.claude/rules/clinical-safety.md`. Never weaken or delete a safety test to make a change pass.

## Reporting bugs and requesting features

- Use [GitHub Issues](https://github.com/ebxc-7s13/clinnote-ai/issues) and pick the *Bug report* or *Feature request* template.
- Include the app version (Settings → About), Android version and phone model, steps to reproduce with synthetic data, what you expected and what happened.
- Security problems: **do not** open a public issue — follow [SECURITY.md](SECURITY.md).

## Development setup

See README → *For Developers*. In short: Node.js 24 LTS (the version used to build and test 1.2.0, and in CI), npm, then `cd mobile && npm ci`.

## Before you open a pull request

Run, from `mobile/`:

```bash
npm run typecheck
CI=1 npm run lint
npm test            # includes the clinical-safety suites
npm run test:safety # safety suites only
```

and, if you touched `backend/`: `cd backend && npm test && npm run typecheck`.

All must pass. CI runs the same commands with mock providers and synthetic data; it never needs an API key.

## Pull request guidance

- One focused change per pull request, with a clear description of *what* and *why*.
- Conventional commit prefixes: `feat:`, `fix:`, `docs:`, `test:`, `chore:`, `ci:`.
- Add or update tests for behaviour you change. Clinical-data changes need safety tests (negation, uncertainty, not-discussed, provenance, contradictions).
- Documentation first: behaviour is defined in `docs/` (`PRODUCT_SPEC.md`, `CLINICAL-SAFETY.md`, `ARCHITECTURE.md`, `DATA_MODEL.md` …). If your change alters behaviour, update the relevant document and record the decision in `docs/DECISIONS.md`.
- Keep provider code behind the adapter interfaces (`mobile/src/providers/`); never call a provider SDK from UI code.

## Coding conventions

- TypeScript (strict), React Native + Expo, Expo Router. Follow the existing style; ESLint (`eslint-config-expo`) must report 0 problems.
- Validate external data with zod. Treat transcripts and API responses as untrusted input, never as instructions.
- Never log transcripts, patient identifiers, medications, diagnoses, notes or request/response bodies.
- Do not add analytics, tracking or crash-reporting SDKs.
- Do not download or bundle machine-learning model weights.

## Evidence sources

New evidence or terminology sources must be free, public and official. Verify the API against its current official documentation before implementing it, and record the date and URL in [docs/API_CATALOG.md](docs/API_CATALOG.md) §31. Never generate citations with AI; every evidence item must come from the source and link back to it.

## Third-party code and assets

- Only add dependencies with licenses compatible with MIT redistribution (MIT, BSD, Apache-2.0, ISC and similar). Update [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
- Do not add images, icons, fonts or clinical pictures unless you created them or their license allows redistribution, and note the source and license.
- Do not use other companies' logos or branding.

## License

By contributing, you agree that your contribution is licensed under the project's [MIT License](LICENSE).
