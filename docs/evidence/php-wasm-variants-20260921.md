# Installed PHP-Wasm copied variants

Prepared npm component/runtime archives and the companion Composer ZIP now
compile concrete copied variants from ordinary Lean source and independently
reviewed contracts. PHP exposes abstract readonly families and final readonly
constructor classes. Original field names, empty constructors, Unit payloads
and nested copied values retain their meanings. Public code uses no numeric
tags, pointers or Lean object layouts.

The [machine-readable record](php-wasm-variants-20260921.json) contains source
hashes, compiler receipts, original archive identities, installed-file hashes,
loading observations and the separate synthetic Zend fault report.

## Real compiled Lean packages

The independent fixture exports fourteen functions over seven variant families,
eighteen constructors and all nineteen primitive payload types. A real Lean
`echo_signal` wrapper avoids PHP's reserved `echo` name. An independent Lean
inspector checks every scalar field, including large integers, floating-point
values, Unicode, embedded NULs and word-width boundaries.

Each source path passed 37,701 assertions across 4,465 public calls, including
59 rejected inputs with recovery, in twelve execution configurations:

- Node with embedded npm declarations or the companion Composer package.
- Chromium with the bundled installed npm package at a nested deployment URL.
- Startup and first-valid-call loading, with weak and strict PHP callers.

Every configuration executes twice after relocation. Authors and build staging
are removed before offline installation; the package handoff is removed before
execution. Consumers have no Lean compiler, Emscripten, PHP headers or source
runtime overrides. npm and Composer installs use empty caches, local archives
and lockfiles. Composer installs pinned Brick Math 1.0.0; embedded declarations
use the same bundled dependency. All 257 deployed files remain unchanged.

On wasm32, `UInt32`, `UInt64`, `Int64`, `Nat`, `Int` and `USize` use
`Brick\Math\BigInteger`. `ISize` uses a signed 32-bit PHP integer. These rules
apply in every payload. The tests cover named and positional arguments,
anonymous constructor fields, nested arrays, Lists, records, options, results,
products, independent returned buffers, reflection-created malformed inputs,
copy budgets and recovery. Invalid inputs do not load lazy components.

An independent rebuild reproduced all three archive hashes, all 100 packaged
file identities and all twelve observations for each source path. Fresh Composer
installation paths and lock metadata are not claimed byte-identical between
separate installations.

## Zend ownership and malformed outputs

A separate synthetic C provider exercises the generated wasm32 Zend adapter.
It is not Lean compilation evidence. Each weak/strict caller passed 1,040
assertions covering all eighteen constructors, 63 allocation failures,
92 malformed wire inputs, 32 partial-input failures, seven invalid output tags,
seven malformed payloads, eight poisoned inactive payloads and two request
bailouts. Native owners and Zend scratch return to zero after failures; each
native entry has exactly one output-clear call. Successful calls after each
failure verify recovery. Native error text remains valid after its owner clears.

The probe saves owned payload headers separately before corrupting output
headers. Invalid discriminants are rejected before payload reads, and empty
cases ignore poisoned inactive storage. The provider restores its real owners
for cleanup, so deliberately forged tags do not hide leaked allocations.

## Limits and remaining work

Schemas retain the 32-level bound and separate 16 MiB validation, Zend conversion
and native-copy accounting limits. This is not a bound on Lean working memory.
Generic, indexed, proof-bearing and recursive variants, compound callback
payloads and identity-bearing copied aggregates require further support.
WIT/WASI variants remain the next copied-variant projection.

The existing alias, List, compound and primitive-callable Zend generators emit
the same files as before this change for both PHP integer widths. Installed
regressions and the required CI job check those paths separately. Coverage adds
only the six PHP-Wasm variant parameter/result/field cells across both source
paths. Callback and recursive-value cells remain unpromoted.

Reproduce the installed checks with the pinned PHP-Wasm toolchains:

```sh
LEAN_BRIDGE_PHP_WASM_VARIANT_TEST=1 node --test --test-concurrency=1 \
  tests/php-wasm-variants.test.mjs \
  tests/php-wasm-variant-contract.test.mjs \
  tests/php-wasm-variant-zend.test.mjs
node --test tests/php-wasm-variant-evidence.test.mjs
```
