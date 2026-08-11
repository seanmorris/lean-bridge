# Component-neutral release bundle evidence

## Result

The medium onboarding project now produces a component-neutral release bundle with manifest SHA-256 `5b8cf98c3ef8cb9271831f4853c2b06697340104126b6100a3db3bd868532806` and inventoried-file identity `08dac157d2e02858a1f623b6daba9bd0a8565e25cef2f821db9da15f85d8233e`.

The inventory contains 19 files before its own manifest:

| Role | Count |
| --- | ---: |
| Component Wasm | 1 |
| Source inputs | 4 |
| Plans and locks | 5 |
| Build evidence | 2 |
| Binding IR | 1 |
| Private ABI | 1 |
| Assurance metadata | 1 |
| Runtime requirement | 1 |
| Generated Lean source | 1 |
| Provenance | 1 |
| Documentation | 1 |

The bundle contains exactly one WebAssembly file, `onboarding-medium-48e5c7de2f9afdb3.so.wasm`. It contains no runtime binary and no npm, PyPI, Cargo, C, C++, PHP, or other target package. Package backends consume this bundle later without compiling the component again.

The runtime requirement records ABI 1, the exact Lean commit and patch set, the `side-lazy` profile, and imports for shared memory and the shared function table. Its `artifactIncluded` field is false. Package resolution can deduplicate this content-addressed peer across every component in the app.

Tests assemble bundles from two relocated source roots and compare every file byte for byte. Policy tests reject an embedded runtime, target-package output, or a component Wasm mislabeled as a runtime.

[`src/release/component-release-bundle.mjs`](../../src/release/component-release-bundle.mjs) contains no component name, package coordinate, or target backend rule. [`scripts/build-plain-component-side-module.mjs`](../../scripts/build-plain-component-side-module.mjs) now emits this bundle after compilation and structural audit.
