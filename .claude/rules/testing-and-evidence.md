# Rule: Testing and Evidence (always loaded)

Authoritative sources: `docs/TESTING.md`, `docs/QUALITY-GATES.md`.

- No feature is complete because it compiles. Critical behavior must be tested; clinical safety tests are mandatory.
- Never say "tests passed", "implemented", "works", "release ready" or "complete" without running the check. Record command, result, counts, failures, environment and UTC date.
- A teammate claim is not evidence. Evidence = file paths, diffs, command output, test counts, build output, synthetic API responses, commit hashes.
- CI uses mock providers. Flaky tests are reported as flaky.
- No false claims: never "FDA approved", "CDSCO approved", "CE certified", "clinically validated", "production ready" or "medically accurate" without documented evidence.
