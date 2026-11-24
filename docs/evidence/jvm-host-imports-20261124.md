# Checking a JVM host object's Lean interface

The compiler can now check a Lean project that imports an application-owned
JVM class. The test contract has a constructor, a method, a mutable property,
and a method that returns the receiver. No application-supplied object code
or Lean interface is used to validate those declarations.

With Lean 4.32.2 installed, set `LEAN_BRIDGE_LEAN_PREFIX` to its installation
directory and run `npm run test:jvm-host-imports`. The test compiles the
project once from ordinary source and again against a reviewed public
interface. Both routes produced the same public IR
(`868331aabdafc7968d82f02d2da5b3225ac4b63949c6cb9eafe70c1c8e1b13eb`)
and generated host-module C
(`ab6791f92f8bf2363b776436b825f13228c88daa3dc6f9d7df0a5605f77b1bb5`).

The checked interface distinguishes a leased host reference from a copied
value, records both the property read and write, and distinguishes an
escaping host exception from a Lean-mapped `EIO` error. A changed reviewed
member, a foreign native symbol, a different host scheduler, or a source
module shadowing the generated one is rejected.

## Calling Java from compiled Lean

Set `JAVA_HOME` to JDK 22 and run `npm run test:jvm-host-members` on Linux
with the same Lean installation and a C compiler. The first test binds a
public Java constructor, instance and static methods, and a JavaBean
property from the import contract. It checks observable mutation, nominal
object identity, copied byte arrays, Unicode, and numeric bounds. A bad
boundary value is distinguished from an exception thrown inside the method.

The second test compiles [a Lean caller](../../tests/fixtures/jvm-host-members/FrameCheck.lean)
and an actual JNI library. Both a platform thread and a virtual thread call
it. Java calls back into Lean on the serialized owner thread without a
deadlock. Two Java exceptions have identical messages: when Lean catches
both and rethrows the first error, the caller gets the *first Java object*.
When Lean replaces an error with the same text or maps it to a typed
`EIO String`, neither result is mistaken for the original exception.

The frame test also exercises a failure that an exception-identity check
alone missed: Lean caught a `LinkageError`, called Java a second time, then
rethrew the original error. The extra call incremented a Java counter.
The test requires that counter to stay at zero **and** that Java receive
the same throwable. It distinguishes terminal JVM errors from an ordinary
application `AssertionError`, which Lean can still map.

This native test uses a small test entry point and one static host member.
It is not a Maven installation test: it does not establish cross-JAR host
object identity, host lease retirement, or generated package delivery.

## Sharing an application object between components

`npm run test:jvm-host-domain` compiles two independent native components,
packages their private Java adapters in separate JARs and removes both build
directories. A Java consumer loads each JAR in a different classloader and
exercises both load orders, each in a fresh JVM with JNI checking enabled.

The first component calls the host's identity method and saves the resulting
Lean reference in a test observation slot. The second component receives the
original Java object as a fresh argument. Lean compares the two wrappers by
pointer: they match. Two objects that compare equal in Java do not match.
One Java object bound as two distinct nominal Lean kinds does not match either.

An incompatible second class in a binding rolls back. A call with a bad
second argument does not retain its first strong argument. Closing a binding
inside its own host method is rejected; closing it after return leaves the
other binding usable. Closing the final binding brings the registry count
to zero, invalidates a previously saved Lean reference even after rebinding,
and lets the JVM collect the object.

The test supplies the component entry and a native observation slot. These
are integration JARs, not releases built by the Maven publisher. On Linux
x86-64, the independently built copies of the owner had SHA-256
`b627be085eafc1cfdc61d2685a7d5c568176e12ac8a82810bd36df6407367b43`;
both copies of the shared nominal domain had SHA-256
`9728e40ff5b5f69e1893524253e12d2055de6cf2aedfadb87eb90e94f77a0436`.

The integration test now generates every imported member's native C
definition from the contract and compiles its prototype alongside Lean's
generated C. In both components it exercises all 19 primitive types, not
just nominal references. Java checks the incoming values and returns changed
values that Lean checks independently. Cases include the unsigned 64-bit
maximum, signed minima, 160-bit integers, Unicode with embedded NUL, byte
array copy isolation, negative zero and signed subnormal floats. For NaN
the comparison is with Lean's own observer: on 4.32.2, `Float32.toBits`
reports `0x7fc00000` for a quiet NaN with payload `0x42`, even with no
bridge involved. A Lean `Unit` input carries no data and is omitted from
the Java host method's parameters; a `Unit` return uses Java `void`.

## Installing the published API

`npm run test:jvm-host-packages` exercises the offline-installed CLI, not the
integration JAR builder. It builds Workshop and a separately named peer from
ordinary and reviewed source, verifies the package-set receipts, and removes
the publisher directories. Maven installs each JAR/POM pair into a private
repository and resolves the application classpath offline. The test relocates
that repository and verifies the installed bytes before compiling either
consumer.

On Linux x86-64, use Lean 4.32.2, a native C compiler and `readelf`, JDK 22,
Kotlin 2.2.0, Node 22, Maven and Python 3. Set `JAVA_HOME`,
`LEAN_BRIDGE_LEAN_PREFIX` and `LEAN_BRIDGE_KOTLIN_HOME` to the corresponding
installations. Point `LEAN_BRIDGE_JVM_IO_M2_SEED` to an offline Maven cache
containing install-plugin 3.1.4, dependency-plugin 3.8.1, kotlin-stdlib 2.2.0
and their dependencies, but neither Workshop package. The test copies the
seed, not the user's live Maven repository. `LEAN_BRIDGE_JVM_HOST_HANDOFF_TMP`
can place the compressed archives on a separate volume. The production glibc
floor is 2.38; this local acceptance run selected 2.36 with the existing
test-only floor setting.

The [Java consumer](../../tests/fixtures/jvm-host-meter/Consumer.java) uses
ordinary methods and try-with-resources. It exercises two independent
components, a second classloader for the same component, virtual-thread
reentry, an escaping host exception, a typed Lean `EIO` error, a replacement
IO error, and a returned nested `Except`. It rejects a tampered JNI library
after loading the authentic component, refuses self-close, and observes an
object becoming collectible after its final binding closes even while Lean
still holds the stale wrapper. The [Kotlin consumer](../../tests/fixtures/jvm-host-meter/KotlinConsumer.kt)
uses `KClass` and `use`, with both a Java class and a Kotlin class. Each
language starts a fresh JVM for each package load order, with JNI checks
enabled and no publisher tools on the runtime search path.

This exercises synchronous imports of application-owned objects. It does not
establish asynchronous host-object delivery, arbitrary aggregate arguments,
or CLR host-object execution.

All eight installed executions passed on 2026-11-24 (two source routes × two
languages × two load orders). Package-set receipt and JAR digests:

| Source | Component | Receipt SHA-256 | JAR SHA-256 |
| --- | --- | --- | --- |
| ordinary | workshop | `c1a23d1f09d3fce7959be2463a725c064a10cd7665ac7f0ef89a502dd4729c99` | `f90288ed4c700d533449ef07738b3dcb8c8b9b8238743d78fe0917099f1035c8` |
| ordinary | workshop-peer | `2e623c7743fa1b101d442f03f808b4dfcd4a09f3e8271f97477bf56dd92f8355` | `6490f8d1ff99d08767005883000d775a1e236da8a45261966c7d8266b052dbb4` |
| reviewed | workshop | `d853987e8466e45ff76934f3811fe02389afc2c0c068f406edd9d46cd26a3f04` | `512d6faf6fe7f77eba735d1d1f76b3cf1f43fa13be83a2c301d735596e649f7f` |
| reviewed | workshop-peer | `c9cffd376b507bb0fcefe4f4d9fdfc032db0a8f0c0c2fe0946c54dae87bd5dfd` | `a054da3c5e5080d8ea4d3147153febc893b5396a4464454ccd9489b36bf8d8c0` |
