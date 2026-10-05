# Installed PHP-Wasm Lists

Task 1219 adds copied `List` parameters, results and record fields to ordinary
and reviewed PHP-Wasm packages. The [machine record](php-wasm-lists-20260921.json)
binds the 27-export Lean fixture, independent PHP consumer, three archives,
receipts and installed files. Base revision: `d840880`.

## Installed execution

Each source path installs the exact component/runtime npm archives and companion
Composer ZIP offline, using empty caches, disabled lifecycle scripts and Brick
Math 1.0.0. A locked second installation must preserve the files. The producer
is removed before installation; the handoff and install project are removed
before relocated execution. Host PHP, Lean and compiler commands cannot execute
the consumer's Lean calls.

Each path runs twelve combinations, twice each in fresh PHP instances:

- Node with embedded PHP declarations or Composer-mounted PHP files.
- Chromium with a bundled descriptor served below a nested application URL.
- Startup or first-call loading, each with weak and strict PHP callers.

Every run passes **86,992 public assertions** on PHP 8.4.1, with 32-bit PHP
integers. The suite checks all nineteen primitive element types, full-width
integers, 5,121-bit Nat/Int magnitudes, binary32 rounding, IEEE special values,
Unicode scalars, embedded NUL and binary data. It also checks:

- Empty Lists, order, duplicates, 24-level nesting, List/Array mixtures and
  copied List fields in records, options, results and products.
- Public signatures against an independent catalog, readonly wrappers and
  independently copied arrays, buffers and branches.
- Sparse or associative arrays, iterator objects, wrong payloads, malformed
  text, cycles, numeric coercion and copy-budget rejection with recovery.
- A valid 30,000-element generated List, native rejection beyond 4,194,304
  four-byte slots, and a separate Zend output-conversion limit.

Lazy hosts load neither Lean library during autoload or invalid-input checks.
The first valid call loads each library once. Browser requests must match the
installed artifact hashes. Public callers never invoke the private Zend wire.
The installed deployment remains byte-identical after every run.

## Zend cleanup probes

A separate test-only Wasm module uses synthetic providers, not Lean. It tracks
scratch and nested output owners in both weak and strict PHP callers. Each
mode passes **147 assertions**, covering **61 injected allocation failures**,
sixteen partial nested inputs and ten malformed outputs. The latter include
missing or misaligned buffers, excessive or wrapped lengths, buffers extending
beyond Wasm memory, invalid nested buffers and invalid text after an earlier
element has been decoded.

An empty sequence must ignore its poison pointer. The probe also preserves
error text owned by a failing result, then recovers on a valid call. Two separate
host requests trigger native and partial-output PHP bailouts; the next request
must observe zero live C allocations and return the expected value. The report
labels these providers `synthetic-not-Lean`, separate from installed execution.

Typed Lean helpers convert inputs with `Array.toList` and bound the output
List-to-Array traversal. No C or PHP code inspects Lean cons-cell layouts.
The shared Zend decoder checks length, null buffers, element alignment and
Wasm memory bounds before allocating or reading sequence elements.

## Reproduce

Prepare the [PHP-Wasm toolchain](../contributing/author-toolchain.md#php-wasm),
the pinned `php-wasm` 0.1.0 host, Composer 2 and Chromium:

```sh
LEAN_BRIDGE_PHP_WASM_LIST_TEST=1 node --test tests/php-wasm-lists.test.mjs tests/php-wasm-list-zend.test.mjs
node --test tests/php-wasm-list-contract.test.mjs tests/php-wasm-list-evidence.test.mjs
```

CI retains `build/lists/php-wasm.json` and
`build/lists/php-wasm-zend-faults.json`. The local browser was Chromium
152.0.7977.75. No registry package was published.

## Scope

PHP uses consecutive-key arrays with element-specific PHPDoc. UInt32, UInt64,
Int64, Nat, Int and USize elements use `Brick\Math\BigInteger` on wasm32; ISize
uses a 32-bit PHP integer. List and Array keep separate IR/native identities.
The 32-level type limit and separate 16 MiB validation, Zend conversion and
native copying budgets apply. They do not bound all host or Lean working memory.

This milestone promotes six PHP-Wasm copied-List cells, reaching **96/102**
cells across **16/17** profiles. WIT/WASI Lists remain unpromoted. List callback
payloads, arbitrary/recursive variants and resource-containing copies remain
separate work.

The npm milestone's recorded contract included the former PHP-Wasm rejection.
Its exact source is retained in
`tests/fixtures/evidence/npm-lists-contract-20260920.mjs.txt`; the active contract
now asserts PHP-Wasm admission. The historical npm record and archive hashes
are unchanged. Its executed consumer, build driver, Lean source and independent
signature catalog remain bound to their current files.
