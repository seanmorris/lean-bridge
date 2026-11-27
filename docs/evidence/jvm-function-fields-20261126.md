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

### A function passed into a callback

Set `LEAN_BRIDGE_JVM_TARIFF_REQUIRE_INCOMING=1` to include `Owned.visitQuote`
on both authoring routes. The [Java](../../tests/fixtures/jvm-tariff/JavaIncoming.java)
and [Kotlin](../../tests/fixtures/jvm-tariff/KotlinIncoming.kt) clients test the
function itself as an argument, not a record containing one. A retained copy
compares equal to its live borrow; after callback return, calls and comparisons
on the original borrow must fail while the retained copy still works. A nested
failure must expire the inner borrow without invalidating the outer one.
The earlier function-field archives do not contain this export and cannot
qualify it.

Both clients ran against the ordinary compiled Lean component (`f47f1c5c…`)
through the generated Java and Kotlin APIs. In separate JVMs, the broker saw
one owner at baseline, three while the leases were held, one again after each
of six scenarios, and zero after thread exit. This is adapter execution with
real application clients, not an installed Maven release.

The [ordinary Maven installation](jvm-incoming-functions-20261127/ordinary.json)
subsequently passed on a relocated Java 22 runtime with only `java.base`.
Java and Kotlin each ran three separate applications. In the two incoming
function clients, failing the inner callback expired its borrow without
invalidating the outer one. Both processes recorded one live owner at
baseline, three while leases were held, one after recovery, and zero after
thread exit. The report identifies the installed JAR, its POM, all eight
client/observer source files and the six main classes. It covers the ordinary
route only.

### Forwarding an application function and exchanging Tickets

The [Java](../../tests/fixtures/jvm-tariff/JavaApplication.java) and
[Kotlin](../../tests/fixtures/jvm-tariff/KotlinApplication.kt) applications
supply their own price function and pass it through three public positions.
They distinguish a registration that has expired from one that is still
callable, including after a nested failure. The same applications pass
Tickets numbered 42 and 71 into a callback and return different Tickets
numbered 43 and 72. Lean reads the returned serial; neither result can
come from the recovery Ticket numbered 800.

- `npm run test:jvm-application-function-interfaces` compiles the two
  programs against the generated Java and Kotlin source with JDK 22
  and Kotlin 2.2.0. No installed-package coverage is awarded for this check.
- `npm run test:jvm-application-function-positions` builds both author
  routes, installs the Maven packages offline, and runs Java and Kotlin in
  separate processes on a compiler-free JRE. It checks the observed returns,
  the exact exception object, stale registration rejection, and zero owners
  after thread exit. Use the JDK, Kotlin and Maven settings above.
  `LEAN_BRIDGE_JVM_APPLICATION_KEEP` retains the two handoffs under a new
  directory; set `LEAN_BRIDGE_JVM_APPLICATION_REPLAY` to that directory to
  reinstall them without rebuilding. The older incoming-function and field
  packages do not contain these exports.
