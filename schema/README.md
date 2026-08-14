# Versioned schemas

This directory contains closed JSON Schema contracts for analysis, build, component, package, release, acceptance, and performance records.

## Conventions

- Schema identifiers use project URNs.
- Versioned documents reject undeclared properties where a closed contract is required.
- Runtime validators under [`../src`](../src/README.md) implement the same field and invariant checks needed before execution.
- A schema change includes fixture and validator updates in the same commit.

Key entrypoints include the [Binding IR schema](binding-ir.schema.json), [canonical package manifest schema](canonical-package-manifest.schema.json), [consumer support schema](consumer-support.schema.json), [component artifact manifest schema](component-artifact-manifest.schema.json), and [release receipt schema](release-receipt.schema.json).

Architecture requirements remain in the [architecture index](../docs/architecture/README.md). Schema files define machine-readable shape, not current support status.
