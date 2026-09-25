# Native PHP structured callbacks and returned functions

VO 1219. Native Composer packages support synchronous callbacks and returned
Lean functions with arrays, Lists, options, results, products, acyclic records,
variants and concrete copied aliases. The public API uses ordinary PHP arrays
and generated value classes. Consumers need no FFI declarations or JSON transport.

Ordinary source and independently reviewed Binding IR each produce an original
Composer ZIP. Acceptance verifies and relocates the archive, removes the author
source and build directories, installs offline through Composer, then relocates
the installed application and removes its handoff. Repeated weak and strict
callers run without compilers or runtime-path overrides.

Each public caller passes 104,399 checks, 2,803 calls and 625 expected rejections.
The cases cover every constructor, empty values, nested Option presence, exact
integers, Unicode and NUL text, independent copies, exception identity, borrowed
callback expiry, returned closure capture, disposal, reentry and Fiber rejection.
The exact [consumer example](../php.md#structured-callback-values) executes twice
per source path. Lean compiles the [publisher example](../publish/php.md#export-structured-callbacks).

## Failure and ownership checks

An isolated process evaluates an instrumented copy of the installed PHP adapter
in memory. It uses the original native libraries and leaves installed files
unchanged. Each source path passes 8,080 injected `RuntimeException` and `Error`
failures across five paths for each shape: callback, repeated callback, closure
creation, creation plus invocation, and invocation of an existing closure.
The probe covers all 64 copied conversion and closure-wrapping methods.

After each injected failure, scratch-buffer weak references are cleared,
callback contexts are empty, the native closure count returns to its baseline,
and a valid retry succeeds. Disposal during argument conversion defers release
until the active closure call returns. Fifteen malformed native headers reject
before payload access. These checks do not count every Lean heap allocation.
The unmodified public callers run again after the probe.

Fresh installed primitive-callable regression packages pass 51,686 checks per
weak/strict caller on both source paths. All generated files for the preceding
primitive-callable, collection, compound, List, alias and variant fixtures remain
byte-identical to independently rendered commit `073ccdf`.

## Records and reproduction

- [Execution record](php-structured-callables-20260925.json): complete logs,
  original archive receipts, public observations, fault checks and documentation.
- [Code-generation comparison](php-structured-codegen-regression-20260925.json):
  all generated files for the six previously admitted fixture families.
- [Integration record](php-structured-callable-integration-20260925.json): exact
  source transitions, unchanged predecessor receipts and 32 added native PHP
  callback-position cells in inventory 0.95.0.

With the pinned Lean/native author toolchain, PHP 8.2+ NTS CLI, FFI and Composer:

```sh
source scripts/env.sh
LEAN_BRIDGE_PHP_CALLABLE_TEST=1 node --test tests/php-callables.test.mjs
LEAN_BRIDGE_PHP_STRUCTURED_CALLABLE_TEST=1 node --test tests/php-structured-callables.test.mjs
```

`LEAN_BRIDGE_PHP` and `LEAN_BRIDGE_COMPOSER` select explicit tools when they are
not installed at `/usr/bin/php` and `/usr/bin/composer`. Consumer CI requires
the structured acceptance report.

PHP-Wasm and WIT/WASI structured callbacks, recursive callbacks outside npm,
resource-containing aggregates and final cross-language acceptance remain in
VO 1219. PHP-Wasm keeps its primitive-only callable guard until its structured
reply ownership is implemented and tested. No registry publication occurred.
