# Installed structural Subtypes in Java and Kotlin

Ordinary-source and independently reviewed Maven artifacts passed at producer
`5935a5a97723c5feaa9a79d61b1cb636b71ac9f0`. The runs used JDK 22.0.2 and
Kotlin 2.2.0 on Linux x86-64 with the declared local glibc floor of 2.36.

| Author route | Installed test | Duration | Lowest free disk |
| --- | --- | --- | --- |
| Ordinary source | 1 passed, 0 failed, 0 skipped | 188.6 seconds | 10,316 MiB |
| Reviewed API | 1 passed, 0 failed, 0 skipped | 172.8 seconds | 10,309 MiB |

Each route reproduced its model, package-set receipt, JAR and POM in two
independent author directories. The harness removed both author/build trees
before installing the prepared JAR on isolated consumer classpaths. It compiled
only the downstream Java and Kotlin callers. Both callers passed again after
their complete installed directories moved.

Java exercises `org.leanbridge.structuralsubtypes.Api`. Kotlin exercises the
separate generated `org.leanbridge.structuralsubtypes.kotlin.Api`, including its
metadata-backed nested array signatures and Kotlin Option/Result/Pair classes.
The Kotlin consumer includes its compiler distribution's runtime in its own JAR.
Neither consumer downloads dependencies during installation or replay.

The installer authenticated the complete original JAR and its receipt before
compilation. It rejected classpath-expanding manifests and unrecorded discovery
inputs. Every execution checked the original package, caller, interpreter and
compiled consumer identities before and after running. Java annotation processing
was disabled. The selected JDK and Kotlin distributions remain trusted tools.

The eight retained executions cover two author routes, two languages and two
locations. Each passed 4,119 assertions, including 1,042 expected rejections and
six snapshot mutation controls. The twelve exports cover Array, List, Option,
products, both result branches, transparent aliases and a closed generic
specialization. Cases include wide integers, UInt8, Unicode and complete NUL
suffixes, empty/absent values, first/middle/last failures and all nine nested
row/column positions.

Both callers check exact exception types and messages, mixed-Fin priority,
independent alias/parameter constructors and exactly-once normalization.
Independent snapshots retain concrete types, array shapes, active branches,
complete integer payloads and every UTF-16 string unit without generated equality
or hash methods. Both inputs are checked through 1,000 late rejection/recovery
pairs.

## Original records

The archive is
[`structural-subtype-jvm-20261011`](./structural-subtype-jvm-20261011/index.json).
It retains 73 originals plus its index: 40 run records, 31 exact Git producer
source snapshots, the runner and the report checker. Index SHA-256:
`3efb5151e5c195ab2154a470e69a067ee1166eb0a6a879e2b6f83c700bb702c6`.

Ordinary TAP SHA-256:
`5ff646c5fddd804c7157e9a371b735340485139265b6e5c549ef9d4c6b7828ff`.
Reviewed TAP SHA-256:
`22f0b207078b0cbd644850d08cfd70b41f544b29ea8c0005281d923105904828`.

The checker reconciles both original models with the independent API and
constructor choices. It authenticates the callers, receipts, compiled Java/Kotlin
metadata, complete classpath inventories and replay observations. Historical
absolute paths are provenance only; the checker does not reopen them.

Archive tests passed three groups, rejecting 148 missing/corrupted originals and
98 coordinated report/contract mutations. Controls include a substituted JAR,
extra classpath entries, missing compiled callers, false host/isolation claims,
altered counts and constructors, omitted Kotlin APIs/metadata and a changed Kotlin
standard-library version. The metadata controls coordinate both compilation
records, package receipts and observation hashes.

An independent audit compared all originals and 31 source snapshots with the
recorded producer. All 8,271 older evidence files and the complete
440-claim/555-observation inventory remain unchanged. Both source callers compiled
against genuine generated APIs in a separate source-only test. The source
five-root regression passed 40 tests, failed none and skipped thirteen explicitly
gated compiler/installed tests. Full source lint, type checking and sixteen
generated references passed.
The final five-root regression passed 43 tests, failed none and skipped thirteen
explicit compiler/installed gates. Those skips are separate from the successful
caller compilation and two real installed-package runs above.
The complete documentation test root passed all 43 tests without skips.

## Remaining acceptance

This is local glibc 2.36 acceptance, not a hosted glibc 2.38 observation. Package
and tool identities are retained; their binaries and complete toolchain closures
are not. Constructor/source entry counts and memory behavior were not measured
for these JVM packages. This milestone does not promote support-table cells or
add recurring structural JVM CI.

Native PHP, WIT/WASI and Perl remain in the native structural-Subtype pass.
Browser page/React/worker and PHP-Wasm are additional environments. Required
recurring gates, support-table promotion and consumer documentation follow
acceptance. Nominal fields, callbacks, owned values and broader generic
combinations remain within VO #1444 and #1220's original scope.
