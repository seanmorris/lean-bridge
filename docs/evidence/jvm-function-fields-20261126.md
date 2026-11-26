# Retaining and returning functions from an installed Maven package

The [Java application](../../tests/fixtures/jvm-tariff/JavaTariff.java) and
[Kotlin application](../../tests/fixtures/jvm-tariff/KotlinTariff.kt) each
compiled against `org.leanbridge:tariff-quotes:1.0.0` and ran in a separate
process on a relocated Java 22 runtime containing only `java.base`. The
installer resolved dependencies from an offline Maven repository, checked the
installed JAR and POM against the receipt, and deleted that repository before
executing either client. The applications needed neither Maven nor Lean.

| Source | Installed record | What authenticates it |
| --- | --- | --- |
| Ordinary Lean exports | [Execution and archive hashes](jvm-function-fields-20261126/ordinary.json) | The installed model and receipt identify the same compiled interface. |
| Independently reviewed interface | [Execution and archive hashes](jvm-function-fields-20261126/reviewed.json) | The same checks, plus the author's reviewed interface bytes, independently hashed. |

Both languages constructed a Tariff, passed it through Lean, and called its
function after closing the input. They separately retained a field and
repacked a function using `asCallback()`. A call-borrowed lambda placed in a
returned record expired: invoking the field directly or through Lean returned
status 10 without entering the lambda. Passing a closed function as a field
was refused with status 4.

A host callback could also **return a function directly** for Lean to use.
When another callback allocated a temporary function, closed it and threw,
the caller caught the original exception, then invoked both the saved
function and its recovery value successfully.

In all four runs, the test observer saw **1 live native identity** on the
initialized owner thread, **4** with a retained function, **1** after each
field and failure scenario, and **0** after that thread exited. The
[observer](../../tests/fixtures/jvm-tariff/Ownership.java) reads the broker
the installed package loaded. No GC timing or second broker is involved.
These are scalar function fields, not durable registrations of host lambdas.

Run `npm run test:jvm-function-fields` with the native Lean toolchain, GNU m4,
JDK 22 (`JAVA_HOME`), Kotlin 2.2.0 (`LEAN_BRIDGE_KOTLIN_HOME`), Maven
(`LEAN_BRIDGE_MAVEN`, or `mvn` on PATH), and the [offline Maven plugin and
stdlib seed](jvm-host-imports-20261124.md) at `LEAN_BRIDGE_JVM_IO_M2_SEED`.
Set `LEAN_BRIDGE_JVM_TARIFF_KEEP` to an existing directory to retain the
archives. Set `LEAN_BRIDGE_JVM_TARIFF_REPLAY` to the reported handoff directory
instead to repeat both clean installations without rebuilding the packages.
