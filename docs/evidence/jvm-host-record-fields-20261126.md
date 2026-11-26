# Application objects in Maven records

Java and Kotlin can pass a public `Pair<Meter>` to compiled Lean code. Lean can
return a record with its fields rearranged or return a function that remembers
both meters. In either case the application gets **the original objects**, not
copies or proxy instances. The fixture deliberately gives its two distinct Java
meters the same `equals` and `hashCode` results.

| Caller | What the installed application observes |
| --- | --- |
| [Java](../../tests/fixtures/jvm-host-record/Installed.java) | Two borrowed records in one call, copied byte arrays, a 131-bit natural number, validation of the second record before the first meter read, and the exact original exception from a host method. A second copied field exceeds the shared 16 MiB budget after the original meter has already been exported. The weak reference clears and the same binding works again. |
| [Kotlin](../../tests/fixtures/jvm-host-record/Installed.kt) | Typed properties, `===` identity, independent byte arrays, a 136-bit natural, a closure that outlives the input record, and a record that remains readable after the binding closes. Closing the record invalidates its getters. |

The Java client also observes both weak references while only the Lean closure
keeps the meters alive, then observes their collection after it closes.
Independent negative compilations reject [Java's `Pair<Object>`](../../tests/fixtures/jvm-host-record/WrongMeter.java)
and [Kotlin's `Pair<Any>`](../../tests/fixtures/jvm-host-record/WrongMeter.kt)
at a `Pair<Meter>` parameter.

The [installer](../../tests/helpers/jvm-host-record-installed.mjs) selects
the same [Lean definitions](../../tests/fixtures/dotnet-host-record/Workshop.lean)
as the NuGet check, substituting the JVM host import. It packs the authoring
CLI, publishes the Maven handoff, verifies the receipt, restores offline and
relocates the Maven repository. Java and Kotlin run in separate JVMs with
JNI checking enabled and no build tools on the executable search path.
The reviewed interface changes field documentation; reversing its fields must
fail before a release is written.

| Route | Package archives | Execution |
| --- | --- | --- |
| Ordinary | [JAR/POM receipt](jvm-host-record-20261126/ordinary.package-set.json) | [Installed clients](jvm-host-record-20261126/ordinary.execution.json) |
| Reviewed | [JAR/POM receipt](jvm-host-record-20261126/reviewed.package-set.json) | [Installed clients](jvm-host-record-20261126/reviewed.execution.json) |

Use `npm run test:jvm-host-records` on a Linux x86-64 producer configured with
Lean, JDK 22, Kotlin 2.2 and Maven. Set `LEAN_BRIDGE_KOTLIN_HOME` to the
compiler distribution and `LEAN_BRIDGE_JVM_IO_M2_SEED` to a prerequisite-only
Maven repository. Populate that repository with the dependency and install
plugins and Kotlin standard library from
[prerequisites.xml](../../tests/fixtures/jvm-sync-io/prerequisites.xml),
not with the component under test. These are synchronous, flat application
records; these results do not establish an EIO record payload or async record delivery.
