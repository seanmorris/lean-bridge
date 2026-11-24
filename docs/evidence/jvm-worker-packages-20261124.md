# Installed Java and Kotlin workers with application objects

Two independently built Maven packages were installed with their POMs into
an offline Maven repository. The [consumer test](../../tests/helpers/jvm-host-installed.mjs)
resolved dependencies offline, moved that repository, verified the installed
archive hashes, and compiled ordinary [Java](../../tests/fixtures/jvm-host-workers/Installed.java)
and [Kotlin](../../tests/fixtures/jvm-host-workers/InstalledKtClient.kt) applications
against it. Each language ran in a fresh JDK 22 process in each load order,
with no producer on its executable path.

The peer’s scalar function adds 37; the main package’s adds one. These checks
would fail if either package accidentally loaded the other's implementation.
The bridge still shares its native runtime, JVM owner, class registry, and
lease ledger. Class-bearing calls return the original application object,
including through a retained callback or declared error.

| Ordinary-source package | JAR SHA-256 | Package-set receipt SHA-256 |
| --- | --- | --- |
| `org.leanbridge:workshop:1.0.0` | `ce8be04e9c0cba57abd2dfc39fcafb4db6f768cf0036273693d679cc675b20b2` | `621505fdf6af7d2b4147a8001779655546214ec3f7b83c484b02dc608283577a` |
| `org.leanbridge:workshop-peer:1.0.0` | `b416e111a9078e7b61be7ab08305b79cf5f13e7cb9d43a32f6c53a4bd30dd652` | `73dffcabaabd5d27b956689ce93ad088101f50fdd971b91c9a31d51805a8dfa4` |

Both Java and both Kotlin runs passed. Java exercised original exception
identity, recovery in Lean, typed factory and step failures, a distinct IO
step failure, demand and shared retirement. Kotlin exercised suspend calls,
coroutine cancellation, early flow termination, exhaustion and failure.
Closing one binding stopped its pending work and revoked its cold publishers
without invalidating its sibling. See the [native scope tests](jvm-worker-transport-20261124.md)
for registry counts, garbage collection and blocked-handler shutdown.

These are local ordinary-source receipts; neither artifact was uploaded to
Maven Central. The [full release test](../../tests/helpers/jvm-worker-packages.mjs)
also installs the publishing CLI offline, builds a reviewed-IR route, and
checks that removing the declared error's ownership prevents publication.
Run it with `npm run test:jvm-worker-packages`, the pinned Lean and JVM
toolchains, and `LEAN_BRIDGE_JVM_IO_M2_SEED` set to a Maven seed containing
the install/dependency plugins, Kotlin stdlib 2.2.0, and coroutines 1.8.0.
Set `LEAN_BRIDGE_JVM_WORKER_HANDOFFS` to a private directory to retain the
receipts and archives after the test.
