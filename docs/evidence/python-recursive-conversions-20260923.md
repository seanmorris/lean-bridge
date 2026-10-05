# Python recursive native conversions

The Python adapter now calls compiled Lean with finite recursive copied values.
Records and constructors use the frozen dataclasses from the
[declaration milestone](python-recursive-values-20260923.md). Arrays and Lists
accept lists or tuples and return tuples. Options and results retain their
`Some`, `Ok` and `Err` constructors, including nested optional Unit values.
Callers see Python values, without native pointers or constructor numbers.

## Conversion and ownership

Private ctypes definitions match the checked C graph layout. Bool and Unit stay
bytes, and Char stays an integer, until validation. The decoder checks tags,
flags, integer signs, UTF-8, Unicode scalars and span shapes. Adapter helpers use
private built-in references where a public declaration could shadow Python's
`id`, `hasattr` or `UnicodeDecodeError`.
Public constructor references live in a private namespace so names such as
`scope` and `value` cannot collide with conversion-local variables.

All arguments validate before native view allocation or runtime initialization.
The adapter then validates and copies them into scoped input buffers before
calling Lean. Callers must not mutate inputs during conversion. Exact scalar
and constructor checks reject numeric coercion, Boolean integers, wrong
constructors, cycles and uninhabited copied types.

Inputs and outputs share a 262,144-node limit, maximum depth 128 and a 16 MiB
native-copy budget. A separate 16 MiB budget accounts for conversion storage.
The budgets cover the adapter's accounting, not the Lean algorithm's working
memory or every Python allocator overhead. String sizing stops at the remaining
UTF-8 allowance before allocating an encoded buffer.

The call's `finally` block releases the native root and clears all temporary
owners. Returned values retain no pointers into input or native buffers. Cleanup
also runs when conversion raises `MemoryError` or another `BaseException`.
Malformed native results retire the shared runtime; validation, budget and
recoverable allocation failures preserve its usability. The adapter checks
runtime readiness before publishing the copied result. Earlier owned native
outputs remain clearable after retirement.

Native spans must come from the authenticated adapter and reference readable
process memory. Alignment and overflow checks do not establish that arbitrary
addresses are readable. Cleanup uses the root's owner and release function,
without following malformed child tags.

## Verification

The [recorded results](python-recursive-conversions-20260923.json) bind the
generated sources and distinguish isolated C interop from compiled Lean calls.
Both suites run on CPython 3.11 with typing_extensions 4.6.0 and 4.16.0, and on
CPython 3.12 without that dependency.

The isolated suite independently compiles 478 C size, alignment and field-offset
checks. It exercises every constructor, optional and result recursive records,
malformed fields and spans, cycles, shared budgets, exact values and independent
copies. It injects allocation errors and interruptions at all 170 Python
checkpoints and checks that temporary buffers and native owners are released.
Public declarations named after Python built-ins have executable regressions.
Each Python environment passes 2,458 isolated checks.

The compiled suite builds ordinary source and an independently reviewed
contract. Eighteen exports cover all nineteen scalar types, 1,001-bit integers,
direct and mutual recursion, nested containers, aliases, optional/result
branches, empty and Unit constructors, a 255-field constructor and depth-growing
output. A Lean predicate independently checks every scalar field.

Each source path runs nine fresh processes: three Python environments crossed
with malformed Lean carriers, malformed raw output and retirement before result
publication. Each process passes 2,464 checks, including all 28 native arena
allocation sites and 170 Python checkpoints. The test retains another owned
native output across retirement and then releases it twice to check idempotence.

```sh
source scripts/env.sh
LEAN_BRIDGE_PYTHON_GRAPH_TEST=1 LEAN_BRIDGE_PYTHON_GRAPH_NATIVE_TEST=1 \
  node --test tests/python-copied-graph-conversions.test.mjs
```

CI requires both suites and their reports. These conversion checks do not by
themselves promote installed coverage cells. The subsequent
[prepared wheel milestone](python-recursive-packages-20260923.md) adds
authenticated automatic loading, offline installation, strict typing,
shared-runtime and fork checks, source-free execution and deterministic archives.
Those installed checks now pass and open recursive Python package admission.
