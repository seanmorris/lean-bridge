# Compiled Java and Kotlin options, results and products

VO1219 adds `Option`, `Except` and nested binary products to prepared Maven
packages. Ordinary-source and independently reviewed-IR builds compile the
same 64-export Lean fixture. Java and Kotlin use the same JAR on each path.
Payloads support all nineteen primitives, arrays, acyclic copied records and
these constructors within the 32-level type limit.

| Lean | Java and Kotlin |
| --- | --- |
| `Option T` | `Option.none()` or `Option.some(value)` |
| `Except E T` | `Result.ok(value)` or `Result.err(error)` |
| `A × B` | Generated `Pair<A, B>` record |

Sealed interfaces and record branches retain typed payloads.
Primitive generic arguments use boxed JVM types. Generated `Result<T, E>` puts
the success type first. Inactive payload access throws `IllegalStateException`;
factories and record constructors reject null payloads. Calls reject null
containers. `Some(None)` and `Some(Some(Unit))` remain distinct. Both languages
can exhaustively match branches. Kotlin uses the generated `Pair` and `Result`,
not the Kotlin standard-library types.

Inputs are copied and returned arrays own independent storage. Record equality
uses reference equality for array fields. Private native flags, layout and
runtime loading stay out of the public API. The adapter reuses the typed Lean
constructors and projection helpers from the
[native compound implementation](native-compounds-20260920.md).

## Installed validation

```sh
LEAN_BRIDGE_JVM_COMPOUND_TEST=1 node --test tests/jvm-compounds.test.mjs
node --test tests/jvm-compound-contract.test.mjs
```

The [machine-readable record](jvm-compounds-20260920.json) retains package,
receipt, source, compiler, deployment and probe hashes. Independent Java and
Kotlin consumers each pass 36,872 assertions on each source path with JDK
22.0.2, Kotlin 2.2.0 and Maven 3.9.11. The test removes the producer workspace
before installing the original JAR/POM offline into an empty Maven repository.
Consumers compile against only the resolved public package and, for Kotlin,
its standard library. Compiler warnings fail the checks.

Cases cover exact 5,121-bit integers, fixed-width limits, floating-point edges,
Unicode and NUL, every byte value, nested Unit options, both result branches,
arrays and record fields. Consumers independently check all primitive function
signatures, 24-level nested option types, absent values at each level, output
independence, exhaustive branch matching and concurrent copied calls. Invalid
inputs and oversized copies reject without breaking later calls. Ten Java and
eleven Kotlin programs must fail with the expected source-located compiler
diagnostics, including wrong payloads, boxed widths and product shapes.

The test verifies installed classes and native assets against the receipt,
removes the consumer source/build/cache trees and relocates the deployment.
Each consumer repeats its assertions twice with a `java.base`-only runtime,
no compiler and `PATH=/unavailable`. Deployed-file hashes remain unchanged.
Native extraction directories must be empty after normal exit.

## Cleanup probes

Each source path also runs a separate instrumented copy of the verified Java
adapter. It uses the packaged native libraries without changing the release
JAR. The probe injects 140 conversion and scratch-allocation failures, checks
that every scoped arena closes, verifies one output clear per native call and
requires the next call to succeed. Sixteen partial-input failures check cleanup
before native invocation. Nine malformed-output checks reject flags other than
zero or one and ignore poisoned inactive payloads. Both original and
instrumented source hashes are recorded. Java and Kotlin share this adapter;
the two source-path probes are not counted again for Kotlin.

Managed input copying has a 16 MiB accounting budget. Native copying shares a
separate 16 MiB budget across inputs and outputs. These budgets do not bound
every managed allocation or Lean working memory. Local acceptance uses Linux
x86-64 with glibc floor 2.36; CI builds the supported 2.38-floor packages.

This milestone promotes 36 profile/path/type/position cells: options, results
and products in inputs, results and fields through both source paths in Java
and Kotlin. Compound callables, lists, distinct-runtime aliases, tagged
variants, recursive copied types and resource-containing copies remain
separate work.
