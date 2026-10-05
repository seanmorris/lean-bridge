# Compiler-backed finite specialization

VO1107, VO1108 and VO1238 milestone, 2026-09-14.

## Implementation

Authors can configure concrete exports of generic Lean functions in `lean-bridge.exports.json`. Public analysis and ordinary npm builds accept up to 128 named specializations, each binding one to eight leading type parameters to closed Lean type constants. Lean resolves aliases, universe levels and immediately following instance dictionaries. The resulting arguments and return value must fit the existing scalar npm profile.

Each concrete export carries its original declaration, configured types and compiler application through the shared metadata report, Binding IR and generated adapter. Source locations, documentation and theorem references retain their original provenance. Source scanning cannot authorize a specialization. Target compilation must reproduce the report before linking, and release packaging verifies the configured source identity.

Lean serializes applications with absolute constant names, re-elaborates the serialized expression and checks definitional equality to the original application. Ordinary generated calls and primitive types also use absolute names. The extractor restores only Lean's built-in class and instance indexes from imported metadata; it does not enable package initializers. Implementation checks cover every constant used by the application, including synthesized dictionaries.

The metadata keeps unsupported selections visible with diagnostics. Missing instances, incomplete type applications, unsupported effects or containers, unsafe implementations and admitted definitions reject the selected API. Private or unrepresentable dictionary expressions require an explicit monomorphic wrapper. Native CPAN continues to reject configured specializations rather than ignoring them.

## Validation

All 14 compiler-metadata tests pass. The specialization fixture covers aliases, two type parameters, universe inference, custom instances, documentation and theorem provenance, automatic and explicit selection, relocation and a package-initializer sentinel. Nine invalid applications receive unsupported diagnostics. Forged selection, source provenance and application metadata are rejected. Existing namespace, notation, interface-sidecar and extractor-failure checks remain green.

Six selected public-analysis checks pass, including real compiler analysis of a generic addition function, request/configuration identity, report tampering, relocated source, locked custom-layout packages and an installed CLI archive.

The complete ordinary npm suite passes 23 checks; its root-only permission skip runs separately as unprivileged `nobody`. The finite specialization fixture builds twice in relocated roots, produces identical archives, verifies receipts, installs offline and executes the compiled WebAssembly. It checks UInt32 bounds, Unicode strings, a 101-bit Nat, two type parameters, a custom instance, ordinary exports and invalid host inputs. Generated TypeScript declarations expose concrete types without host type parameters or `any`. A publication dry run rebuilds clean clones and verifies the publication manifest without registry writes. Source bytes, permissions and timestamps remain unchanged.

An adversarial fixture reproduced a namespace-resolution bug before the fix: a shadow declaration in the generated namespace changed the custom-instance result from 37 to 9. The installed regression now returns 37 and checks a separate ordinary call and a shadowed primitive type. Lean's absolute-name serializer and generated ordinary-call qualification prevent those substitutions.

The reproduced specialization component archive has SHA-256:

```text
4f3c445e8073e28044e120bdb3dc25051cd63c44b951deb35ae32c0fbf73b54b
```

Target-side application and type substitution both fail with `lean-entry-elaboration-drift` before linking and leave no release or staging directory. The same checks and unwritable-output cleanup run as `nobody`.

The native suite passes 14 checks, including installed Perl execution, during this milestone. After the final application serializer change, the shared-configuration native fixture also passes again with real compilation and installation. The native ABI and supported type families are unchanged.

The repository passes 545 core checks, 63 documentation checks, 111 site checks, lint and checked JavaScript. The core run skips 28 separately gated checks. All 16 reference pages regenerate. The 79-page documentation site passes its type check and production build.

```sh
source scripts/env.sh
LEAN_BRIDGE_ELABORATED_METADATA_TEST=1 node --test tests/elaborated-metadata.test.mjs
LEAN_BRIDGE_LAKE_WASM_TEST=1 node --test tests/unlocked-component.test.mjs
export LEAN_BRIDGE_TEST_PERL=/app/.toolchains/perl/5.38.2-threaded/bin/perl
export LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR=2.36
LEAN_BRIDGE_PERL_NATIVE_TEST=1 node --test tests/perl-native.test.mjs
npm run lint
npm run typecheck
npm run test:contracts
npm run test:docs
npm run docs:reference
npm run site:test
npm run site:typecheck
npm run site:build
```

Local acceptance uses Lean 4.32.2, Emscripten 6.0.6 and Node 22.23.2. The tests substitute the Nix command transport but run the real Lean engine, compiler, linker and installed packages. Nix is unavailable locally; CI exercises the pinned backend. The local Perl glibc override is test-only, and the production floor remains 2.38.

## Remaining work

VO1107 and VO1108 remain open for native finite specialization and the remaining parity checks. VO1238 also retains ownership, lifetime, refinement and effect configuration work. This milestone does not add generic host-language overload dispatch, certify the referenced theorems for specialized bindings, or publish packages to a registry.

Existing type-surface evidence hashes are refreshed without promoting coverage. The matrix remains at 6,562 cells, 2,193 observed cells, 116 installed-tested cells and 32,230 required stage gaps.
