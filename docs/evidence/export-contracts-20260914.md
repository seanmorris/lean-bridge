# Checked author export contracts

VO1238 milestone, 2026-09-14.

## Implementation

Shared `lean-bridge.exports.json` now accepts optional `contracts` keyed by exact export or specialization name. Each contract declares parameter/result ownership and lifetime, a refinement policy, boundary effects, or a combination of those decisions. Supplied parameter decisions cover the complete runtime signature after specialization and configured closure arity.

The schema and validator close the vocabulary and reject unknown fields, invalid lifetimes, duplicate effects and conflicting export selections. Compiler requests sort contract names and effect sets before hashing. Missing contracts preserve the existing adapter rules.

Lean checks each contract against the freshly elaborated scalar or native projection. Metadata validation repeats that check. Public analysis compares the request with captured source intent; target compilation reproduces the report before linking. Native package staging reconstructs the model from the retained report. Binding IR records author decisions under `lean-lang.org/export-contract` without adding assurance claims.

The implemented rules remain copied values, native call-scoped resource/callback borrowing, explicit returned leases, and synchronous callback effects. Checked refinement constructors, transferred ownership, anchored borrowing, retained host callbacks and async adapters remain unsupported. A contract cannot authorize those implementations, erase a refinement, or supply a runtime type. Boundary-effect labels describe the adapter protocol, not allocation inside Lean or a proof about arbitrary function bodies.

## Installed and rejection checks

The native specialization fixture now attaches contracts to copied arrays and records, resources, returned closures and callback calls. Two relocated read-only builds produce identical archives. After both source paths move out of place, `prebuilt-only` and `build-xs` installations each pass 19 Perl assertions. Those checks preserve copied values, canonical resource/closure identity, explicit closure arity and the original host exception.

CPAN staging rejects a changed compiler application. It also rejects a substituted callback-effect contract after the test recomputes the invocation, metadata, model, receipt and file hashes. Eight additional compiler cases reject copied resources, borrowed results, transfers, retained callbacks, missing callback effects, wrong closure arity, checked constructors and unknown contract names. They fail before linking, preserve the source bytes, modes and timestamps, and leave no release or staging output. All nine checks in that rejection group also pass as unprivileged `nobody`.

The complete native suite passes all 34 checks, including the existing 183-assertion Workshop consumer, configured-source installation, metadata drift, C ABI checks and installer failure cases.

The npm specialization fixture attaches contracts to ordinary and specialized exports. It reproduces identical archives across relocated builds, installs them offline, executes compiled WebAssembly, checks concrete TypeScript declarations and completes a clean-clone publication dry run without registry writes. Four invalid contract cases fail before target compilation. The complete npm suite passes 28 checks with one root-only permission skip; that permission check and the four rejection cases pass separately as `nobody` (six checks including the parent group).

All 31 public compiler-analysis and metadata checks pass, including generated public entries, source-intent substitution, relocation, unsupported `Fin`/effect signatures, unused contracts, sidecar drift and cancellation cleanup. The contract implementation does not change existing type/profile claims.

| Reproduced artifact | SHA-256 |
| --- | --- |
| Contracted native specialization CPAN archive | `ab2151dc93bfd358986715efc6c6728980fe105d4811cfb9ae86496c83804c0b` |
| Contracted specialization npm archive | `911d65e81187435e57bbcf3eb9e1ab86083e48aeeb8bb2e6951f970e4b218c8e` |
| Lean metadata extractor | `85389b600e40db0abb1d5c34666b92a9054bf973c0403c2e68eefcd9189c93ce` |
| Shared configuration validator | `e3ba90af54a5894554311774b5e99d7e7ec00f93ec7cd4e5bd6647149515c21c` |

## Repository checks

Lint, checked JavaScript, 574 core checks and 64 documentation checks pass. The core run skips 30 separately gated checks. All 111 site checks pass, all 16 reference pages regenerate, and the 79-page site passes type checking and its production build.

```sh
source scripts/env.sh
lean src/analyze/NativeExports.lean
export LEAN_BRIDGE_TEST_PERL=/app/.toolchains/perl/5.38.2-threaded/bin/perl
export LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR=2.36
LEAN_BRIDGE_PERL_NATIVE_TEST=1 node --test tests/perl-native.test.mjs
LEAN_BRIDGE_LAKE_WASM_TEST=1 node --test tests/unlocked-component.test.mjs
LEAN_BRIDGE_COMPILER_ANALYSIS_TEST=1 LEAN_BRIDGE_ELABORATED_METADATA_TEST=1 \
  node --test tests/compiler-analysis.test.mjs tests/elaborated-metadata.test.mjs
npm run lint
npm run typecheck
npm run test:contracts
npm run test:docs
npm run types:check
npm run docs:reference
npm run site:test
npm run site:typecheck
npm run site:build
```

Local tests use Lean 4.32.2, Emscripten 6.0.6, Node 22.23.2 and Perl 5.38.2-threaded. The glibc override is test-only; the production minimum remains 2.38. npm tests substitute the unavailable Nix command transport while executing the real compiler, linker and installed WebAssembly. Static engine/package source-closure checks pass. The separate `test:builder-ownership` container check cannot start here: the Docker daemon rejects its `/app/build/...` bind mount because that path is not present on the daemon's host. No ownership assertion ran in that attempt. Pinned container execution and all four Perl ABI configurations remain CI acceptance checks.

The refreshed type inventory retains 6,562 cells, 2,193 observed cells, 116 installed-tested cells and 32,230 required stage gaps. Runtime type-family work remains under VO1216 and VO1220 through VO1223. This milestone performs no npm publication or Pages deployment.
