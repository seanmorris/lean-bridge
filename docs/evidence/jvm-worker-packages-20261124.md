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

## Offline publishing CLI and reviewed release

The full release test passed on November 24, 2026 (30 minutes 17 seconds
for the test case). It installed the candidate CLI from its npm archive,
built three Maven handoffs locally, verified each package-set receipt, and
installed each pair in an offline Maven repository. These are the artifacts
from that run; the table above records the earlier ordinary-source run.

| Handoff | JAR bytes | JAR SHA-256 | Package-set receipt SHA-256 |
| --- | ---: | --- | --- |
| Ordinary `workshop` | 51,490,536 | `0d2eb456c621856721cbbae20f3e5d6da6989b7e1c33bf42630af70729058fcf` | `26de80fa6a203a6b635f9c4a20c504758ef806474abe30aaca3d0de55f1a9a7e` |
| Ordinary `workshop-peer` | 51,491,749 | `d36a2128d3e08fcecc0966c21792b8b4458aa93ee54dc834d4cb87b717e71a29` | `dd8204ee573620cee774fea12d717e7c9a03c351589737deb5600ebfed7c88ef` |
| Reviewed `workshop` | 51,490,581 | `7e8fce05d73415f781a578f46f846b1bb75550d41608aa2114dad669aef50569` | `c98b1afa5bedbf9eb184408352b63c8868799a4194c1b199dcf75870130ca042` |

The reviewed API matched the ordinary API. Its review-source SHA-256 was
`f70443c3e441061b598d3f5c41b1c202621298c31bf5eee347f1044151bcc9c9`.
Each main package ran with the same peer: Java and Kotlin each passed in
both load orders (eight application processes total). Four more processes
checked the installed loader: changing either the worker ledger or the JNI
library caused rejection on both routes. A fourth author project removed the
declared error payload site from `Jobs.refuse`; the CLI rejected the review
before writing a package-set receipt. No Maven or npm registry was used to
publish these artifacts.

## File effects on demand and early stream cancellation

The [Java](../../tests/fixtures/jvm-host-workers/EffectClient.java) and
[Kotlin](../../tests/fixtures/jvm-host-workers/EffectFlow.kt) clients ran
against ordinary and reviewed packages: four executions from relocated,
offline Maven repositories. Both clients read the startup environment,
read a real file synchronously and through a future or suspending call,
and observed a change to the file between two stream demands. Cancelling
Java's subscription and stopping Kotlin's flow with `take(2)` both produced
the Lean close marker. Java also requested another item and cancelled again;
neither yielded another item nor rewrote the replacement marker in the check.

The producer rejected the worker, pull and close when the filesystem grant was
removed. To repeat the check, set `LEAN_BRIDGE_JAVA` to the absolute JDK 22
Java executable, `JAVA_HOME` and `LEAN_BRIDGE_KOTLIN_HOME` to the JDK and Kotlin
2.2.0 installations, and `LEAN_BRIDGE_JVM_IO_M2_SEED` to the offline Maven
plugin/dependency cache (without the Workshop artifact). Run
`npm run test:jvm-worker-effects`.

| Build | Verified package-set receipt (SHA-256) |
| --- | --- |
| Ordinary | `80116ff0607ec3621b157eed0f9e3e11d115c59c12cd1664de79e01a1c8678d0` |
| Reviewed | `24800f92203da9f461f6230e4edcea5d348a5c644e52a9c409383117ef6446fc` |
