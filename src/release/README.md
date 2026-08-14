# Release pipeline

This directory turns one verified canonical bundle into deterministic ecosystem packages and durable release records. It is the compiler-free half of the compile-once workflow.

## Architecture position

```text
audited component + Binding IR + generated projections
                         |
                         v
              canonical package manifest
                         |
                         v
              universal release bundle
                         |
             +-----------+-----------+
             |           |           |
            npm        Cargo       other registries
             |           |           |
             +-----------+-----------+
                         |
                         v
       rehearsal, authorization, publication, receipt
```

Release code may arrange reviewed files, render registry metadata, and create deterministic archives. It does not compile Lean, resolve a different capsule graph, or regenerate binding semantics. [`../build`](../build/README.md) owns compilation, while [`../backends`](../backends/README.md) owns language projections.

## Module groups

### Canonical inputs and artifact identity

[`canonical-package-manifest.mjs`](canonical-package-manifest.mjs) validates and hashes the manifest that joins component, Binding IR, graph, runtime, provenance, assurance, and target identities. [`canonical-bundle-input.mjs`](canonical-bundle-input.mjs) reads that input through a verified boundary. [`core-artifact-set.mjs`](core-artifact-set.mjs) identifies files that package projections may copy but not change.

The canonical input boundary requires the manifest file to equal its canonical newline-terminated serialization byte for byte. Its adjacent SHA-256 inventory therefore works with ordinary file hashing and rejects extra whitespace.

[`component-release-bundle.mjs`](component-release-bundle.mjs) builds the component-level bundle. [`universal-release-bundle.mjs`](universal-release-bundle.mjs) assembles the complete package-neutral file set used by ecosystem builders.

### Deterministic archive construction

[`deterministic-archive.mjs`](deterministic-archive.mjs) and [`deterministic-zip.mjs`](deterministic-zip.mjs) normalize entry order, paths, modes, and timestamps. [`install-trace.mjs`](install-trace.mjs) records what a clean package installation selected. [`backend-policy.mjs`](backend-policy.mjs) verifies that an ecosystem package uses an authorized generated backend.

### Ecosystem projections

| Modules | Output family |
|---|---|
| [`npm-package.mjs`](npm-package.mjs), [`component-npm-package.mjs`](component-npm-package.mjs) | JavaScript runtime and component archives. |
| [`pypi-package.mjs`](pypi-package.mjs) | Python wheel and source package layout. |
| [`cargo-package.mjs`](cargo-package.mjs) | Rust crate layout. |
| [`c-family-package.mjs`](c-family-package.mjs) | C and C++ archives, headers, and metadata. |
| [`nuget-package.mjs`](nuget-package.mjs), [`maven-package.mjs`](maven-package.mjs), [`rubygems-package.mjs`](rubygems-package.mjs) | .NET, JVM, and Ruby registry layouts. |
| [`wasi-package.mjs`](wasi-package.mjs) | WIT, component, native host source, and WASI consumer metadata. |

PHP native and PHP-Wasm package builders live with the PHP backend because they share projection and transport conformance logic. They consume the same canonical bundle boundary.

### Reproducibility and independent confirmation

[`reproducibility.mjs`](reproducibility.mjs) compares complete file inventories. [`component-reproducibility-gate.mjs`](component-reproducibility-gate.mjs) and [`reproducibility-gate.mjs`](reproducibility-gate.mjs) require clean rebuilt outputs before release authorization. [`independent-verifier.mjs`](independent-verifier.mjs) prepares and checks a separate verification checkout, while [`independent-confirmation.mjs`](independent-confirmation.mjs) records its result.

### Publication and receipts

[`release-rehearsal.mjs`](release-rehearsal.mjs) installs package projections into clean local consumers before any registry action. [`release-candidate-state.mjs`](release-candidate-state.mjs) tracks candidate transitions. [`publish-manifest.mjs`](publish-manifest.mjs) fixes coordinates and destinations.

[`credentials.mjs`](credentials.mjs) keeps credentials outside package-generation code. [`publication-attestation.mjs`](publication-attestation.mjs) binds signer policy to the authorized statement. [`registry-transaction.mjs`](registry-transaction.mjs) records preflight, publication, and recovery state. [`release-receipt.mjs`](release-receipt.mjs) and [`component-package-receipt.mjs`](component-package-receipt.mjs) let consumers verify the installed artifact against the reviewed release. Component package output includes a standalone verifier beside its receipt and archives.

## Release invariants

- Package builders consume a verified canonical input and a fixed generated projection.
- The core artifact set remains byte-identical across ecosystem packages.
- Archive metadata is normalized before hashes are calculated.
- Clean-install rehearsal uses the package artifact, not repository-private imports.
- Publication requires a reproducibility result, authorization, destination identity, and credential boundary.
- A receipt binds the published coordinate to package and component identities.

These invariants make a registry package a projection of the reviewed bundle instead of an independent build product.

## Adding an ecosystem package

1. Define the package layout and canonical coordinate mapping.
2. Reuse shared deterministic archive and managed-package helpers where applicable.
3. Copy only files permitted by the canonical input and core artifact set.
4. Add a clean consumer that installs the produced archive with ordinary ecosystem tooling.
5. Verify the generated public API and component receipt from that clean consumer.
6. Add byte-for-byte rebuild, install trace, and release rehearsal coverage.
7. Update the downstream support record only when the observed consumer capability changes.

Package scaffolding alone does not establish runtime support. The [consumer support contract](../../docs/consumer-support.v1.json) records whether each clean consumer executes a real Lean component.

## Verification and evidence

Release tests under [`../../tests`](../../tests/README.md) cover every package builder, canonical manifests, deterministic outputs, release state, credential isolation, independent confirmation, transactions, and receipts. The [compile-once architecture decision](../../docs/architecture/adr/README.md#adr-22-compile-once-package-many-times), [universal bundle evidence](../../docs/evidence/universal-release-bundle.md), [release rehearsal evidence](../../docs/evidence/release-rehearsal.md), and [release receipt evidence](../../docs/evidence/release-receipt.md) provide the design and executed records.
