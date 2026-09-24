# Recursive Java value declarations

Java has a finite value-type generator for recursive copied data. Native
conversion and installed Maven acceptance have separate checks in VO 1219.
The [execution record](jvm-recursive-values-20260923.json) does not promote
installed type coverage.

Named records expose typed components. Variants use sealed interfaces and named
record cases, so Java pattern switches can check exhaustiveness. Arrays and Lists
retain typed Java arrays; transparent aliases resolve to their target type and
retain their source name in metadata. Option, Result and Pair preserve active
payloads, nested absence, Unit and binary product nesting.

The JVM limits a constructor to 255 argument slots, including its receiver;
long and double parameters each consume two slots. Values exceeding that limit
use an immutable final class with typed accessors and a typed builder. The builder
requires every field before construction. Tests compile both sides of the limit
and execute the original 256-field recursive constructor without losing fields.

## Value behavior

Equality and hashing walk values iteratively. They compare active payloads,
nominal constructor identity and array contents, including covariant reference
arrays. A shared acyclic subtree equals independent copies of that subtree.
Java floating-point behavior is preserved: NaNs compare equal and signed zeros
differ. Array contents remain mutable; do not change them while a containing
value is a map key or set member.

Comparison rejects cycles, more than 128 levels, more than 262,144 node visits,
or more than 16 MiB of scalar data. It continues after unequal fields so a later
cycle cannot hide behind an early mismatch. Formatting uses the same traversal,
caps output at 4,096 characters plus a truncation marker, and abbreviates large
integers before decimal conversion.

Type generation bounds structural expansion to 32 container levels and 65,536
characters per type, with a 4 MiB source budget. A chain of 700 transparent
aliases remains finite. Public names cannot collide with emitted helpers, and
private traversal classes do not shadow nominal types named Frame, Entry or
Cursor. No public numeric-tag or native-layout accessor is introduced.

## Executed checks

```sh
LEAN_BRIDGE_JVM_GRAPH_TEST=1 \
  node --test tests/jvm-copied-graph-values.test.mjs
```

The test compiles generated Java 22 declarations and a separate consumer with
all lint warnings treated as errors. The consumer runs with a 256 KiB stack.
It exercises every scalar representation, direct and mutual recursion, recursive
records, nested compounds, a 32-level array field, wide builders, pattern
matching, equality, hashing, mutation, shared subtrees, cycles and budget limits.
Eleven invalid consumers must fail compilation, including an external variant
case and attempts to call private traversal methods.

CI runs this check and retains `build/recursive/jvm-values.json`. No Lean library
loads during these declaration checks. The [native conversion checks](jvm-recursive-conversions-20260923.md)
and [Java/Kotlin package tests](../contributing/testing.md#recursive-java-and-kotlin-packages)
cover the later stages; this declaration record does not stand in for them.
