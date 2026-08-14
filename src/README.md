# Source modules

`src` contains the JavaScript implementation used by the CLI, build pipeline, generators, release tooling, and tests.

## Directory map

| Directory | Responsibility |
|---|---|
| [`abi`](abi/README.md) | Host-neutral callback, error, value, ownership, iterator, and initialization contracts. |
| [`adoption`](adoption/README.md) | Consumer support, onboarding, usability, and measurement records. |
| [`analyze`](analyze/README.md) | Lean and Lake project inspection plus Binding IR proposals. |
| [`backends`](backends/README.md) | Language-specific source and package projections. |
| [`binding-ir`](binding-ir/README.md) | Canonical declaration semantics, validation, hashing, and parity checks. |
| [`build`](build/README.md) | Closed compilation requests, engines, manifests, and artifact audits. |
| [`capsule`](capsule/README.md) | Component graph nodes and compatibility contracts. |
| [`cli`](cli/README.md) | Command parsing, result formatting, and workflow dispatch. |
| [`performance`](performance/README.md) | Workloads, harnesses, reproducibility, lifecycle, and report assembly. |
| [`release`](release/README.md) | Canonical bundles, deterministic packages, authorization, transactions, and receipts. |
| [`runtime`](runtime/README.md) | Private host runtime coordination for callbacks, pending operations, and weak identity. |
| [`wasi`](wasi/README.md) | Native Wasmtime consumer host used by WIT/WASI acceptance. |

## Dependency direction

Analysis produces canonical Binding IR. Backends consume that IR. Build modules produce immutable component artifacts. Release modules combine those artifacts with generated projections without compiling Lean again. CLI and adoption modules coordinate these layers without redefining their contracts.

The [architecture index](../docs/architecture/README.md) owns design requirements. The [evidence index](../docs/evidence/README.md) owns executed results.
