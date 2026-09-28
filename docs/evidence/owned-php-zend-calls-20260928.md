# PHP-Wasm ownership calls

The Zend generator emits public PHP functions, immutable value classes and
opaque resource bindings for resource-containing Lean values. The generated
API executes compiled Lean through the pinned 32-bit PHP-Wasm interpreter.
It does not use FFI, numeric resource tokens or public native pointers.

This milestone supplies the calling layer. CLI admission, prepared Composer
and npm packages, installed browser tests and package coexistence still need
integration. It does not promote installed-support cells.

## Values and callbacks

Arrays and Lists use consecutive-key PHP arrays. Records and variants use
generated readonly classes; products retain their nesting. Options distinguish
`null`, `Some(null)` and nested `Some` values. Results distinguish `Ok` and
`Err`, with canonical success/error type ordering. Aliases use their underlying
PHP representation. All nineteen scalar mappings apply inside these values.

Resource and Lean-closure wrappers contain Zend resources. Each returned
aggregate shares a checked native result lease across its wrappers.
`retain()` creates an independently closable lease. `close()` is idempotent;
destruction and request shutdown provide fallback cleanup.

Lean-to-PHP callbacks receive borrowed resource and closure wrappers. The
transport converts the reply while those borrows are live, then invalidates
them before releasing the native callback scope. Retaining a borrowed Lean
closure works; retaining a PHP callback does not extend its enclosing call.

Callbacks accept ordinary synchronous PHP callables or returned Lean closures.
If a signature has no type-safe automatic recovery value, the caller supplies
`with_recovery($callback, $value)`. A callback failure returns the original PHP
`Throwable` after cleanup. It never returns the internal recovery value as a
successful result.

Conversions enforce 128 value levels, 262,144 visits and separate 16 MiB
conversion-storage budgets. These budgets do not include every PHP allocation
or Lean's working memory. PHP limits reentry to 64 calls; the native scope
limit can reject earlier. Generators, reference parameters, reference returns
and incorrect callback arities reject.

## Execution tests

`tests/owned-php-zend-generated.test.mjs` compiles the ordinary Lean fixture and
an independently authored, compiler-checked contract. Each build contains 51
exports and 27 typed callback signatures. The tests use the generated public
PHP API, with weak and strict callers in the actual PHP-Wasm interpreter.

All four caller/build combinations pass 1,349 assertions each, including 266
injected allocation failures per combination. The two builds also pass 32
shutdown/abort recovery cases and 18 isolated malformed-output cases. Every
cleanup check finishes with zero tracked native allocations and identities.

Coverage includes:

- All nineteen scalar callback types, including large integers, 32-bit words,
  embedded NULs, Unicode, bytes, signed zero, infinities and NaN.
- Mixed records, all variant constructors, empty containers, options, results,
  aliases, nested products and recursive values.
- Expired borrows, explicit retention, higher-order callbacks and closing an
  input or invoked closure during a callback.
- Original exception identity, nested failures, mandatory recovery values,
  reentry limits and cumulative callback limits.
- Every counted C allocation failure point in record callbacks, resource
  factories and mixed-result conversion, with cleanup checked after each.
- Reused-interpreter recovery after normal shutdown, PHP exit, raw Zend
  bailout, nested callbacks, destructor aborts and active-context shutdown.
- Corrupted output tags, identities, Unicode, spans and recursive cycles.
  Corruption retires the runtime; subsequent calls reject and cleanup remains
  available.

The output-corruption hook and allocation counter exist only in the test
extension. They surround the production converters and actual compiled Lean
calls. They do not replace the algorithm, callbacks or resource ledger.

Run the generated API checks alongside the schema and lifetime regressions:

```sh
LEAN_BRIDGE_OWNED_PHP_ZEND_TEST=1 \
LEAN_BRIDGE_OWNED_ZEND_FIBER_TEST=1 \
node --test --test-concurrency=1 \
  tests/owned-php-zend-model.test.mjs \
  tests/owned-php-zend-ownership.test.mjs \
  tests/owned-php-zend-extension.test.mjs \
  tests/owned-php-zend-generated.test.mjs \
  tests/test-profiles.test.mjs tests/checked-javascript.test.mjs
```

The combined run passes 19 tests with no skips. Lint and repository typecheck
also pass.

These checks require the pinned Lean compiler, PHP-Wasm Emscripten SDK,
PHP 8.4.1 headers and PHP-Wasm host. `LEAN_BRIDGE_PHP_SOURCE`,
`LEAN_BRIDGE_PHP_WASM_HOST` and `LEAN_BRIDGE_PHP_EMSDK` select their locations.
The generated-call test uses the verified shared runtime selected by
`LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME`, defaulting to
`build/owned-wasm32-runtime`.

The pinned PHP-Wasm host cannot start Fibers because its context-switching
stub is missing. Fiber execution and deferred destruction are tested
separately in native Zend using the same generated lifetime source.
`LEAN_BRIDGE_ZEND_PHP` selects that PHP executable; matching development
headers must be available through its `php-config`.

Reports in `build/owned-php-zend/generated.json` and
`generated-reviewed.json` record compiler inputs, generated sources, compiled
binary hashes and execution observations. The separate lifetime reports are
`lifetime.json` and `native-fibers.json`.

## Remaining integration

Package builds must regenerate and authenticate this transport from the
selected Lean source and ownership contract, then ship the same generated API
through Composer and npm. Installed tests must cover ordinary and reviewed
builds, relocation, reproducibility, multiple packages and browser execution.
Source-bound successor evidence must preserve the existing release receipts.

JavaScript/Wasm ownership, selected WIT/WASI ownership, transferred inputs,
anchored results and final cross-language acceptance remain part of the
structured-type work.
