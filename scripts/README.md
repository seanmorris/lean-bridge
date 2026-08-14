# Repository scripts

This directory contains executable adapters for contributors, Nix derivations, containers, and CI. Scripts translate command-line arguments and environment paths into calls to reusable modules under [`../src`](../src/README.md).

## Boundary with source modules

A script may parse process-specific arguments, locate an input selected by an npm or Nix command, and write user-requested output. Validation, generation, lifecycle rules, support evaluation, and release policy belong in `src` so tests and other entrypoints can call them directly.

```text
npm, Nix, container, or CI command
                  |
                  v
             script adapter
                  |
                  v
        reusable src domain module
                  |
                  v
       artifact, report, or process result
```

Prefer the npm commands in [`../package.json`](../package.json) over invoking a helper directly. Package scripts supply the expected build order, output path, runtime flags, and toolchain environment.

## Script groups

### Build and compilation

`build-*` and `compile-*` prepare pinned Lean runtimes, component side modules, native FFI artifacts, ecosystem archives, and the universal release bundle. Shell scripts coordinate external compiler commands. JavaScript scripts validate plans and call the build or release modules.

[`build-lean-runtime.sh`](build-lean-runtime.sh) and [`build-lean-link-spike.sh`](build-lean-link-spike.sh) exercise the pinned Wasm runtime path. [`compile-plain-component-target-c.mjs`](compile-plain-component-target-c.mjs) and [`build-plain-component-side-module.mjs`](build-plain-component-side-module.mjs) expose the canonical component stages used by clean project acceptance.

### Checks and verification

`check-*`, `compare-*`, and `verify-*` validate methodology, source closure, artifact inventories, release authorization, receipts, PHP transport parity, and cross-root reproducibility. They should exit nonzero when the named contract fails and retain enough diagnostics to identify the mismatched stage or file.

[`verify-component-package-receipt.mjs`](verify-component-package-receipt.mjs) is a standalone consumer verifier. The component npm builder copies it beside the receipt and archives, so a clean consumer needs Node but does not need the repository or an installed CLI.

### Clean consumer tests

`test-*` scripts install produced archives into temporary consumer projects and call their generated APIs. [`consumer-ci.mjs`](consumer-ci.mjs) coordinates every downstream target, compares the observation with the versioned support state, and writes the GitHub job summary. Package construction without a real Lean call remains distinguishable from runtime execution.

### Performance evidence

`benchmark-*`, `collect-*`, and `performance-*` scripts build the reviewed workloads, execute environment-tagged samples, and assemble reports. [`performance-ci.mjs`](performance-ci.mjs) coordinates the complete measurement run. Results preserve raw observations, runtime and package identities, and limitations so summaries do not merge unlike operations or environments.

### Generation

`generate-*` scripts render reviewed projections and fixtures from canonical inputs. [`binding-ir.mjs`](binding-ir.mjs), [`binding-package-gate.mjs`](binding-package-gate.mjs), and [`binding-semantic-parity.mjs`](binding-semantic-parity.mjs) inspect and compare Binding IR contracts. Generated output is written to the caller-selected build or fixture location.

### Environment bootstrap

[`bootstrap-toolchains.sh`](bootstrap-toolchains.sh), [`env.sh`](env.sh), [`inventory.sh`](inventory.sh), and [`lean-runtime-config.sh`](lean-runtime-config.sh) locate or report the pinned toolchain environment. They do not download unreviewed compiler inputs during an artifact build.

## Primary entrypoints

[`lean-bridge.mjs`](lean-bridge.mjs) is the executable local CLI installed by the package. It delegates command parsing and execution to [`../src/cli`](../src/cli/README.md).

[`consumer-ci.mjs`](consumer-ci.mjs) runs or verifies all declared downstream consumer checks and emits a row for every target. [`performance-ci.mjs`](performance-ci.mjs) assembles measured evidence. [`rehearse-release.mjs`](rehearse-release.mjs) builds and installs package projections without contacting a live registry.

## Process and output rules

- Resolve caller paths before entering a temporary working directory.
- Write artifacts only to the declared output or a fresh temporary directory.
- Leave reviewed fixture sources unchanged.
- Preserve subprocess output that explains a toolchain failure.
- Normalize a successful result through the owning domain contract.
- Keep credentials out of build, generation, and rehearsal scripts.
- Use explicit runtime profiles and toolchain paths instead of ambient defaults.

## Adding a script

First decide whether the behavior belongs in an existing domain module. Keep the new script as a thin adapter around that module. Add an npm command when contributors or CI should invoke it directly, document required arguments in `--help` or the owning guide, and test both success and failure process results. If it creates evidence, record environment and artifact identity in the produced report.

Tests live under [`../tests`](../tests/README.md). Architecture records define trust and reproducibility requirements under the [architecture index](../docs/architecture/README.md).
