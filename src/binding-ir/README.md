# Canonical Binding IR

The Binding IR is the semantic handoff between a verified source producer and every host-language backend. It records what a declaration means at the package boundary without embedding Lean syntax or host transport choices.

## Contract contents

A document identifies its schema version, producer, component, declarations, types, resources, capabilities, documentation, and assurance. Declaration records describe:

- stable names and source identities;
- parameters, results, methods, properties, and constructors;
- copied versus identity-bearing values;
- mutability, ownership, borrows, retention, and lifetimes;
- declared failures and result delivery;
- callbacks, iterators, asynchronous operations, and finite generic specializations;
- target requirements and capability gaps; and
- proof, assumption, trust, and provenance references.

The [JSON Schema](../../schema/binding-ir.schema.json) defines the machine-readable shape. Runtime validation applies semantic checks that JSON Schema alone cannot express.

## Module map

| Module | Responsibility |
|---|---|
| [`contract.mjs`](contract.mjs) | Validates document structure, cross-references, names, semantic combinations, and migration inputs. |
| [`canonical.mjs`](canonical.mjs) | Parses, canonicalizes, hashes, diagnoses versions, and runs supported migrations. |
| [`frontend.mjs`](frontend.mjs) | Creates a namespaced producer frontend so source-specific metadata cannot leak into the shared core. |
| [`semantic-parity.mjs`](semantic-parity.mjs) | Compiles the shared semantic corpus and compares language projections. |
| [`package-gate.mjs`](package-gate.mjs) | Generates selected packages, checks required files, and audits forbidden public surfaces. |
| [`sha256.mjs`](sha256.mjs) | Computes the text hash used by canonical identity helpers. |

## Identity and compatibility

Canonicalization removes irrelevant representation differences before hashing. The resulting hash identifies the exact semantic contract consumed by generators and packages. Version diagnostics distinguish a supported document, a migratable older document, and an incompatible version.

A migration may translate a known older representation. It cannot invent missing ownership, failure, or assurance semantics. Incomplete meaning remains an adapter question or validation failure.

## Authority boundary

Source frontends may populate namespaced producer metadata. Backends may choose idiomatic projections. Neither may override a core decision. A backend that cannot represent a required decision reports a capability gap and blocks support promotion.

## Change procedure

1. Update the schema and runtime validator together.
2. Add accepted and rejected fixtures for the new invariant.
3. Decide whether older documents need a deterministic migration.
4. Update each affected ABI compiler and backend.
5. Update semantic parity, package gate, and canonical hash tests.
6. Record the architecture consequence when the change affects interoperability or ownership.

Start with [`../../tests/binding-ir-contract.test.mjs`](../../tests/binding-ir-contract.test.mjs), [`../../tests/binding-semantic-parity.test.mjs`](../../tests/binding-semantic-parity.test.mjs), and [`../../tests/generated-package-gate.test.mjs`](../../tests/generated-package-gate.test.mjs). See the [Binding IR architecture](../../docs/architecture/binding-ir.md) for the accepted design.
