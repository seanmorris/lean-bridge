# Release pipeline

This directory projects one verified canonical bundle into deterministic ecosystem packages and release records.

## Responsibilities

- Canonical bundle and manifest modules verify component, Binding IR, graph, provenance, assurance, and target identities.
- Package modules create npm, PyPI, Cargo, C, C++, NuGet, Maven, RubyGems, PHP, and WASI layouts from reviewed inputs.
- Reproducibility and independent-verifier modules compare clean outputs before authorization.
- Publication modules enforce credential boundaries, preflight, durable transaction state, recovery, attestations, and receipts.

Release backends may arrange verified files and render registry metadata. They do not compile Lean, resolve another graph, or regenerate binding semantics.

See the [compile-once architecture decision](../../docs/architecture/adr/README.md#adr-22-compile-once-package-many-times), [universal bundle evidence](../../docs/evidence/universal-release-bundle.md), and [release receipt evidence](../../docs/evidence/release-receipt.md).
