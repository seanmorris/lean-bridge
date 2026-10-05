# Kotlin collections and companion API acceptance

The Maven package contains both APIs: the original Java API and generated Kotlin
classes in a `.kotlin` subpackage. The Kotlin API carries non-nullable type
metadata, typed `val` properties and named accessors. Its private adapter shares
the Java loader, native runtime, callback owners and cleanup machinery.

The [machine-readable receipt](kotlin-collections-20260922.json) records original
archive identities, installed files, compiler diagnostics, runtime observations,
fault probes and source hashes. Historical JVM receipts retain their original
bytes. The new receipt records source changes and fresh regression results
separately.

## Installed collections

The fixture has 35 exports, all nineteen primitive types, seven record shapes
and 24 explicitly typed array levels. Java and Kotlin consumers install the same
JAR and POM from each of two builds: ordinary Lean source and an independently
reviewed contract.

Each Kotlin execution passes 158,334 assertions over 4,435 public calls and thirty
rejected malformed inputs. The companion Java execution retains 158,171
assertions and the same call/rejection counts. Eight invalid programs per
language fail compilation for their intended types. No valid collection caller
uses erased values, reflection or a reduced nesting depth to bypass Kotlin's
type checker.

Consumers install offline into empty Maven repositories and use the resolved
dependency classpath. The POM brings in Kotlin's standard library automatically.
After compilation, the test relocates the package, dependencies and consumer
classes, removes source and handoff directories, and runs twice using only the
`java.base` runtime module. It executes the exact Kotlin guide example and checks
its output: `[[], [3, 2, 1]]`, `3`, then `42`.

Independent rebuilds compare all 77 installed package files, archive hashes,
native libraries, resolved dependencies, deployed classes and observations.
The Java and Kotlin consumers use the same archive on each source path.

## Validation and cleanup

Instrumented copies of the private Java and Kotlin projections each exercise
679 conversion/allocation failures and 64 partial-input failures. They check that
all arenas close and native outputs clear exactly once, then make successful
recovery calls. The Kotlin probe uses the compiled public Kotlin API from the
original release JAR. The release archive itself stays unchanged.

Host-only converter tests reject 562 malformed native values across 984 checks
without loading a native library. Equality tests perform 32,069 Java and 15,642
Kotlin-interoperability checks across five generated projections. These are host
tests, not additional Lean execution claims.

The compiler preflight checks every collection export, keyword-named fields and
records whose names overlap Kotlin annotations. Kotlin and Java callers cannot
access the private erased bridge.

## Existing JVM surfaces

Fresh installed regressions retain the original Java and Kotlin-interoperability
consumers. Additional consumers exercise the companion Kotlin API on both source
paths:

| Surface | Existing assertions per execution, Java / Kotlin | Additional Kotlin API checks |
| --- | ---: | ---: |
| Primitive callables | 66,683 / 66,655 | 118 |
| Options, results and products | 36,872 / 36,872 | 1,588 |
| Lists | 91,674 / 91,696 | 122 |
| Copied aliases | 3,711 / 3,711 | 103 |
| Tagged variants | 209,998 / 209,998 | 25 |

The compound caller preserves a fully typed 24-level `Option`. Immutable
covariant type parameters avoid the compiler's expansion of deeply nested
invariant types. Callable checks pass owners between the Java and Kotlin APIs,
close returned functions, preserve the original callback exception and reject
invalid callback results.

The four-test native Maven suite also passes: deterministic generation,
admission checks, reproducible Maple/Cedar builds and installed execution,
cross-package callbacks, shared runtime loading, tamper rejection and cleanup
after compiler failure.

Earlier evidence remains available for [Java collections](java-collections-20260922.md),
[compounds](jvm-compounds-20260920.md), [Lists](jvm-lists-20260920.md),
[aliases](jvm-aliases-20260921.md), [variants](jvm-variants-20260921.md) and
[callables](jvm-callables-20260919.md).

## Reproduce

Select JDK 22.0.2, Kotlin 2.2.0 and Maven with the documented
`LEAN_BRIDGE_JAVA`, `LEAN_BRIDGE_JAVAC`, `LEAN_BRIDGE_KOTLINC`,
`LEAN_BRIDGE_KOTLIN` and `LEAN_BRIDGE_MAVEN` paths. Run native suites serially
with at least 4 GiB free before each build.

```sh
LEAN_BRIDGE_JVM_COLLECTION_TEST=1 \
  LEAN_BRIDGE_JVM_COLLECTION_PROFILES=java,kotlin \
  node --test tests/jvm-collections.test.mjs
LEAN_BRIDGE_JVM_COLLECTION_PREFLIGHT=1 \
  node --test tests/jvm-collection-callers.test.mjs
LEAN_BRIDGE_JVM_CONVERSIONS_TEST=1 \
  node --test tests/jvm-collection-conversions.test.mjs
LEAN_BRIDGE_JVM_EQUALITY_TEST=1 \
  node --test tests/jvm-value-equality.test.mjs
node --test tests/kotlin-collection-evidence.test.mjs tests/jvm-kotlin-contract.test.mjs
```

The receipt records Linux x86-64, JDK 22.0.2, Kotlin 2.2.0 and a local glibc 2.36
test floor. The published native profile keeps its glibc 2.38 floor. Copied values
have a 32-level schema limit and separate 16 MiB managed/native conversion budgets;
these do not bound all JVM allocations or Lean working memory. Recursive copied
data, compound callable payloads and explicitly owned aggregates remain open in
VO 1219.
