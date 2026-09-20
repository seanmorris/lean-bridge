# Installed native PHP compound values

Task 1219 adds copied `Option`, `Except` and nested binary `Prod` values to
prepared native Composer packages on ordinary-source and independent reviewed-IR
paths. The [machine record](php-native-compounds-20260920.json) retains source,
package, installed-file, receipt and runtime hashes. Base revision: `41aa4718`.

## Installed checks

Each path builds the same 64-export Lean library and compares its compiler API
with an independent signature catalog. Composer installs the prepared ZIP and
pinned Brick Math dependency offline with empty home/cache directories, plugins
and scripts disabled. A second locked install must leave all files unchanged.
The producer project is removed before installation. The installation is moved;
the archive handoff and install project are removed before execution. Compiler
commands and Lean/runtime paths are unavailable.

Weak and strict PHP callers each pass **46,123 public assertions**, twice in
separate processes. Each caller runs once more after the fault probe. Every run
uses the unchanged installed public API and checks its loaded path and mapped
native-library hashes against the package receipt. The consumer covers:

- All nineteen primitive payloads: fixed-width limits, exact 1,234-digit
  integers, binary32 rounding, IEEE endpoints, NaN classification, signed zero,
  Unicode scalars, embedded NUL and all 256 byte values.
- None, Some None and Some Some Unit as distinct values; same-typed and
  asymmetric result branches; nested products, arrays and copied records.
- Twenty-four option levels, no-argument compound returns, buffer and array
  independence, detached PHP references and recovery after rejected inputs.
- Wrong branch classes, missing fields, wrong product arity, non-list arrays,
  cycles, invalid payloads and input/output copy-budget exhaustion.
- Final readonly branch classes, exact constructor arity and concrete payload
  validation without weak-mode coercion.

## Cleanup and malformed outputs

A separate process evaluates an instrumented copy of the installed private
helpers in memory, under a test namespace. No installed file is modified.
For each source path it passes:

- **355 injected failures** at validation, conversion accounting and scratch
  allocation checkpoints. Every tracked scratch CData object and scope becomes
  unreachable, every scope closes, and each aggregate output is cleared once,
  including calls rejected before entering native code.
- **Three real failures**: an invalid integer, a partial product input and the
  shared native input/output copy-budget limit. Cleanup and subsequent public
  calls still succeed.
- **Seven malformed-output rejections**: invalid Option/Except flags, oversized
  output, missing buffer and invalid UTF-8. Three inactive payload cases confirm
  that unselected fields are not read.

The probe makes 7,204 assertions per path. These are PHP-side injected failures;
they do not fault every allocation inside Lean. The shared
[C compound suite](native-compounds-20260920.md) checks native allocation failures.
Both public callers repeat after the probe, and the full installed inventory
must remain unchanged.

## Reproduce

Use PHP 8.2+ NTS CLI with FFI, Composer 2, the pinned Lean toolchain and a C compiler:

```sh
export LEAN_BRIDGE_PHP=/absolute/path/to/php
export LEAN_BRIDGE_COMPOSER=/absolute/path/to/composer
LEAN_BRIDGE_PHP_COMPOUND_TEST=1 \
  node --test tests/php-compounds.test.mjs tests/php-compound-contract.test.mjs
```

CI retains `build/compounds/php-native.json`. The local run used PHP 8.2.33,
Composer 2.5.5, Linux x86-64 and `LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36`;
the supported CI profile remains glibc 2.38. No registry release was published.

## Scope

Options use `null` or `Some`, results use `Ok` or `Err`, and products use exactly
two consecutive array elements. Branch wrappers expose a readonly `$value`
property. Concrete payload types are checked at each call; wrappers alone do
not validate a Lean signature or deeply freeze arbitrary objects. Calls copy
nested values. PHP object identity is not Lean value equality.

Type nesting is limited to 32. Validation, PHP conversion and shared native
input/output copying each have a 16 MiB accounting limit. These are conversion
limits, not bounds on all PHP allocations or Lean working memory. Resources,
compound callables, lists, arbitrary variants and recursive copied types remain
separate work. This milestone promotes eighteen native PHP copied positions.
PHP-Wasm's Zend adapter still rejects compound constructors; WIT/WASI is also
unpromoted.
