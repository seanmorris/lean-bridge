# Release pipeline

This directory turns one verified canonical bundle into deterministic ecosystem packages and durable release records. It is the compiler-free half of the compile-once workflow.

This Contributing guide owns release architecture, approval policy, and publisher integration. Use the [package publishing guides](../../docs/publishing.md) for artifact preparation, sandbox transactions, production verification, and recovery.

Standalone CLI archives use a reviewed source allowlist and can include a prepared runtime. The [CLI packaging checks](../../docs/contributing/testing.md#standalone-cli-package) verify tarball installations without a checkout or registry upload. The remaining release work is recorded in `docs/architecture/npm-release-plan.md`.

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
| [`pypi-package.mjs`](pypi-package.mjs), [`python-wheel-preflight.mjs`](python-wheel-preflight.mjs) | Python wheel and source package layout, plus the repository-free host compatibility preflight. |
| [`cargo-package.mjs`](cargo-package.mjs) | Rust crate layout. |
| [`c-family-package.mjs`](c-family-package.mjs) | C and C++ archives, headers, and metadata. |
| [`nuget-package.mjs`](nuget-package.mjs), [`maven-package.mjs`](maven-package.mjs), [`rubygems-package.mjs`](rubygems-package.mjs) | .NET, JVM, and Ruby registry layouts. |
| [`wasi-package.mjs`](wasi-package.mjs) | WIT, component, native host source, and WASI consumer metadata. |

PHP native and PHP-Wasm package builders live with the PHP backend because they share projection and transport conformance logic. They take PHP package manifests and compiler inputs, rather than the universal bundle's `--bundle` input. Neither PHP package is a target in the universal publication manifest. [Composer distribution](../../docs/publish/composer.md) covers native PHP; [npm publication](../../docs/publish/npm.md#publish-the-php-wasm-profile) covers PHP-Wasm.

### Reproducibility and independent confirmation

[`reproducibility.mjs`](reproducibility.mjs) compares complete file inventories. [`component-reproducibility-gate.mjs`](component-reproducibility-gate.mjs) and [`reproducibility-gate.mjs`](reproducibility-gate.mjs) require clean rebuilt outputs before release authorization. [`independent-verifier.mjs`](independent-verifier.mjs) prepares and checks a separate verification checkout, while [`independent-confirmation.mjs`](independent-confirmation.mjs) records its result.

### Publication and receipts

[`release-rehearsal.mjs`](release-rehearsal.mjs) installs package projections into clean local consumers before any registry action. [`release-candidate-state.mjs`](release-candidate-state.mjs) tracks candidate transitions. [`publish-manifest.mjs`](publish-manifest.mjs) fixes coordinates and destinations.

[`credentials.mjs`](credentials.mjs) keeps credentials outside package-generation code. [`publication-attestation.mjs`](publication-attestation.mjs) binds signer policy to the authorized statement. [`registry-transaction.mjs`](registry-transaction.mjs) records preflight, publication, and recovery state. [`archive-subjects.mjs`](archive-subjects.mjs) records each ecosystem, coordinate, filename, byte length, and hash. [`release-receipt.mjs`](release-receipt.mjs) signs the completed result and copies [`release-archive-verifier.mjs`](release-archive-verifier.mjs), the receipt, and the public policy beside every archive. The verifier requires a separately trusted policy hash and no repository checkout. [`component-package-receipt.mjs`](component-package-receipt.mjs) checks unsigned local dry-run packages.

The installed CLI includes the npm transaction adapter. Ordinary component publications use version-two `lean-bridge.cli.json` to select the registry, tag, access, authentication mode, and signer policy. The dry run binds those settings into the publication manifest. The author's explicit configuration authorizes that destination; these publications do not require the project's deployment-profile approvals or `LEAN_BRIDGE_NPM_PRODUCTION_OPT_IN`. Follow [ordinary component publishing](../../docs/publish/npm.md#publish-an-ordinary-component).

Universal version-one releases retain the project deployment-profile gate. Their installed adapter defaults to production mode and requires `LEAN_BRIDGE_NPM_PRODUCTION_OPT_IN=publish-to-production` before production writes. A universal local-registry rehearsal uses `LEAN_BRIDGE_NPM_REGISTRY_MODE=sandbox` and optionally `LEAN_BRIDGE_NPM_REGISTRY_URL`; sandbox mode defaults to `http://127.0.0.1:4873/` and rejects the production npm endpoint.

Both publication paths hash the authorized tarball before upload and verify the immutable registry tarball afterward.

Cargo, PyPI, NuGet, Maven, and RubyGems have publication-plan destinations but no installed transaction adapters. C, C++, and WIT/WASI use archive-retention targets without registry endpoints. The [ecosystem publishing guides](../../docs/publishing.md#choose-the-package-ecosystem) describe the package builders and operator-run upload flows. Those uploads do not produce a signed Lean Bridge completion receipt.

[Signed Nix publication](../../docs/publish/nix.md) distributes the flake's output closures through a binary cache. Nix signs store-path metadata and uses configured public keys to verify substitutes. It is a separate distribution flow, not a universal publication target or a Lean Bridge release receipt.

## Release invariants

- Package builders consume a verified canonical input and a fixed generated projection.
- The core artifact set remains byte-identical across ecosystem packages.
- Archive metadata is normalized before hashes are calculated.
- Clean-install rehearsal uses the package artifact, not repository-private imports.
- Publication requires a reproducibility result, authorization, destination identity, and credential boundary.
- A signed release receipt binds each published coordinate to the exact archive filename, byte length, and SHA-256.

These invariants make a registry package a projection of the reviewed bundle instead of an independent build product.

## Project release approval policy

This policy governs Lean Bridge's universal project releases. Ordinary component authors publish under their own registry and signing authority.

The [versioned deployment profile](../../config/production-deployment-profile.v1.json) owns the supported platform and version requirements. The checked-in profile has candidate status and no approvals, so universal project production publication is blocked.

The current profile requires the release owner, runtime owner, and security owner to review the exact profile revision, with evidence for:

- Green full CI.
- External reconstruction of the candidate.
- A human clean-room consumer run.
- An actual npm sandbox publication.
- Security and assurance review.

The responsible reviewers must inspect that evidence and record their decisions through the project's review process. The deployment evaluator checks profile state and approval records; it does not perform the external reviews. Editing `status` or inserting names does not supply approval.

The [production release procedure](../../docs/publish/production-release.md#inspect-the-approval-state) gives the approval-state check and the commands for candidate and receipt verification. Approval applies to the reviewed candidate and profile revision. Rebuilds or target changes require renewed review.

## Publisher signer integration

The installed CLI accepts ordinary component publication settings through version-two `lean-bridge.cli.json`: npm registry, tag, access, explicit token or OIDC authentication, a public signer-policy file, and an environment reference to an Ed25519 private-key file. `lean-bridge-signing-policy` creates a public policy from an existing public key. See [the author publishing recipe](../../docs/publish/npm.md#publish-an-ordinary-component).

`component-publication.mjs` reconstructs version-two authorization from the two-build report, complete artifact inventory, component receipt, license notices, and source identity. It uses the same signed transaction and receipt executor as universal version-one releases. Ordinary authors do not use this repository's production approval gate. Universal release integrations still supply the providers below.

A reviewed integration composes [`createCliHandlers`](../cli/commands.mjs) with these dependencies:

| Handler option | Integration responsibility |
|---|---|
| `registryAdapters` | Supply reviewed adapters for the manifest's registry targets. The installed adapter covers npm. |
| `deploymentProfileGate` | Preserve the production approval check before credential access. The factory defaults to no gate; the installed production handler supplies one. |
| `credentialProvider` | Make the required credential names available within their target-scoped boundary. The default provider reads the environment; npm requires `NPM_TOKEN`. |
| `attestationPolicy` | Supply the accepted public keys, signer identities, and signature algorithms through a trusted review process. |
| `attestationSigner` | Supply the provider that signs the publication statement and completed release receipt. |

The signer provider exposes `kind`, `keyId`, and `sign(bytes)`. Its `keyId` must match an accepted policy key. `sign(bytes)` returns a nonempty `Buffer` or `Uint8Array`, directly or asynchronously. The attestation implementation passes DSSE preauthentication bytes to the provider and verifies the returned signature against the accepted public key. Keep private keys outside release records and logs.

The handler verifies the manifest and candidate, checks the deployment profile when configured, and preflights required credential names before signing the publication statement. It verifies that signature before invoking the transaction publisher. The transaction preflights every target before its first write and accesses credentials through the scoped boundary. The handler uses the same policy and signer to create the completion receipt only after the transaction reports `complete`.

Follow [sandbox publisher configuration](../../docs/publish/sandbox-release.md#configure-the-publisher-integration) for endpoint isolation and registry settings. Universal production integrations also require the [project approval policy](#project-release-approval-policy) and the operator opt-in described in [production release](../../docs/publish/production-release.md#freeze-the-candidate-and-authority). Neither signer injection nor adapter availability supplies those approvals.

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

Run the [release-tooling checks](../../docs/contributing/testing.md#release-tooling-checks) when changing these modules. Fixture tests use injected registry clients; retain an actual sandbox publication record before production review.
