# Shared primitive corpus and Ruby adapter, 2026-09-16

VO 1217. This milestone expands the [corpus foundation](type-corpus-foundation-20260916.md) to all 16 primitive parameter/result types and adds an installed Ruby adapter. The combined run passes **248 cases** across Python and Ruby. Each profile executes 84 differential results and 40 host-input rejections against two independently compiled Lean libraries.

This record describes commit `a43404e`. The [following milestone](type-corpus-perl-20260916.md) adds Perl and separate compiler-declaration checks.

## Cases and public APIs

[Shop.Pricing](../../tests/fixtures/type-corpus/Shop/Pricing.lean) and [Telemetry.Readings](../../tests/fixtures/type-corpus/Telemetry/Readings.lean) now expose 19 functions each. Their APIs, record layouts and calculations differ. Each retains three proved lemmas, a local Lake dependency and a pinned Git dependency created in the test's offline cache.

The [shared catalog](../../tests/fixtures/type-corpus/cases.mjs) covers `Unit`, `Bool`, `UInt8`, `UInt16`, `UInt32`, `UInt64`, `Int8`, `Int16`, `Int32`, `Int64`, `Nat`, `Int`, `Float32`, `Float`, `String` and `ByteArray` as parameters and results. It also exercises nested arrays, copied records, empty collections, embedded NUL and Unicode text, and 4,097-bit natural numbers.

New fixed-width cases check wraparound, zero and rejection below or above each added integer type's range. Floating-point inputs include finite values, positive and negative zero, the smallest positive subnormal, the largest finite value, both infinities and NaN. The Lean oracle runs the source functions and emits exact result bits. Both consumers compare those bits; NaN cases compare classification, without asserting a payload or sign.

The [Python adapter](../../tests/fixtures/type-corpus/consumers/python.py) calls generated functions and dataclasses. The [Ruby adapter](../../tests/fixtures/type-corpus/consumers/ruby.rb) calls generated module methods and frozen records through their public readers. It uses the module's unit sentinel and binary strings for byte arrays. Neither adapter accesses the raw ABI or private loaders.

Invalid host inputs must raise the profile's own exception: `TypeError` for type errors, Python `ValueError` or Ruby `RangeError` for range errors. Every rejection is followed by a successful recovery call. Copy checks clear nested input arrays and require the returned record to remain unchanged.

## Build and installation checks

The [shared native harness](../../tests/helpers/type-corpus-native.mjs) builds both selected package formats from each of two relocated workspaces. It checks unchanged source inputs, identical archive records and binding IR, and matching source/compiler hashes between the Lean oracle and generated packages. In the combined run, both language packages for a library share its oracle, binding IR and runtime identity.

The harness copies prepared archives and their receipt into a consumer directory, then deletes all author, oracle and unpacked build directories before installation. Python installs with pip offline into a fresh virtual environment. Ruby installs the exact gem offline into an isolated `GEM_HOME` and `GEM_PATH`. Consumer processes receive disabled compiler paths and runtime overrides. Both verify that their public API code comes from the installed package.

`Shop.Pending.discount : Bool → Option Nat` and `Telemetry.Pending.checkedCount : Int → Except String Nat` still compile in Lean and fail native source admission with `native-elaboration-unsupported`. These two rejected builds leave no output directory and do not count as installed type coverage.

## Executed artifacts

The combined run used x86-64 Debian 12, Node 22.23.2, Python 3.11.2, MRI Ruby 3.3.12, RubyGems 3.5.22 and Lean 4.32.2, compiler commit `f3b06c705e6c85f5314019d5d3baab0fec5b580c`. The local glibc floor override was 2.36; production and Ubuntu CI retain 2.38. The native Ruby profile requires MRI 3.3.

| Combined-run archive | SHA-256 |
| --- | --- |
| `shop_corpus-1.0.0-py3-none-manylinux_2_36_x86_64.whl` | `e042a3654b0913f2c6849531343a51c43f8789d587926d5053a6bf5f28d96059` |
| `shop-corpus-1.0.0-x86_64-linux.gem` | `0181ba36e5db125a3e35851bc7e2f54d5d9916ab7dd6e9cabc03ad2db975d4e6` |
| `telemetry_corpus-1.0.0-py3-none-manylinux_2_36_x86_64.whl` | `dd206a085ed2360e1dea3f20c170ae89918de8c9823aeafd97269a0f896e1389` |
| `telemetry-corpus-1.0.0-x86_64-linux.gem` | `b5d1ab3e7e42071f727059be3a8a4a5590179de101313e94b2807637fb6d35b1` |

All four archives reproduced from relocated workspaces. They bind runtime identity `e7d08d91baf7f70d791a79bd611779d311201ce6b6530f478be4f8ff1113be1f`. The catalog and its 14 source/harness files bind corpus identity `1f31c97b2b8c983be09ea3cf3024fa7452889a85bdc9a8d11881a41004642517`. Scratch builds and consumer installations are removed after each test.

## Reports, CI and remaining work

`npm run test:type-corpus:native` writes `build/type-corpus/python-ruby.json`. Individual Python and Ruby commands write `python.json` and `ruby.json`. Reports include exact archive, source, dependency, compiler, runtime, binding IR and receipt identities alongside the Lean results and installed observations. The harness rejects changes to corpus inputs during execution. Failed executions remove the previous selected report and write no success report.

The combined report contains **82 observed cells and 6,480 gaps** across all 17 profiles and both source paths. Each adapter observes 41 ordinary-source cells. These are scoped cases, not completion of each cell's semantic requirements. The type-support inventory remains unchanged at 656 installed-tested cells.

VO 1217 still needs the other 15 profile adapters, reviewed-IR execution and remaining type families and positions, including callback, closure, identity and asynchronous behavior. The new floating-point cases cover parameters and results, not record fields or arrays of floats. Missing shared-corpus adapters do not negate coverage in the existing per-language acceptance suites.

CI runs the Python and Ruby adapters separately, includes each result in its consumer support gate, and uploads `type-corpus-python-<commit>` and `type-corpus-ruby-<commit>`. It does not publish these packages to a registry. See the [prerequisites and commands](../contributing/testing.md#shared-real-lean-type-corpus).

## Local validation

The combined, Python-only and Ruby-only corpus suites each pass all 29 tests. The combined run executes four isolated installations and eight archive builds. Fast corpus validation passes 28 tests and skips the compiler-gated test. It rejects incorrect floating-point bits, cross-profile observations, wrong archive ecosystems, unsupported adapter selections and profile-specific error mismatches.

`npm run check:core` passes lint, checked-JavaScript types and 737 tests, with 54 compiler/runtime-gated skips. All 65 documentation tests, 111 site/demo tests, the site typecheck, production site build and type-inventory check pass. These local results do not claim that remote CI for this milestone has run.
