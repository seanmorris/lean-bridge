# Installed native PHP Lists

Task 1219 adds copied `List` parameters, results and record fields to native
Composer packages on ordinary-source and independent reviewed-IR paths. The
[machine record](php-native-lists-20260921.json) retains source, archive,
receipt, installed-file and runtime hashes. Base revision: `78406db`.

## Installed checks

Each path builds the 27-export List library and compares its compiler API with
an independent signature catalog. Composer installs the prepared ZIP and Brick
Math 1.0.0 offline, with empty home/cache directories and plugins/scripts
disabled. A second locked install must leave all files unchanged. The producer
project is removed before installation; the handoff and install project are
removed before relocated execution. Compiler commands and Lean/runtime paths
are unavailable.

Weak and strict callers each pass **86,983 public assertions** twice in separate
processes. Each caller runs again after the fault probe. All runs use the
unchanged installed public API and compare four mapped native-library hashes
with the package receipt. The consumer checks:

- Lists of all nineteen primitives, including full-width integers, 5,121-bit
  Nat/Int magnitudes, binary32 rounding, IEEE endpoints, signed zero, NaN
  classification, Unicode scalars, embedded NUL and all byte values.
- Empty and singleton Lists, order and duplicates, 24 nesting levels, List/Array
  mixtures, copied record fields, Option/Except branches and nested products.
- Independent arrays, byte wrappers and branch objects, including input PHP
  references and repeated nested values.
- Associative or sparse arrays, iterator objects, cycles, wrong payloads,
  invalid text, tuple arity and coercion traps in both lexical caller modes.
- Input/output copy limits, native budget failures, oversized generated Lists,
  a 30,000-element valid result and recovery after each rejected call.

## Cleanup and output validation

A separate process evaluates an instrumented copy of the installed private
helpers in memory under a test namespace. It does not modify installed files.
Each path makes **14,895 probe assertions**, covering:

- **591 injected failures** at validation, conversion accounting and scratch
  allocation checkpoints. Tracked scratch objects and scopes become
  unreachable, scopes close and aggregate outputs clear once. The original
  injected exception returns unchanged.
- **20 real failures**, including sixteen partial-input failures, negative Nat,
  native copy limits and a PHP output-conversion limit. Public calls recover.
- **Nine malformed-output rejections**: missing buffers, misaligned addresses,
  excessive or wrapped lengths and a missing nested List buffer. Length and
  alignment checks precede element reads.
- **Two empty-buffer cases** that must not inspect a poison pointer, and a
  four-byte-aligned Bool/Char product that must not be rejected merely because
  its address is not eight-byte aligned.

Both public callers repeat after the probe, and the complete installed
inventory remains unchanged. These probes exercise PHP-side cleanup. The
[C/C++ List suite](native-lists-20260920.md) retains native allocation-failure
coverage. Typed Lean conversions use `Array.toList` for inputs and a bounded
List-to-Array traversal for outputs; PHP and C do not inspect cons-cell layouts.

## Reproduce

Use PHP 8.2+ NTS CLI with FFI, Composer 2, the pinned Lean toolchain and a C compiler:

```sh
export LEAN_BRIDGE_PHP=/absolute/path/to/php
export LEAN_BRIDGE_COMPOSER=/absolute/path/to/composer
LEAN_BRIDGE_PHP_LIST_TEST=1 node --test tests/php-lists.test.mjs
node --test tests/php-list-contract.test.mjs tests/php-list-evidence.test.mjs
```

CI retains `build/lists/php-native.json`. The local run used PHP 8.2.33,
Composer 2.5.5, Linux x86-64 and `LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36`.
The supported CI profile remains glibc 2.38. No registry package was published.

## Scope

PHP uses consecutive-key arrays with precise `list<T>` PHPDoc. List and Array
retain distinct IR and native identities. Types are limited to 32 levels;
validation, PHP conversion and native copying each have a 16 MiB accounting
limit. These limits do not bound every PHP allocation or Lean working memory.

This milestone promotes six native PHP copied-List cells, reaching **90/102**
List parameter/result/field cells across **15/17** profiles. PHP-Wasm and
WIT/WASI Lists remain unpromoted. List callback payloads, arbitrary/recursive
variants and resource-containing copies remain separate work.
