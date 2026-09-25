# Java and Kotlin structured callbacks

The original Maven archives support eight acyclic copied shapes in synchronous
callbacks and returned Lean closures: arrays, Lists, options, results, products,
records, variants and transparent aliases. Both ordinary Lean source and reviewed
Binding IR compile and execute independently typed Java and Kotlin consumers.

| Check per source path | Java | Kotlin |
| --- | ---: | ---: |
| Public assertions | 257,978 | 177,270 |
| Callable invocations | 3,072 | 3,072 |
| Runtime rejections | 807 | 789 |
| Compiler-rejected callers | 13 | 15 |
| Injected failures in separate probes | 8,396 | 8,396 |
| Failure-probe assertions | 836,813 | 836,813 |

The consumers compile against the installed JAR, not regenerated bindings. Java
uses typed functional interfaces and records. Kotlin uses its own value classes
and typed SAM interfaces. Compiler-negative cases check incompatible payloads,
container elements, nested branches, closure inputs and results, asynchronous
results and Java/Kotlin record confusion. Kotlin also rejects null records and
callbacks at compile time.

Each installation runs twice after its consumer project, package cache and
extracted sources are removed. A relocated deployment contains the original
JAR, compiled callers and Maven-resolved runtime dependencies. Execution uses a
`java.base`-only JDK 22.0.2 runtime without compiler tools. Both complete examples
from the [Java](../consume/java.md#structured-callback-values) and
[Kotlin](../consume/kotlin.md#structured-callback-values) guides run in that
deployment. The shared package handoff is removed before the Kotlin execution;
the Java execution does not claim handoff removal.

Private failure probes compile separately instrumented copies of the verified
installed sources and use the original archive's native libraries. They do not
replace the public installed JAR. Both an allocation error and a distinct host
error are injected at each observed conversion or acquisition checkpoint across
five paths for every shape. Cleanup allocations are not fault-injected. The
probes verify 10,042 cleared outputs, 2,384 lease disposals, 15 malformed values,
eight deferred-close cases and no remaining native identities, open arenas or
callback hosts. They check the original exception identity and successful calls
after failure.

Six independently generated predecessor packages remain byte-identical:
primitive callables, collections, compounds, Lists, aliases and variants. Fresh
primitive-callable installations pass 66,683 Java and 66,655 Kotlin assertions
per source path, including Kotlin metadata checks and compiler negatives.

The [execution record](jvm-structured-callables-20260925.json) retains the original
archive hashes, compiler diagnostics, probe observations and terminal test logs.
The [integration record](jvm-structured-callable-integration-20260925.json) binds
the source changes and exactly 64 newly accepted inventory cells. Existing
execution records are unchanged.

Recursive callback payloads, callback identities inside copied fields,
resource-containing aggregates and asynchronous delivery remain unsupported.
These copied callbacks retain the documented 32-type nesting limit and 16 MiB
native-copy and scoped-scratch budgets. Those budgets do not bound Lean working
memory or every JVM allocation.
