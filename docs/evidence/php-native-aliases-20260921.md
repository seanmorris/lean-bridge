# Installed native PHP copied aliases, 21 September 2026

Prepared Composer archives preserve 27 copied alias names, original targets and
chains in `binding-manifest.json`. Installed PHPDoc records each original
parameter, result and record-field contract beside its PHP target type.
Callers pass ordinary PHP values, with no alias classes or wrappers. The FFI
conversion code is identical to the equivalent unaliased API.

The public generator now routes copied alias APIs through the copied adapter,
including nested Option Unit aliases. Package audits check the alias catalog
against the source contract and reject changed names, targets, host types or
missing entries. Names such as `Pointer` in documentation do not count as
exposed native state; public declarations still receive the surface audit.

## Installed validation

Ordinary-source and independently reviewed builds compile the unchanged shared
native alias fixture. Before packaging, the test compares all original alias
definitions, record fields and exported signatures with the independent review.

Both source paths pass 12,532 public assertions per execution in weak and strict
PHP 8.2.33 callers on x86-64 Linux. Each caller runs twice after relocation, then
again after the isolated fault probe. Calls cover all nineteen primitives,
exact 5,121-bit integers, fixed-width and machine-word limits, Float32 rounding,
signed zero, subnormals, infinities, NaN classification, Unicode and embedded NUL.
Lean independently checks all nineteen scalar record fields; changing any
non-Unit field fails that check.

The consumer exercises chains, return-only aliases, nested Lists and arrays,
record fields, three nested Option Unit states and both Result branches.
Mutation and weak-reference checks verify independent copied values. Nat
requires a nonnegative `BigInteger`. Invalid types, numeric coercion, ranges,
Unicode, sparse arrays, iterator objects, malformed branches, products and
cyclic inputs reject. Over-budget copies fail, then subsequent calls succeed.

Each test removes the producer before installing the exact prepared ZIP through
offline Composer with an empty home/cache, disabled plugins and scripts, and a
locked second installation. It relocates the installation, removes the handoff
archive and executes without compilers, PHP configuration files or runtime-path
overrides. Composer installs the pinned Brick Math dependency. All four loaded
package libraries match their receipts; every installed file remains unchanged.

An independent rebuild reproduces both source paths' Composer archives and all
package-owned files byte-for-byte, including their native libraries and alias
catalogs. Composer's deployment records include local paths, so the complete
test report differs between installations.

## Failure cleanup

A separate process instruments an in-memory copy of the private FFI adapter.
No installed source or native library is replaced. Each source path passes
12,904 probe assertions covering:

- 567 injected exceptions at conversion-budget and ownership checkpoints.
- 64 partial record/List input failures, with all scopes and scratch owners
  released and subsequent public calls succeeding.
- Three additional negative-Nat or native copy-budget failures.
- Fifteen malformed native outputs and two empty-buffer cases.

Injected exceptions preserve their identity. Every instrumented call closes its
scope and clears its native output once, including failed input validation.
Weak references verify scratch owners no longer remain alive. Synthetic native
headers reach only private decoders in the isolated process; they never reach
public consumers or native release functions.

The existing 16 MiB conversion budgets and 32-level type-depth limit remain.
These limits do not measure all PHP allocations or Lean working memory.

## Reproduce

```sh
LEAN_BRIDGE_PHP_ALIAS_TEST=1 node --test tests/php-aliases.test.mjs
node --test tests/php-alias-contract.test.mjs tests/php-alias-evidence.test.mjs
```

Set `LEAN_BRIDGE_PHP` and `LEAN_BRIDGE_COMPOSER` to absolute tool paths if needed.
Local acceptance uses the existing `LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36`
override for this glibc 2.36 host. Production and CI retain the 2.38 floor.
The [source-bound receipt](php-native-aliases-20260921.json) records fixture,
interpreter, Composer, archive, dependency and installed-file identities.
CI requires and uploads `build/aliases/php-native.json`.

Inventory 0.53.0 promotes only six native PHP alias cells: parameters, results
and record fields on both source paths. PHP-Wasm and WIT/WASI aliases remain
open. Native variants, bounded recursion, compound callables and explicitly
owned identity aggregates remain part of VO1219 and VO1221.
