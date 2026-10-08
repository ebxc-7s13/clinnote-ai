# Rule: Documentation Authority and Scope (always loaded)

- Authority order: CLAUDE.md → PRODUCT_SPEC → CLINICAL-SAFETY → ARCHITECTURE → DATA_MODEL → API_CATALOG → SECURITY → PRIVACY → BUILD_PLAN → TESTING → DEPLOYMENT → GOOGLE-PLAY → UI-UX → implementation. Restrictive safety/privacy/security requirements prevail over permissive statements elsewhere (ADR-018).
- Documentation first: if implementation conflicts with docs, review and update the docs (and `docs/DECISIONS.md`) before continuing. Never silently override.
- Before work: read CLAUDE.md, `docs/PROJECT-STATUS.md`, the task's specs and handoffs; check dependencies in `docs/AGENT-TASK-GRAPH.md`.
- Do not invent requirements, add out-of-scope features, silently remove features or silently change architecture.
- Verify external API details, model names, prices, limits and policies in current official documentation immediately before implementation; record date and URL in `docs/API_CATALOG.md` §31.
- No large model weights, PyTorch, CUDA or local inference servers (ADR-003). Cloud/API first.
- Update `docs/PROJECT-STATUS.md` and handoffs when work changes state.
