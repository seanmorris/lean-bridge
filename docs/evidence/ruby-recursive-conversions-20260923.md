# Ruby recursive native conversions

The Ruby adapter calls compiled Lean with finite recursive copied values.
Records and constructors use the frozen, keyword-initialized classes from the
[declaration milestone](ruby-recursive-values-20260923.md). Arrays and Lists use
Ruby Arrays. `nil`, `Some.new(nil)` and `Some.new(UNIT)` remain distinct, and
`Ok` and `Err` preserve their branches. Callers receive independent Ruby values.

## Conversion and cleanup

Private Fiddle buffers follow the checked C graph layout, including alignment,
variant unions and recursive pointers. The adapter validates Bool and Unit
bytes, Char scalars, tags, flags, integer signs, UTF-8 and span shapes before
constructing public values. Captured builtin methods inspect exact classes and
stored fields without calling overridden instance accessors.

All arguments validate before native allocation or runtime initialization.
The adapter then makes bounded String and Array snapshots and copies the inputs
into scoped native buffers. Callers must not mutate inputs during conversion.
Numeric coercion, subclasses, incorrect constructors, cycles and uninhabited
copied types are rejected.

Input and output conversion share a 262,144-node allowance, maximum depth 128
and a 16 MiB native-copy budget. A separate 16 MiB allowance accounts for
conversion storage. These allowances do not bound the Lean algorithm's working
memory or every Ruby allocator overhead.

An `ensure` block releases the native result and temporary buffers, including
when conversion raises `NoMemoryError` or `Interrupt`. Cross-thread exceptions
are deferred until cleanup finishes. The caller binds the C cleanup function
before invocation, so releasing an owned output needs no new Fiddle function
wrapper. Cleanup reads only the root ownership header and clears it before
release; it does not follow malformed child tags.

Malformed native output retires the runtime. Validation, budget and recoverable
allocation failures leave it usable. The adapter checks runtime readiness
before returning the copied result. Previously retained native outputs can
still be released after retirement.

Native spans must reference readable memory from the authenticated adapter.
Alignment and overflow checks cannot validate arbitrary process addresses.
This implementation targets MRI Ruby 3.3 on little-endian Linux x86-64.

## Verification

The [recorded results](ruby-recursive-conversions-20260923.json) bind the tested
sources and distinguish isolated C interop from compiled Lean execution.

The isolated suite passes 2,612 assertions, including 478 independently compiled
C size, alignment and field-offset checks. It exercises all nineteen scalar
types, direct and mutual recursion, nested options/results, wide constructors,
empty and uninhabited types, malformed outputs, cycles and shared budgets.
It injects `NoMemoryError` and `Interrupt` at 231 conversion checkpoints, then
checks native owner counts and that temporary pointers were freed. Separate
cross-thread interruption checks cover input conversion and output decoding.

The compiled suite builds ordinary Lean source and an independently reviewed
contract, each with eighteen exports. A Lean predicate checks every scalar
field. Tests cover 1,001-bit integers, Unicode and embedded NUL, IEEE values,
recursive aliases, nested containers and depth-growing output.

Each source path runs three fresh processes: malformed Lean carriers, malformed
raw output, and retirement before result publication. Every process passes
1,553 assertions, including failures at all 28 native arena allocation sites
and 157 Ruby conversion checkpoints. Retained native outputs remain releasable
after retirement, and a second clear is harmless.

```sh
source scripts/env.sh
LEAN_BRIDGE_RUBY_GRAPH_TEST=1 LEAN_BRIDGE_RUBY_GRAPH_NATIVE_TEST=1 \
  node --test tests/ruby-copied-graph-conversions.test.mjs
```

CI requires both suites and retains their reports. The subsequent
[prepared gem milestone](ruby-recursive-packages-20260923.md) verifies
authenticated loading, process/fork checks, source-free offline installation
and reproducible archives. These conversion checks themselves promote no
installed cells.
