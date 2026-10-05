# Native CPAN finite specialization

VO1107, VO1108 and VO1238 milestone, 2026-09-14.

## Implementation

Native CPAN now accepts the shared `specializations` configuration. Lean resolves the selected type constants, universe levels and following instance dictionaries, then projects the concrete signature through `native-library-v1`. npm and public scalar analysis retain their existing supported types.

The configured name identifies the concrete export. Its metadata, native model and Binding IR also retain the original declaration, checked application, documentation, source position and theorem references. Theorem references remain navigation metadata; specialization adds no assurance claim. Native `arities` uses the configured specialization name and counts runtime arguments after Lean resolves type and instance arguments. Native `resources` continues to name the original source type.

Generated adapters call the compiler-checked application and use the existing C ABI, copied-value, identity and callback machinery. Native calls, type names, record constructors and projections use absolute Lean names. Decimal conversion calls `Nat.repr`, `Int.repr` and `String.toInt!` directly rather than resolving names or instances in the generated namespace.

After compiling the adapter, the builder extracts the metadata again and requires exact canonical agreement before linking. Source, interface sidecars, compiler and extractor identities remain checked around these operations. CPAN staging reconstructs the native model from the retained metadata and rejects a changed application even when the report and receipt file hashes have been recomputed.

## Installed acceptance

The new fixture configures 12 specializations and three ordinary exports. It builds twice from relocated, read-only source trees and produces byte-identical runtime and component archives. Both original source paths are moved out of place before installation. The test installs the archives through `prebuilt-only` and `build-xs`, then runs 19 Perl assertions through each installed API.

The assertions cover UInt32 bounds and aliases, Unicode with embedded NUL, large positive `Nat` and negative `Int` values, a custom instance, two type arguments, copied arrays and records, canonical resource identity, returned closures with configured arity, Lean callbacks, synchronous Perl callbacks and original callback exceptions. Unbound generic functions are absent from the Perl API. Invalid scalar input is rejected.

The fixture also defines misleading names inside the generated namespace: an ordinary function, a primitive type alias, a record type alias, a constructor and a projection. Installed calls still use the intended source declarations. Record round trips preserve distinct field values rather than using those shadow definitions.

The reproduced component archive has SHA-256:

```text
d40090b351d5b6084db43f36dae4888132c031b0f379c7ddc1175a92d2cb5181
```

Nine rejection cases cover application substitution, changed type arguments, malformed second-extraction JSON, changed staged source, arrays of resources, arrays of callbacks, missing instances, effects and admitted implementations. Each case fails before linking, leaves no release or staging directory, and preserves the author's source bytes, modes and timestamps. Resource and callback containers keep their existing ownership and retention diagnostics.

The first installation test used the nonexistent option `xs-only`; the installer correctly rejected it. The corrected test uses `build-xs`. No installer policy was relaxed.

The full native suite passes all 25 checks, including the existing 183-assertion Workshop consumer. The 11 specialization and rejection checks also pass as unprivileged `nobody`; that run reproduces the same CPAN archive digest. The shared compiler-metadata suite passes 14 checks. The complete npm suite passes 23 checks with one root-only permission skip, including offline installed WebAssembly and clean-clone publication dry runs.

Lint, checked JavaScript, 546 core checks, 63 documentation checks and 111 site checks pass. The core run skips 28 separately gated checks. All 16 reference pages regenerate, and the 79-page site passes its type check and production build.

## Validation commands

```sh
source scripts/env.sh
export LEAN_BRIDGE_TEST_PERL=/app/.toolchains/perl/5.38.2-threaded/bin/perl
export LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR=2.36
LEAN_BRIDGE_PERL_NATIVE_TEST=1 node --test tests/perl-native.test.mjs
LEAN_BRIDGE_ELABORATED_METADATA_TEST=1 node --test tests/elaborated-metadata.test.mjs
LEAN_BRIDGE_LAKE_WASM_TEST=1 node --test tests/unlocked-component.test.mjs
npm run lint
npm run typecheck
npm run test:contracts
npm run test:docs
npm run docs:reference
npm run site:test
npm run site:typecheck
npm run site:build
```

Local tests use Lean 4.32.2, Node 22.23.2 and Perl 5.38.2-threaded. The local glibc override is test-only; the production minimum remains 2.38. npm acceptance substitutes only the unavailable Nix transport and runs the real engine, compiler and WebAssembly linker. The pinned Nix backend and four-ABI Perl matrix remain CI checks.

## Remaining work

This milestone completes native specialization within the existing native type profile. Shared lifetime, ownership, refinement and effect configuration remain under VO1238. Generic host dispatch, additional source targets and broader type-family delivery remain in their dependent stages. No package is published to a registry.

Eight exact evidence hashes are refreshed without promoting type coverage. The matrix remains at 6,562 cells, 2,193 observed cells, 116 installed-tested cells and 32,230 required stage gaps.

## CI scheduling follow-up

[Downstream run 34808647472](https://github.com/seanmorris/lean-bridge/actions/runs/34808647472) for `4418eff` reached the Perl job's 60-minute limit. The shared compiler/Lake checks and the first three Perl configurations completed. Each completed ABI suite passed all 25 tests; the job was cancelled while running Perl 5.38.2 unthreaded. The pinned Nix Perl job and every other consumer job passed. Core and performance workflows also passed.

The workflow now runs the four ABI suites in separate jobs, with independent toolchain caches and artifact names. Shared compiler/Lake checks run once in a separate job. Every check remains enabled. A failed configuration does not cancel its siblings. The combined consumer observation requires the entire ABI matrix, shared checks, pinned Nix installation and evidence download to succeed. Its performance measurement retains the Perl 5.38.2 threaded worker's CPU identity.

The local command still runs all four configurations by default. `--configuration 5.38.2-unthreaded` selects only that suite and cannot emit the complete matrix's observation. The runner removes stale observations, checks that the benchmark and installed acceptance identify the same native library and interpreter, and writes performance evidence only after the full native suite succeeds.

The scheduling regression tests cover all four selections, invalid arguments, stale observations, toolchain failure, failures after benchmark execution, missing files, invalid timings and mismatched artifacts. Actionlint 1.7.12 validates both consumer workflows, including shell checks. Core validation passes 568 tests with 28 separately gated skips; all 63 documentation tests, 40 site tests, 16 generated reference checks, lint, checked JavaScript, site type checking and the 79-page production build pass. The refreshed runner hash does not change type coverage.

The real single-configuration command passes all 25 native tests on Perl 5.38.2 unthreaded in 380 seconds, including both installation paths and the 183-assertion Workshop consumer. Its performance observation passes the shared consumer-result validator. This local run uses the test-only glibc floor of 2.36; the four production ABI configurations and pinned Nix checks run in CI.

```sh
source scripts/env.sh
LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR=2.36 npm run test:consumer:perl -- --configuration 5.38.2-unthreaded
```
