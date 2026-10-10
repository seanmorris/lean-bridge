# Source modules

`src` contains the reusable JavaScript implementation behind the CLI, generators, component build, package release, consumer checks, and performance evidence. Files under [`scripts`](../scripts/README.md) adapt these modules to shell and CI entrypoints.

## Architecture position

The source tree separates semantic authority from execution and packaging:

```text
Lean and Lake project
        |
        v
     analyze  ->  Binding IR  ->  language backends
        |                                |
        v                                v
  build request  ->  component artifacts and generated APIs
                                      |
                                      v
                          canonical release bundle
                                      |
                                      v
                         registry package projections
```

The Binding IR owns host-neutral declaration semantics. Build modules own compilation inputs and artifact identity. Backends render host APIs. Release modules package reviewed outputs without invoking the compiler. Runtime modules implement private host bookkeeping used by generated APIs.

## Directory map

| Directory | Responsibility | Primary consumers |
|---|---|---|
| [`abi`](abi/README.md) | Compiles callback, error, value, ownership, iterator, and initialization semantics into versioned adapter plans. | Binding generators and runtime adapters. |
| [`adoption`](adoption/README.md) | Validates onboarding, support, usability, and downstream measurement records. | Documentation tests and consumer CI. |
| [`analyze`](analyze/README.md) | Inspects Lean and Lake projects and proposes Binding IR. | CLI analysis and onboarding acceptance. |
| [`backends`](backends/README.md) | Renders language-specific APIs and reports projection gaps. | Package builders and generator tests. |
| [`binding-ir`](binding-ir/README.md) | Validates, canonicalizes, hashes, migrates, and compares declaration contracts. | Analysis, every backend, and package gates. |
| [`build`](build/README.md) | Creates closed compilation requests, executes engines, links side modules, and audits artifacts. | CLI build and Nix or Docker entrypoints. |
| [`capsule`](capsule/README.md) | Validates component graph nodes and resolves locked dependency order. | Runtime loaders and composition tests. |
| [`cli`](cli/README.md) | Parses commands, validates results, renders progress, and dispatches workflows. | `lean-bridge` and CLI tests. |
| [`performance`](performance/README.md) | Defines workloads, measurement harnesses, lifecycle probes, scaling runs, and evidence reports. | Performance scripts and CI. |
| [`release`](release/README.md) | Builds canonical bundles and deterministic ecosystem packages, then records authorization, transactions, and receipts. | Release rehearsal and downstream package tests. |
| [`runtime`](runtime/README.md) | Tracks callbacks, pending operations, and weak identities inside a host process. | Generated JavaScript and transport adapters. |
| [`wasi`](wasi/README.md) | Provides the independent native host used by WIT/WASI acceptance. | WASI package and consumer tests. |

## Dependency rules

- Analysis may produce Binding IR but does not compile or package a component.
- Backends consume Binding IR and adapter plans. They do not redefine canonical semantics.
- Build modules accept reviewed source and toolchain inputs. They do not choose registry layouts.
- Release modules accept verified artifacts and manifests. They do not invoke Lean or regenerate bindings.
- CLI and script entrypoints coordinate domain modules. Domain policy remains under `src`.
- Public packages do not expose `src/runtime` registries, raw ABI dispatch, pointers, or transport selection.

These rules keep a proof, generated API, component binary, and package receipt attached to the same semantic and artifact identities.

## Finding the right change point

| Change | Start here |
|---|---|
| Add a supported Lean declaration shape | [`analyze`](analyze/README.md), then [`binding-ir`](binding-ir/README.md) |
| Change ownership, error, callback, or async semantics | [`binding-ir`](binding-ir/README.md) and [`abi`](abi/README.md) |
| Add or revise a consumer language | [`backends`](backends/README.md), then [`release`](release/README.md) |
| Change compilation or linking | [`build`](build/README.md) |
| Change package identity or publication | [`release`](release/README.md) |
| Change runtime lifecycle behavior | [`runtime`](runtime/README.md) and the relevant ABI plan |
| Add a measured workload | [`performance`](performance/README.md) |
| Change user-facing commands or result formatting | [`cli`](cli/README.md) |

## Verification and design records

Tests mirror these domains under [`tests`](../tests/README.md). The [architecture index](../docs/architecture/README.md) owns design requirements. The [evidence index](../docs/evidence/README.md) owns executed commands, artifact identities, observations, and limitations. The [versioned support contract](../docs/consumer-support.v1.json) owns downstream support states.
