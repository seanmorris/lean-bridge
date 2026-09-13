# Compiler-owned npm builds without a Lake lockfile

VO1107 and VO1108 milestone, 2026-09-13.

## Implementation

Ordinary `lean-bridge build --target npm` projects without supplied Binding IR now use source-only execution request version 2, whether or not `lake-manifest.json` exists. The host supplies captured files and public-module intent. The engine resolves Lake ownership, compiles fresh interfaces, extracts structural types, and constructs the Binding IR and adapters. Target compilation must reproduce the complete elaboration record before linking.

Dependency-free projects use complete snapshot version 3, which records the absence of a lockfile. External dependencies and configured generators still require a reviewed lock. The build rechecks the source after compilation. Publication captures the same source for two clean clones and verifies it again before authorizing a handoff. Neither path fabricates a lockfile or writes compiled interfaces into the author project.

Explicit module selections can locate custom source directories without a lockfile. Selection checks path-component suffixes and rejects ambiguous names; Lake must then confirm the exact file and root ownership. The older internal scanner keeps its existing selection behavior. Explicit reviewed Binding IR retains its validation and adapter eligibility gates, without acquiring fresh compiler evidence.

The npm tutorial and scalar references now use source-bound compiler API captures rather than source-scanner output. Reference generation verifies their input hashes, and the compiler acceptance suite compares them with the Binding IR in real build bundles. `node scripts/capture-reference-apis.mjs` checks both captures through public compiler-backed analysis; `--write` refreshes them for review. The captures omit the artifact-specific elaboration hash and contain no assurance claims. Reference rendering removes trailing whitespace from declaration comments.

The tutorial and installed-CLI acceptance runners require compiler-derived build plans and empty assurance claims. Compiler-extracted theorem references remain in `metadata/lake-entry-exports.json` and Binding IR source extensions. This milestone adds no theorem audit or runtime type support.

## Validation

All 16 checks in `tests/unlocked-component.test.mjs` pass with real Lean and WebAssembly compilation:

- Tutorial, custom-layout and 19-function scalar packages reproduce after relocation and install from offline npm archives.
- Both documented APIs match the compiler captures. The custom-layout case resolves aliases, notation and inferred results while ignoring stale author interfaces.
- A publication dry run rebuilds two committed clones and verifies the publication manifest and local receipt without registry writes.
- Missing dependency locks, configured generators without locks, unsupported configuration and targets, implicit and polymorphic binders, effects, admitted implementations, and compiler errors fail without a scanner fallback.
- Changed target metadata cannot reach linking. A lockfile appearing during the build prevents output promotion.
- Source files, modes, timestamps, caches and Git metadata remain unchanged in the successful source-preservation checks. Owned staging is removed after success and rejection.

Two selected checks also pass as `nobody`, including the custom-layout offline installation. Five compiler-analysis regressions pass, covering a new dependency-free project, two locked custom-layout dependency trees, rejected unlocked dependencies, and a relocated CLI package. Four locked npm checks pass, including both relocated package installations, successful publication reproduction, and dependency-drift rejection. Five native Perl checks pass, including installed relocation and foreign-implementation rejection. The local native tests use a glibc 2.36 test override; the production floor remains 2.38.

The backend and release-gate suite passes 10 checks. Build-plan, engine-request and locked-input checks pass 17 checks; module-selection and configuration checks pass 20. The repository passes 539 core checks, 62 documentation checks, 111 site checks, lint and checked JavaScript. The core profile skips 19 compiler-gated checks; compiler suites run separately. The 16 generated references, 79-page site type check and production site build pass.

```sh
source scripts/env.sh
LEAN_BRIDGE_LAKE_WASM_TEST=1 node --test tests/unlocked-component.test.mjs
LEAN_BRIDGE_LAKE_WASM_TEST=1 node --test \
  --test-name-pattern='locked .* dependencies with default|locked release dry run' \
  tests/lake-wasm.test.mjs
LEAN_BRIDGE_COMPILER_ANALYSIS_TEST=1 node --test \
  --test-name-pattern='real compiler analyzes a new|real compiler analysis preserves|real Lake rejects|relocated CLI' \
  tests/compiler-analysis.test.mjs
npm run test:contracts
npm run test:docs
npm run docs:reference
npm run lint
npm run typecheck
```

Local tests substitute the Nix command transport while executing the real engine, Lean compiler, linker, package assembler and receipt checks. Nix is unavailable locally. Consumer CI runs the new suite against the pinned Nix engine and checks the API-capture script through public analysis. The Lean-only CI job runs the new rejection and drift tests. No npm package is published by this milestone.

## Remaining work

VO1107 and VO1108 remain open for shared native projection and finite specialization. Internal fixture tooling still contains the source scanner; it does not authorize ordinary CLI npm builds. Generic cross-language adapters and the complete installed type corpus remain separate work.

Three existing source-evidence hashes are refreshed after regression checks. Coverage remains at 6,562 cells, 2,193 observed cells, 116 installed-tested cells and 32,230 required stage gaps.
