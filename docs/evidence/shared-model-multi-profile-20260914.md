# Shared source model and atomic npm/CPAN builds

VO1216's first adapter milestone uses one compiler-metadata lowering function for scalar and native Binding IR. Lean export names remain in that model. The Perl projection applies its own namespace and snake-case naming rules. Callback type identities depend on semantic signatures, without including native boxing or C layout.

Native model version 2 records those changed semantic identities. Binding IR remains version 3, native ABI 1 and scalar ABI 2. Existing Perl calls and native ownership rules are unchanged. Package staging reconstructs the native model from its retained compiler report and rejects stale or substituted models.

## Combined build

```sh
lean-bridge build --project /path/to/library --target npm --target cpan --output /path/to/new-release
```

The builder passes the same captured Lake sources to both profiles, compiles each profile once and compares their source API identities. The comparison includes declaration identities, types, ownership, effects, export contracts, specializations and theorem references. Each profile separately retains source positions, compiler identities and full Binding IR hashes. The comparison adds no proof assurance claims.

The output contains both prepared package sets and `multi-profile-release.json`, which records their source/API identity, profile evidence and archive hashes. Output stays private until both profiles pass. Failure, cancellation, source drift and incompatible APIs prevent the final directory from appearing. Duplicate target aliases and unsupported mixed targets fail explicitly.

## Installed acceptance

`tests/multi-profile-project.test.mjs` passes all seven checks with real compiler execution enabled. Shop and Telemetry use unrelated namespaces and exports, distinct calculations, aliases, inferred signatures, custom source directories, and local and pinned Git dependencies. One uses a TOML Lake configuration; the other uses Lean configuration. Both attach export contracts and separate npm/CPAN package coordinates.

For each project, the original and relocated builds produce identical combined records and byte-identical npm/CPAN archives. The test counts one Wasm engine invocation and one native build per release. After both source directories move out of place, offline npm and prebuilt-only Perl installations execute the compiled functions and return the expected values. Separate tests reject changed source, toolchain, contract and IR identities, duplicate aliases and unsupported target sets. Injected native failure and cancellation remove the private profile outputs and leave the original source bytes, modes and timestamps unchanged.

The full native suite passes 34 checks, including the 183-assertion Workshop program and both prebuilt-only and XS-only installation paths. All 31 compiler-analysis and metadata checks pass. The npm suite passes 28 checks; its root-only permission skip passes separately as `nobody`. Shared-lowering tests check scalar/native API parity, independent Perl names, retained contracts and theorem references, forged metadata rejection and empty partial analysis.

| Reproduced artifact | SHA-256 |
| --- | --- |
| Native specialization CPAN archive | `678dd06745beab599636754b7aa214f4e661db90ce50b6f22febc3b2bd1f0eed` |
| Specialization npm archive | `81631844766ad3718e99116e80ff32e8b0bb99340aede0ed8ae8a5f152e0ba6c` |

## Validation and remaining work

Lint, checked JavaScript, 583 core checks, 64 documentation checks and all 16 generated reference pages pass. The core run skips 32 separately gated checks. Site tests, site type checking and the production build pass. Source allowlists include the new modules in the CLI archive and the affected Nix engines. The documentation API capture omits per-build elaboration hashes and source positions while retaining the source-bound API.

```sh
source scripts/env.sh
export LEAN_BRIDGE_TEST_PERL=/app/.toolchains/perl/5.38.2-threaded/bin/perl
export LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR=2.36
LEAN_BRIDGE_MULTI_PROFILE_TEST=1 node --test tests/multi-profile-project.test.mjs
LEAN_BRIDGE_PERL_NATIVE_TEST=1 node --test tests/perl-native.test.mjs
LEAN_BRIDGE_LAKE_WASM_TEST=1 node --test tests/unlocked-component.test.mjs
LEAN_BRIDGE_COMPILER_ANALYSIS_TEST=1 LEAN_BRIDGE_ELABORATED_METADATA_TEST=1 \
  node --test tests/compiler-analysis.test.mjs tests/elaborated-metadata.test.mjs
npm run lint
npm run typecheck
npm run test:contracts
npm run docs:reference
npm run types:check
npm run test:docs
npm run site:test
npm run site:typecheck
npm run site:build
```

Local execution uses Lean 4.32.2, Emscripten 6.0.6, Node 22.23.2 and Perl 5.38.2-threaded. The glibc override is test-only; production still requires 2.38. Local npm tests replace the unavailable Nix command transport but run the real compiler, linker and installed WebAssembly. The downstream CI workflow now runs the combined acceptance with its pinned Nix Wasm engine and a native host compiler. A fresh four-ABI production-floor matrix and pinned container execution remain CI checks.

The inventory remains at 6,562 cells, 2,193 observed cells, 116 installed-tested cells and 32,230 required stage gaps. This milestone does not extend the supported type families. Generic C/C++, managed and WIT/WASI adapters remain later slices of VO1216. No npm publication or Pages deployment occurs in this milestone.
