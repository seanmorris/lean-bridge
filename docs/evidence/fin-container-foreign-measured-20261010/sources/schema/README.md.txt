# Versioned schemas

This directory contains the machine-readable JSON Schema contracts used at repository trust boundaries. The schemas cover project analysis, Binding IR, component build inputs and outputs, package generation, publication, acceptance, and performance evidence.

## Contract families

| Family | Representative schemas | Boundary protected |
|---|---|---|
| Analysis and configuration | [`project-analysis.schema.json`](project-analysis.schema.json), [`analysis-policy.schema.json`](analysis-policy.schema.json), [`bridge-config.schema.json`](bridge-config.schema.json), [`cli-result.schema.json`](cli-result.schema.json) | Lean project discovery, policy decisions, and process-independent CLI results. |
| Binding semantics | [`binding-ir.schema.json`](binding-ir.schema.json), [`compiler-adapter-plan.schema.json`](compiler-adapter-plan.schema.json) | Host-neutral declarations and the adapters compiled from them. |
| Component build | [`component-compilation-plan.schema.json`](component-compilation-plan.schema.json), [`engine-execution-request.schema.json`](engine-execution-request.schema.json), [`component-artifact-manifest.schema.json`](component-artifact-manifest.schema.json), [`side-module-audit.schema.json`](side-module-audit.schema.json) | Closed compiler inputs, engine identity, Wasm structure, and build outputs. |
| Capsules and packages | [`library-capsule.schema.json`](library-capsule.schema.json), [`library-graph-lock.schema.json`](library-graph-lock.schema.json), [`canonical-package-manifest.schema.json`](canonical-package-manifest.schema.json), [`component-release-bundle.schema.json`](component-release-bundle.schema.json) | Dependency graphs and the package-neutral artifact set. |
| Ecosystem packages | [`php-native-package.schema.json`](php-native-package.schema.json), [`php-wasm-package.schema.json`](php-wasm-package.schema.json), [`lean-target-c-manifest.schema.json`](lean-target-c-manifest.schema.json) | Target-specific layout and transport metadata. |
| Release control | [`publish-manifest.schema.json`](publish-manifest.schema.json), [`registry-transaction.schema.json`](registry-transaction.schema.json), [`publication-attestation.schema.json`](publication-attestation.schema.json), [`release-receipt.schema.json`](release-receipt.schema.json) | Authorization, destination, transaction state, and consumer verification. |
| Adoption and evidence | [`consumer-support.schema.json`](consumer-support.schema.json), [`onboarding-fixtures.schema.json`](onboarding-fixtures.schema.json), [`performance-result.schema.json`](performance-result.schema.json), [`performance-evidence-bundle.schema.json`](performance-evidence-bundle.schema.json) | Support claims, acceptance protocols, measurements, and evidence indexes. |

## Schema conventions

Schema identifiers use project URNs. They do not assume a web domain or network resolver. Versioned records include an explicit schema version or versioned identifier so a reader can select the correct validator.

Trust-boundary objects are closed with `additionalProperties: false` unless the contract explicitly defines an extension map. Required fields identify the minimum complete record. Hashes, target identifiers, status enums, and coordinate strings use constrained formats instead of unconstrained prose.

Runtime validators under [`../src`](../src/README.md) enforce semantic invariants that JSON Schema cannot express, such as hash agreement, graph acyclicity, legal state transitions, and cross-record identity. A schema-valid record can still fail semantic validation.

## Adding or changing a schema

1. Identify the producer, consumer, and trust boundary for the record.
2. Prefer a new explicit version when existing readers cannot interpret the change safely.
3. Keep the object closed and document extension points rather than accepting arbitrary fields.
4. Update the corresponding runtime validator and canonical serialization logic.
5. Add valid, missing-field, wrong-type, unknown-field, and semantic-mismatch tests.
6. Update committed fixtures and generated examples in the same change.
7. Run documentation and package tests that read the record.

Do not use a schema to claim that an implementation exists. The [consumer support contract](../docs/consumer-support.v1.json) records current support, and evidence pages record executed behavior.

## Validation ownership

Schemas define serializable shape. Domain modules own operational meaning: analysis under [`../src/analyze`](../src/analyze/README.md), build under [`../src/build`](../src/build/README.md), release under [`../src/release`](../src/release/README.md), and adoption under [`../src/adoption`](../src/adoption/README.md). Architecture requirements remain in the [architecture index](../docs/architecture/README.md).
