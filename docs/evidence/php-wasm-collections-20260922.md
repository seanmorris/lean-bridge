# PHP-Wasm arrays, records and value comparison

The [machine record](php-wasm-collections-20260922.json) binds two independent
builds to original npm and Composer archives, installed files, public callers,
the executable documentation example and separate Zend fault probes. Both builds
cover ordinary Lean source and independently reviewed IR.

## Installed public calls

Each configuration passes 191,569 assertions across 4,330 public calls and
73 rejected inputs. The unchanged shared Lean fixture has 35 exports,
nineteen primitive element types, seven record types and a 24-level nested Array.
Independent Lean inspectors check the field and element contents rather than
relying only on round trips through the converters.

Each source path runs twelve configurations: Node with embedded npm PHP files,
Node with the companion Composer installation, and a bundled Chromium page,
each using startup or first-call loading and weak or strict PHP. Every
configuration executes twice. Invalid calls leave first-call libraries unloaded;
the first valid call loads one shared Lean runtime and one component.

Arrays use consecutive integer keys. Records are final readonly classes with
their original Lean field names, order and declared types. Keyword class names
gain an underscore, such as `Empty_`. Constructors reject extra arguments, wrong
classes, invalid values and uninitialized fields. Returned arrays, records and
byte buffers have independent storage.

On wasm32, `UInt32`, `UInt64`, `Int64`, `Nat`, `Int` and `USize` use
`Brick\Math\BigInteger`. `ISize` uses a signed 32-bit PHP integer. These mappings
apply inside arrays and record fields. Weak callers do not coerce their inputs.

Records and `Bytes` compare nested contents through `equals` and produce matching
`hashCode` values. NaNs compare equal; signed zeros differ. PHP's `==` and `===`
keep their built-in meanings. Comparison and hashing enforce 32 nesting levels
and a 16 MiB traversal budget. Do not mutate referenced payloads while using
their hash as a lookup key.

The exact [`collections.php` guide example](../php.md#arrays-and-records-on-wasm32)
runs inside every installed caller. Its output is:

```text
[[],["3","2","1"]]
3
42
equal
```

Both the npm and Composer packages include the same value-comparison guidance.

## Installation and reproduction

Producer sources are removed before offline npm and Composer installation.
Installation starts with empty caches and configuration directories. Composer
installs the pinned `brick/math` 1.0.0 dependency. The tests remove the handoff
and installation staging, relocate the deployment and run with compilers and
runtime overrides unavailable.

The two independent builds produce identical original archives, all 100 packaged
files, compiled libraries and public observations on each source path. Node
executions leave the installed deployment unchanged. Chromium requests stay
within the local deployment and match its recorded file hashes. This comparison
covers package-owned bytes, not installation-specific Composer deployment files.

## Output validation and cleanup

Unit markers must be zero. Bool and integer-sign bytes must be canonical before
conversion to booleans. Big-integer lengths, pointers, alignment and Wasm memory
bounds are checked before limb reads. Negative zero and redundant high zero
limbs reject. String, byte-buffer and native error-message reads also check Wasm
memory bounds. Empty buffers do not dereference their pointers.

Separate synthetic C providers run through the real wasm32 Zend adapter. In
each weak and strict caller, they pass 7,216 checks covering:

- 456 injected allocation failures.
- 32 partially converted inputs and 120 malformed wire inputs.
- 81 malformed outputs, including bad scalar markers and invalid buffers.
- Twelve empty buffers with unusable pointers.
- Two PHP request bailouts followed by successful calls in the same host.

Tracked scratch and native allocations return to zero. Every entered native
call clears its output exactly once, including partial conversion failures.
Synthetic probes do not execute Lean and do not replace the installed-package
checks above.

The machine record also retains fresh List, compound, alias, variant, callable
and baseline PHP-Wasm regression results. Historical receipts keep their original
bytes; the new regression probes identify the current output converters.

## Scope

Installed checks use PHP-Wasm 0.1.0 with PHP 8.4.1, wasm32 and the default Node
and Chromium host variant. Schema nesting stops at 32. PHP validation, Zend
conversion and native copying each have a 16 MiB accounting limit, not a bound
on all PHP allocations or Lean working memory.

Inventory 0.75.0 assigns this evidence to 22 reviewed PHP-Wasm positions:
Array and record inputs, results and fields, plus sixteen primitive field
positions. UInt32 field support was already recorded, so this adds 21
installed-tested cells. It does not promote Kotlin, WIT/WASI, recursive values,
compound callback payloads or explicitly owned aggregates.

Reproduce the installed and synthetic checks with:

```sh
LEAN_BRIDGE_PHP_WASM_COLLECTION_TEST=1 node --test --test-concurrency=1 \
  tests/php-wasm-collections.test.mjs tests/php-wasm-collection-zend.test.mjs
node --test tests/php-wasm-collection-contract.test.mjs \
  tests/php-wasm-collection-evidence.test.mjs
```
