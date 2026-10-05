# Recursive Java native conversions

The [execution record](jvm-recursive-conversions-20260923.json) binds the generated
Java converters, independent C fixtures, test callers and fresh Lean builds.
These tests exercise native calls, not installed Maven packages. Java's recursive
installed-support inventory remains unchanged.

## Layout and copying

Java FFM layouts and a C compiler independently check 478 sizes, alignments and
field offsets against the generator's numeric layout. Iterative readers and
writers preserve primitive values, records, sealed constructor families, typed
arrays, Lists, nested Options and Results, binary products and transparent
aliases. A 700-record catalog checks generated method sizes. A separate catalog
uses public names such as `Math`, `MemorySegment` and `OutOfMemoryError` to check
that they cannot capture JDK classes or private converter types.

Every argument validates before native scratch allocation or Lean initialization.
The converter rejects cycles, null payloads, out-of-range unsigned integers,
negative Nat, invalid Unicode and uninhabited values. Strings preserve NUL and
Unicode scalar values; Nat and Int use canonical unsigned magnitude words plus
the Int sign. Malformed output flags, tags, UTF-8, magnitudes and pointer spans
fail before the result reaches the caller.

Inputs and outputs share a maximum depth of 128, 262,144 value visits, a 16 MiB
native-copy budget and a separate 16 MiB accounted scratch/output budget. These
budgets do not measure Lean working memory or every JVM object overhead. The
native adapter supplies readable memory; pointer bounds and alignment checks do
not make arbitrary foreign addresses safe to dereference.

## Calls into Lean

Ordinary source extraction and an independent reviewed contract each compile a
fresh Lean component with 18 exports. Java executes the inhabited signatures
and rejects an invalid `Never` argument before calling Lean. Lean independently
inspects all 19 scalar fields. The callers also check mutable-array copy isolation, empty
constructors, nested options and errors, mutual recursion, 127-level values and
a 256-field recursive constructor built through the generated typed builder.
Each source path checks 455 native layout observations.

Both paths run four separate JVM processes. Each process injects failure at all
28 native allocation points and both an allocation error and interruption at all
181 Java checkpoints. The Java failures cover 70 input and 111 output checkpoints.
The tests check every tracked scratch segment is closed and the native allocation
ledger is empty after each failed call. Allocation failures leave the runtime
usable.

The four processes exercise malformed Lean carriers, malformed native tags,
cyclic native output and retirement during result conversion. Malformed output
retires the shared runtime. Retirement during conversion prevents publishing a
partial result. Subsequent calls fail before decoding, while a previously owned
result can still be released twice safely.

Java calls a pre-bound C cleanup helper from `finally`. It reads and clears only
the result's owner and release fields, so cleanup does not traverse malformed
children or allocate a new Java function handle. The outer confined arena closes
even when copying fails.

## Reproduction

```sh
LEAN_BRIDGE_JVM_GRAPH_CONVERSION_TEST=1 \
LEAN_BRIDGE_JVM_GRAPH_NATIVE_TEST=1 \
  node --test tests/jvm-copied-graph-conversions.test.mjs
```

JDK 22 compiles with warnings treated as errors. Execution uses a 256 KiB stack.
CI retains `build/recursive/jvm-conversions.json` and
`build/recursive/jvm-native.json`. The [Java/Kotlin package tests](../contributing/testing.md#recursive-java-and-kotlin-packages)
separately check Maven packaging, source-free calls and shared-package loading.
Kotlin reuses these layouts, scalar codecs and iterative conversion routines
with its own typed value catalog.
