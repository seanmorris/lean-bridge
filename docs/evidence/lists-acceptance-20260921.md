# Copied List acceptance audit

The copied List round covers parameters, results and record fields on both
ordinary-source and independently reviewed-IR paths. Inventory 0.43.0 records
**102 installed cells: 17 profiles × 2 source paths × 3 positions**.
The audit checks the requirements below against implementation, independent
consumers, source-bound records and current contract tests.

## Requirements and evidence

| Requirement | Verification |
| --- | --- |
| Preserve List identity through analysis, review, code generation and packaging | `tests/component-list-contract.test.mjs` validates the one-argument IR constructor and rejects Array substitutions in reviewed signatures and private descriptors. `tests/native-list-contract.test.mjs` checks distinct List/Array native types. Every installed suite compares the compiler API with `tests/helpers/list-fixture.mjs`, an independent 27-export catalog. WIT also compares parsed declarations and compiled component signatures. |
| Preserve order, duplicates, empty values and every nesting level | All public consumers call the same compiled Lean fixture, including asymmetric reversals, empty/singleton cases, mixed Lists/Arrays, copied record fields, Option/Except branches, binary products and 24 nested Lists. Native host consumers also check empty Lists at each depth. |
| Preserve supported element values | Every consumer covers all nineteen primitives. Exact integers, target-width words, IEEE special values, Unicode/NUL and bytes retain their established mappings inside Lists. npm uses 32-bit Lean words, PHP-Wasm uses 32-bit words and PHP integers, and native/WIT packages use 64-bit Lean words. The per-profile records identify tested endpoints and large-integer sizes. |
| Compile typed Lean conversions without exposing cons cells | `src/build/native-model.mjs` and the npm compiler adapters generate typed Array/List helpers. Contract tests reject constructor-tag/layout access in the generated List conversions. Public consumers use generated APIs or public Wasmtime values, not Lean constructor numbers or JSON transport. |
| Bound copying without returning a truncated prefix | Walkers retain one over-budget sentinel element: 1,048,577 npm slots, 2,097,153 native pointer slots, or 4,194,305 PHP-Wasm pointer slots. Conversion budgets must reject that result. Installed consumers test oversized inputs/outputs, successful recovery and a valid 30,000-element result. Types retain their declared nesting limits. |
| Give results independent ownership | Public consumers mutate inputs and sibling results and check the remaining values. Managed/native adapters use their host's ownership mechanism. C/C++ callers clear owned results; WIT results remain usable after session close. The records specify each host's disposal contract. |
| Reject invalid values and release partial conversions | Host-specific tests cover wrong elements, containers, branches, fields, bounds and malformed text. Fault probes exercise partial inputs, allocated outputs and conversion failures. Native/GMP and WIT sanitizer probes, scoped-memory counters, managed arena checks and interpreter exception probes check cleanup before recovery. Synthetic probes are identified separately from installed Lean execution. |
| Work from prepared packages | Each source path produces ecosystem archives and records their identities. Consumers install offline, remove or relocate producer inputs, and call the installed public API without Lean compilers or runtime overrides. Host-specific checks cover relocated deployment, source-free execution where applicable and unchanged installed files. |
| Retain reproducible evidence and CI coverage | The current contract suite validates source/consumer hashes and profile/path claims. `.github/workflows/consumer-matrix.yml` runs npm, C/C++, Python, Rust, .NET, JVM, Ruby, both PHP transports and WIT installed suites. `.github/workflows/perl-consumer.yml` runs all four Perl ABIs. Required reports are retained as CI artifacts. |
| Document the supported APIs | Every consumer type table now records copied Lists on both paths. The author, publisher, testing and architecture pages describe admission, package use, ownership and limits. Generated-reference checks, site tests, typechecks and the production site build pass. |

## Installed records by profile

Both source paths passed in every row. Assertion counts describe the named
public consumers; fault probes and static checks have separate counts.

| Profiles | Public execution | Record |
| --- | --- | --- |
| Node JavaScript, TypeScript, browser JavaScript, React, workers | 30,226 assertions per JavaScript context; strict TypeScript declarations and an executed typed caller. Chromium, Firefox and WebKit cover page, React and worker contexts. | [npm Lists](npm-lists-20260920.md) |
| C, C++ | 31,077 C assertions and 30,942 C++ assertions | [Native Lists](native-lists-20260920.md) |
| Python | 78,423 assertions | [Python Lists](python-lists-20260920.md) |
| Rust | 34,130 assertions, including a source-free rerun | [Rust Lists](rust-lists-20260920.md) |
| C# / .NET | 99,180 assertions, repeated without the SDK | [C# Lists](dotnet-lists-20260920.md) |
| Java, Kotlin | 91,674 Java and 91,696 Kotlin assertions, repeated with runtime-only deployments | [JVM Lists](jvm-lists-20260920.md) |
| Ruby | 88,446 assertions, repeated after relocation | [Ruby Lists](ruby-lists-20260921.md) |
| Perl | 112,738 assertions, repeated on threaded/unthreaded Perl 5.36.3 and 5.38.2 | [Perl Lists](perl-lists-20260921.md) |
| Native PHP | 86,983 assertions per weak/strict caller, repeated after the fault probe | [PHP FFI follow-up](php-native-lists-ffi-20260921.md) |
| PHP-Wasm | 86,992 assertions per Node/Chromium, startup/lazy, weak/strict combination, each repeated | [PHP-Wasm Lists](php-wasm-lists-20260921.md) |
| WIT/WASI | 721,296 assertions and 60 rejections, repeated after relocation | [WIT Lists](wit-lists-20260921.md) |

## Current checks

The cross-profile audit reruns all List contract/evidence files and the type
inventory checks: **110 passed, no failures or skips**. The complete core suite
passes **1,504 tests**, with 62 explicitly gated integration skips. Those skips
do not stand in for installed execution; the records above retain the executed
installed runs. The site suite passes **111 tests**.

The WIT milestone also reruns the installed compound and callable regressions
on both source paths. Both pass. An additional older C/WIT archive-reproducibility
run did not complete locally. Its first attempt lacked the Wasmtime SDK setting;
the configured retry retained multiple builds and was stopped before the disk
filled. That run is not counted as passed. CI retains the full regression,
including archive reproducibility and two-component runtime sharing.

The WIT milestone preserves all **53** previous nonempty artifact inventories.
Historical machine records remain unchanged. The original npm admission
contract is retained as a source snapshot because its former PHP-Wasm rejection
is no longer current; executed npm fixture and consumer hashes remain bound
to current files.

The Perl List consumers use scalar-context assertion prototypes. The current
Perl contract test executes a failed regex against each helper and requires it
to fail. The older Perl compound assertion helpers do not supply evidence for
this List round and remain a separate historical-fixture follow-up.

## Scope retained

This completes copied List parameters, results and fields, not all of VO1219.
List callback payloads remain rejected and unpromoted. Distinct runtime aliases,
arbitrary/recursive variants and resource-containing copies remain separate
work. Copy budgets bound conversion work, not every host allocation or Lean's
working heap. C and Wasmtime callers must supply valid C storage. Supported
platforms and toolchain versions remain those recorded for each profile.
No package registry publication is part of this round.
