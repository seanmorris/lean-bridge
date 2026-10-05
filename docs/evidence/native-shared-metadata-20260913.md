# Native CPAN shared compiler metadata

VO1107 and VO1108 milestone, 2026-09-13.

## Implementation

Native CPAN now uses the same version-2 compiler report as public analysis and ordinary npm builds. Its `native-library-v1` projection keeps the existing primitive, copied-record, array, resource and callback representations. The report adds compiler-owned documentation, source ranges, elaborated binder names, theorem references and structured diagnostics to the native handoff. Public analysis still projects the ordinary scalar profile.

The native source identity binds the compiler and extractor bytes, configured export/resource selection, closure arities, source hashes and complete interfaces. Interface identity includes `.olean.private` and `.olean.server` sidecars. The engine rechecks these inputs around extraction, adapter compilation and linking. Compiler-generated C definitions and adapter prototypes must agree. CPAN staging verifies the report's identity and reconstructs the native model before generating its package files.

The version-1 native report emitter and primitive fallback projection are removed. npm target compilation requires the shared report when reproducing an elaborated API. Unsupported native helpers remain visible without blocking supported exports selected elsewhere in the module. Copied containers still reject retained resources and callbacks. Theorem relationships remain navigation metadata; no assurance claim or type/profile support is added.

## Validation

The native suite passes 14 checks on Perl 5.38.2-threaded, including the 183-check installed Workshop consumer. Both prebuilt-only and XS-only installation paths run, and the documented Perl example executes unchanged. Independent builds retain identical receipts.

The new compiler fixture resolves aliases, retains a Unicode documentation comment and its source range, distinguishes identically named theorems in separate namespaces, and produces identical native models after source relocation. Source files retain their bytes, modes and timestamps. A changed metadata report with recomputed file hashes still fails CPAN staging when it disagrees with the model.

Fault injection covers extractor execution failure, malformed JSON, a forged interface hash, changed source, changed server/private sidecars, a mismatched C ABI and cancellation. Every case rejects the output, avoids linking and removes its owned staging. Separate contract tests cover configured arities and resources, profile isolation, closed fields and empty assurance arrays.

The shared compiler suite passes 11 checks, including scalar extraction, unsupported binder diagnostics, source relocation and sidecar drift. Five compiler-analysis regressions pass, including a relocated CLI archive. Ten native metadata and rejection checks also pass as unprivileged `nobody`.

The npm suite passes 19 checks with real Lean and WebAssembly compilation, offline installation and reproducible publication dry runs. It covers an output directory inside the author project, with source capture staged outside that checkout. Both documentation APIs also match their captures through fresh public compiler analysis using the injected engine transport.

The locked native suite passes five checks covering relocated Shop and Telemetry packages, installed calls, dependency drift and foreign-implementation rejection.

All six generated native checks pass. Shop and Telemetry each reproduce their CPAN archives after relocation, both with generated Lean/C imports and with generated public entry modules. Installed consumers return 45 and 67 respectively after the source workspaces are detached.

The repository passes 544 core checks, 63 documentation checks, 111 site checks, lint and checked JavaScript. Compiler-gated and unprivileged checks run separately. All 16 reference pages regenerate, and the 79-page site passes its type check and production build.

### CI corrections

The preceding commit's Perl compatibility job bootstraps Lean without Emscripten. Its broad test-name filter also selected a source-drift check that completes WASM linking before changing the author checkout. The job failed with `emscripten-linker-unavailable` before it could observe the intended `lake-source-drift` rejection.

Running the combined test locally with `LEAN_BRIDGE_EMCC=/nonexistent-lean-only-linker` reproduces that failure. The tests now separate pre-link metadata rejection from post-link source drift. The Lean-only job selects dependency/API and metadata rejections; the complete npm job continues to run the post-link source-drift test.

All eight pre-link checks pass with the linker deliberately unavailable. The separate post-link source-drift check passes with the real Emscripten linker.

The Node and Docker installed-CLI jobs also expose an in-project output regression. A release under `<project>/build/` previously put its temporary source snapshot there too, violating the read-only snapshot guard. The host now stages compilation inputs in the system temporary directory, or the explicitly configured Docker staging root, while keeping atomic release promotion beside the destination. It cleans the external workspace if creating the release staging directory fails. The snapshot guard remains unchanged.

All three in-project/unwritable-output checks pass as `nobody`, including real WASM compilation and cleanup after an `EACCES` failure. Full Nix and Docker consumer reruns remain CI checks; local regressions exercise their shared host staging code through the injected transport.

The documentation-capture job reports drift when identical JSON objects arrive with different member order. Capture rendering and comparison now use canonical JSON; changed source hashes still produce a mismatch. A reordered-object regression and both fresh compiler captures pass without changing the documented APIs.

```sh
source scripts/env.sh
export LEAN_BRIDGE_TEST_PERL=/app/.toolchains/perl/5.38.2-threaded/bin/perl
export LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR=2.36
LEAN_BRIDGE_PERL_NATIVE_TEST=1 node --test tests/perl-native.test.mjs
LEAN_BRIDGE_ELABORATED_METADATA_TEST=1 node --test tests/elaborated-metadata.test.mjs
LEAN_BRIDGE_LAKE_WORKSPACE_TEST=1 node --test \
  --test-name-pattern='locked native builds' tests/lake-workspace.test.mjs
LEAN_BRIDGE_LAKE_GENERATED_PACKAGES_TEST=1 node --test \
  --test-name-pattern='generated native' tests/lake-generated-packages.test.mjs
LEAN_BRIDGE_LAKE_WASM_TEST=1 node --test tests/unlocked-component.test.mjs
LEAN_BRIDGE_EMCC=/nonexistent-lean-only-linker LEAN_BRIDGE_LAKE_WASM_TEST=1 \
  node --test --test-name-pattern='unlocked builds reject (new dependencies|target metadata)' \
  tests/unlocked-component.test.mjs
```

The local glibc override is test-only; the production floor remains 2.38. The historical four-ABI production-floor matrix is not rerun locally. The npm acceptance tests replace the Nix command transport while running the real engine, compiler and linker. Nix is unavailable locally; CI exercises the pinned backend.

## Remaining work

VO1107 and VO1108 remain open for finite specialization and remaining parity gates. This milestone does not publish npm packages, expand native ownership policies, or add generic cross-language adapters. Existing type-surface evidence hashes are refreshed after the native regression checks; no coverage cells are promoted.

Coverage remains at 6,562 cells, 2,193 observed cells, 116 installed-tested cells and 32,230 required stage gaps.
