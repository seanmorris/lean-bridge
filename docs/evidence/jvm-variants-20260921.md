# Installed Java and Kotlin tagged variants, 21 September 2026

Prepared Maven packages expose each copied Lean variant as a sealed Java
interface with a public record for each constructor. Java `switch` and Kotlin
`when` can match these cases exhaustively. Consumers use named constructors and
typed fields without numeric tags, FFM layouts or native allocation code.

The [machine record](jvm-variants-20260921.json) binds the original JARs, POMs,
installed files, independent consumer sources and fault probes to their hashes.
It covers Linux x86-64 with JDK 22.0.2, Kotlin 2.2.0 and glibc 2.36. The normal
Maven release profile keeps its documented platform requirements.

## Installed checks

Both ordinary-source and independently reviewed Binding IR builds export
fourteen functions across seven variant families and eighteen constructors.
Each build supplies the same original Maven archive to separate Java and Kotlin
consumers. Each public execution passes 209,998 assertions over 4,331 calls,
including thirty-three rejected inputs followed by successful recovery.

The handwritten consumers check all nineteen primitive payload types, nested
variants, records, arrays, options, results and binary products. Cases include
5,121-bit integers, floating-point bit patterns and signed zero, Unicode and
embedded NULs, empty constructors distinct from `Unit` payloads, anonymous
payload names and independent copied storage. Four threads execute 256 calls.
Public reflection checks exact method signatures, record components and sealed
families. Expected constructor values do not come from the generated layouts.

Each language also rejects ten invalid programs at their intended source
locations. These cover wrong families and payload types, missing fields,
abstract base construction, attempts to extend the closed family, incomplete
matches, private runtime access, component assignment and incorrect array
nesting. Valid Java and Kotlin programs compile with warnings treated as errors.

Installation uses an offline Maven repository and empty user home after the
author project is removed. The test checks the prepared dependency closure and
resolved classpath. It removes consumer sources and the archive handoff before
running the relocated application twice with a private `java.base`-only runtime.
The original JAR and native library hashes remain unchanged. Normal JVM exit
removes extracted native scratch files.

Two independent builds reproduced each original JAR, POM, generated source and
installed file. The ordinary-source JAR has SHA-256
`4cd71157d5ffc3cd837659d3a0fef875398e3e92a71ce00e2a6ecdc0a3867e0e`;
the reviewed-IR JAR has SHA-256
`2f7956a8bcba0fb92d9770787b15f7fb38c8e6ab04848eb3df58d94ff1fa547f`.
These are local acceptance packages, not Maven Central publications.

## Cleanup and invalid native values

An isolated copy of the verified Java sources adds failure checkpoints without
changing the release JAR. It recovers from 212 conversion/allocation failures
and sixty-four partial-input failures, checks that scoped arenas close and that
native output cleanup runs once when required. Seven malformed native tags
reject before accessing a union payload. Six poisoned inactive cases remain
unread. The single-constructor family has no inactive branch to exercise.

The shared real-Lean native probe passes 1,182 checks, including 242 allocation
failures, seventy invalid inputs and an injected invalid native tag. Address
and undefined-behavior sanitizer checks pass. LeakSanitizer reports the same
128 bytes in twelve GMP allocations as the startup-only baseline, with no
additional leaks after conversions.

## Value semantics

Record components are final, but arrays inside them remain mutable. The bridge
copies payload storage at the boundary. Java record equality compares array
references, so callers should use explicit array comparisons for content
equality. Kotlin sees the same generated Java records and platform types; null
cases and active null payloads are invalid.

Constructor names combine the family and case names. Payload names use camel
case, preserve trailing underscores and escape Java keywords. Naming collisions
fail during generation. An empty case and a case carrying generated `Unit` are
distinct constructors.

Only concrete, non-recursive copied variants are admitted. Generic, indexed,
proof-bearing, callable and identity-bearing payloads remain outside this
profile. The existing 32-level type limit and separate 16 MiB managed/native
conversion budgets do not bound all JVM allocations or Lean working memory.

## Reproduce

Install the repository's pinned native and JVM tools, then run:

```sh
source scripts/env.sh
LEAN_BRIDGE_JVM_VARIANT_TEST=1 node --test tests/jvm-variants.test.mjs
node --test tests/jvm-variant-contract.test.mjs tests/jvm-variant-evidence.test.mjs
```

The installed test writes `build/variants/jvm.json`. The managed CI job requires
that report and uploads it with the other JVM acceptance records. This milestone
promotes twelve copied-variant positions across Java and Kotlin, on both source
paths. It does not promote recursion, compound callables or identity aggregates.
