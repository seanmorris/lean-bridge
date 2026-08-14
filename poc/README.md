# Proof-of-concept fixtures

This directory contains executable fixtures used to test architecture claims against real toolchains. A fixture is deliberately small enough to inspect while retaining the runtime, linking, packaging, or measurement behavior under study.

## Fixture map

| Directory | What it demonstrates | Important inputs |
|---|---|---|
| [`lean-link-spike`](lean-link-spike/) | Real Lean components sharing a runtime, locked graph resolution, generated bindings, package manifests, initialization, callbacks, and lifecycle behavior. | `Alpha.lean`, `Beta.lean`, `Gamma.lean`, C shims, capsules, graph lock, Binding IR, and package plans. |
| [`link-spike`](link-spike/) | The smallest shared-runtime linker and loader experiment without the full Lean source pipeline. | Two C side modules, descriptors, a loader, and a native main program. |
| [`performance`](performance/) | Consumer-visible call, workload, lifecycle, memory, and component-scaling measurements. | Lean workloads, C shims, workload and methodology records, graph fixtures, and host runners. |
| [`php-native-runtime`](php-native-runtime/) | The Lean runtime probe compiled for the native PHP extension path. | `RuntimeProbe.lean`. |
| [`universal-package-fixture`](universal-package-fixture/README.md) | A package-neutral canonical input used to test multi-ecosystem archive generation. | Canonical manifest, provenance, assurance, and SPDX SBOM records. |

## Lean link spike

The Lean link spike is the primary integration fixture. Its three Lean libraries establish independent component identities and dependency edges. The C shims expose the narrow component boundary, while `runtime_lifecycle.cpp` exercises shared-runtime startup and shutdown.

The `capsules` directory and `graph-lock.json` describe the reviewed dependency graph. The `bindings` directory contains canonical Binding IR, generated projection records, package-gate output, and PHP transport plans. `descriptors.mjs` and `private-abi.mjs` model internal fixture wiring; public consumer examples should not import them.

Build scripts copy or compile this fixture into ignored output directories. Tests verify that source files remain unchanged.

## Link spike

The smaller link spike isolates loader and linker behavior from Lean compilation. `alpha.c` and `beta.c` provide independently built modules, `descriptors.mjs` describes their runtime relationship, and `loader.mjs` exercises load order. Use it when a failure concerns shared-runtime structure rather than Lean declaration analysis.

## Performance fixture

The performance fixture combines reviewable Lean workloads with versioned corpus, methodology, and workload records. `OrderedSearch.lean`, `SpatialIndex.lean`, and `SpatialConsumer.lean` supply the measured operations. C shims and host runners isolate direct boundary calls. The `scale` subdirectory generates larger component graphs for scaling observations.

Results belong under the [evidence index](../docs/evidence/README.md), not beside these sources. A fixture defines what to run; an evidence record states what a particular environment observed.

## Fixture ownership rules

- Keep hand-reviewed source, manifests, and protocol records in the fixture.
- Write compiled objects, archives, generated temporary projects, and measurements to ignored build or temporary directories.
- Do not turn fixture-private ABI helpers into public package examples.
- Put reusable validators and generators under [`../src`](../src/README.md).
- Put contributor and CI entrypoints under [`../scripts`](../scripts/README.md).
- Update tests and evidence when a fixture changes the behavior it demonstrates.

## Running fixtures

`npm run test:link-spike` builds and checks the minimal linker fixture. `npm run test:lean-link-spike` builds and checks the real Lean fixture. Performance and package commands are grouped in [`../package.json`](../package.json), with their implementation explained in [`../scripts`](../scripts/README.md). The full test suite prepares required fixtures before running the Node tests.
