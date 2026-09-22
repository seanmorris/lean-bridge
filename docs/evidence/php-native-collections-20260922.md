# Native PHP arrays, records and value comparison

The [machine record](php-native-collections-20260922.json) binds two independent
builds to the original Composer archives, installed files, public callers,
documentation example and failure probes. Both builds cover ordinary Lean
source and independently reviewed IR.

Each weak and strict PHP caller passes 191,516 assertions across 4,317 public
calls. The unchanged shared Lean fixture contains 35 exports, nineteen primitive
element types, seven record types and a 24-level nested Array. Lean-side
inspectors check field contents independently of the converters. The callers
check field order, exact values, Unicode and binary data, floating-point edge
cases, empty containers, copy independence and 67 rejected inputs.

## Public API

Arrays use consecutive-key PHP lists. Records use final readonly classes with
their original Lean property names and declared field order. PHP keyword type
names gain a trailing underscore: `Records.Empty` becomes `Empty_`. Registration
rejects collisions after escaping. Constructor checks reject extra arguments,
wrong types, out-of-range values and uninitialized records, including in weak
caller mode.

Records, variant cases, `Some`, `Ok`, `Err` and `Bytes` expose `equals($other)`
and `hashCode()`. Comparisons preserve constructor identity and nested contents
without PHP's loose numeric-string coercion. NaNs compare equal; signed zeros
differ. Matching values produce matching 64-character hexadecimal hashes.
PHP's `==` and `===` operators retain their built-in meanings.

Comparison and hashing enforce 32 nesting levels and a 16 MiB traversal budget.
Traversing cycles, uninitialized fields, foreign objects, resources or non-list
arrays rejects. Hashes are not a serialized value format or proof of equality.
Do not mutate referenced payloads while using their hash as a lookup key.

## Installation and reproduction

Each original ZIP installs offline through Composer with an empty cache and
configuration directory. Composer installs the pinned `brick/math` 1.0.0
dependency. The test removes producer sources before installation and removes
the package handoff and install staging before execution. Weak and strict
callers run repeatedly after relocation with compilers unavailable, runtime
overrides disabled and the installed libraries verified.

Both independent builds produce identical archives, all 25 package-owned files,
native libraries and public results. Four Composer-generated deployment files
carry installation-specific identities and differ between installations.
The record does not claim byte-identical complete deployment directories.

The exact [`collections.php` documentation example](../php.md#arrays-and-records)
runs inside every installed caller. Its output is:

```text
[[],[3,2,1]]
3
42
equal
```

## Validation and cleanup

FFI declarations preserve raw Bool and Int-sign bytes until validation. Unit
must be zero; Bool and integer signs must be canonical. Integer magnitudes reject
negative zero, redundant high zero limbs, oversized lengths, missing buffers and
misaligned pointers before reading memory.

Host-only conversion probes pass 1,665 checks and reject 803 malformed values.
Equality and hashing probes pass 6,293 checks and reject 56 invalid values in
each of the FFI, Zend32 and Zend64 public projections. These probes load no Lean
library and do not establish installed PHP-Wasm support.

Separate processes instrument copies of the installed native PHP helpers in
memory. Each source path exercises 1,354 injected conversion/allocation failures,
64 partially invalid inputs and 516 malformed-output cases. The probes verify
that tracked FFI owners and scopes are released, owned output is cleared exactly
once, and subsequent public calls succeed. They leave all installed files
unchanged and repeat the original public callers afterward. This is PHP
conversion and scratch-allocation evidence, not a new native allocator or
sanitizer run.

Installed callable, compound, List, alias, variant and baseline native PHP
regressions also pass. The machine record includes their test identities and
logs.

## Scope

Installed checks use PHP 8.2.33 NTS CLI on Linux x86-64 and local glibc 2.36.
Distributed packages retain their declared platform floor. The shared helpers
also pass host-only Zend projection checks; PHP-Wasm collection installation
remains a separate acceptance task.

Inventory 0.74.0 assigns this evidence to 22 reviewed native PHP positions:
Array and record inputs, results and fields, plus sixteen primitive field
positions. UInt32 field support was already recorded, so this adds 21
installed-tested cells. Ordinary-source positions keep their existing evidence.
Recursive copied data, compound callable payloads and explicitly owned aggregates
remain open.

Reproduce the native collection and host checks with:

```sh
LEAN_BRIDGE_PHP_COLLECTION_TEST=1 node --test tests/php-collections.test.mjs
LEAN_BRIDGE_PHP_CONVERSIONS_TEST=1 node --test tests/php-collection-conversions.test.mjs
LEAN_BRIDGE_PHP_EQUALITY_TEST=1 node --test tests/php-value-equality.test.mjs
node --test tests/php-collection-contract.test.mjs tests/php-collection-evidence.test.mjs
```
