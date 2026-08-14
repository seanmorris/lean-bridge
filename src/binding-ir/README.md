# Canonical Binding IR

This directory owns the language-neutral declaration contract used by every backend.

## Modules

- [`contract.mjs`](contract.mjs) validates declarations, types, ownership, failures, delivery, documentation, and assurance records.
- [`canonical.mjs`](canonical.mjs) normalizes accepted documents for stable comparison.
- [`frontend.mjs`](frontend.mjs) validates producer-specific extensions without moving them into the shared core.
- [`semantic-parity.mjs`](semantic-parity.mjs) compares backend projections against one semantic corpus.
- [`package-gate.mjs`](package-gate.mjs) rejects missing generated files and forbidden public surfaces.
- [`sha256.mjs`](sha256.mjs) computes canonical document identity.

Producer analysis may populate the IR. Backends may consume it. Neither layer may override its semantic decisions.

See the [Binding IR architecture](../../docs/architecture/binding-ir.md) and [generated package gate evidence](../../docs/evidence/generated-package-gate.md).
