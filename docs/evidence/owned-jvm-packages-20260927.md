# Owned Java and Kotlin Maven packages

VO task: 1219.

The ownership-aware Maven profile compiles ordinary Lean source and reviewed
contracts into a JAR containing typed Java and Kotlin APIs. Records, variants,
recursive values and containers can carry resource and closure identities.
The package embeds the component, JVM adapter, shared runtime and private GMP.
Consumers install the JAR and POM without Lean or native declarations.

## Installed acceptance

The [execution record](owned-jvm-execution-20260927.json) binds the compiler
inputs, generated source hashes, native receipts, original archives and
terminal test logs. The [source history](owned-jvm-integration-20260927.json)
preserves earlier receipts and records each changed source span.

The CLI acceptance builds scalar and callback/composition packages on both
authoring paths. It checks compiler-free byte-identical reassembly, rejects
ten producer mutations, removes author inputs, verifies the handoff, installs
offline and executes source-free consumers twice in relocated `java.base`-only
runtimes. Java and Kotlin public signature checks cover all 51 callback-demo
exports and eight scalar-packet exports. Independent consumers check copied
payloads, owned resources, higher-order closures, callback recovery and all
nineteen primitive callback types.

The installed-JAR probe removes or replaces each of the five native libraries.
Forty fresh JVM scenarios cover Java/Kotlin and cold/warm classloaders. The
probe recomputes the mutable package receipt, requiring the hashes embedded
in compiled classes to reject the altered resource. No additional native
libraries may map, and a previously loaded original package must remain usable.

Four independently built owned/copied/recursive packages exercise eight
language/loading-order combinations, nested cross-component callbacks,
concurrent calls and shared retirement. Both languages reject a foreign
resource in direct arguments and nested records at compile time. After creator
and worker threads exit, the broker must report zero live leases.

The author recipe and both consumer examples compile and execute verbatim.
Copied recursive packages retain their own installed, deterministic-rebuild,
coexistence, conflicting-classloader and cold-value regression checks.
CI requires eleven ownership suites, 25 nonempty reports and artifact retention.

## Ownership and platform

Resource and closure wrappers implement `AutoCloseable`. Borrowed callback
wrappers expire when the callback returns; explicit retention creates an
independent owner. Calls run on the creating platform thread. Cross-thread
close queues release, and native thread exit drains owners even when JVM
objects remain reachable.

The loader authenticates each package's own resources before reuse, shares
compatible dependencies, and rejects conflicting builds or unverified
preloads. Native libraries stay pinned until process exit; normal shutdown
removes extracted files. Process-origin probes simulate an inherited runtime.
They do not establish general support for forking a running JVM.

This profile targets Java 22/Kotlin 2.2 on Linux x86-64. Transferred inputs,
anchored results, retained asynchronous callbacks and Wasm ownership adapters
remain separate work. The earlier [runtime](owned-jvm-runtime-20260927.md),
[conversion](owned-jvm-conversions-20260927.md) and
[callable](owned-jvm-calls-20260927.md) receipts retain their original bytes.
