# Recursive Java and Kotlin callbacks

VO task 1219. Baseline: `e3ebe7870a10e98d0215b3b09fc3910d719ddc0b`.
The [execution receipt](jvm-recursive-callables-20260926.json) records the
original Maven archives, terminal test logs, consumers and isolated probes.
The [integration receipt](jvm-recursive-callable-integration-20260926.json)
authenticates source changes and the eight newly installed-tested cells.

## Installed packages

Fresh ordinary-source and reviewed-IR authors build Maven-only releases.
Java 22.0.2 and Kotlin 2.2.0 consume the original JAR and POM offline through
empty Maven caches. Producers are removed before installation. Installed source
trees and handoffs are removed before relocated execution with `java.base`
alone. Package hashes remain unchanged, and normal exit removes extracted
native assets.

Each source path covers:

| Check | Java | Kotlin |
| --- | ---: | ---: |
| Recursive public consumer | 661 | 658 |
| Existing acyclic assertions | 257,978 | 177,270 |
| Recursive and acyclic typed rejections | 23 | 27 |
| Mixed primitive and wide-Unit assertions | 66,701 | 66,673 |
| Mixed typed rejections | 29 | 33 |

The base package has 33 exports and 18 callable signatures. The mixed package
has 98 exports and 59 signatures, covering all nineteen primitives and
sixteen-argument Unit callbacks. Both execute the exact documented Lean,
Java and Kotlin examples, preserving independent closure captures and returning
`42`, `20`, `42`.

## Failure and ownership checks

Separate instrumented source copies bind to each installed package's original
source and native-asset hashes. The public JAR is never rewritten. Each
language/source-path combination checks 170 layout values and runs 824,369
assertions with 41,857 injected failures across nine shapes, four seeds and
five paths: callback, repeated callback, closure creation, creation-and-call,
and held-closure invocation. Owners, identities, arenas, scopes, frames and
callback roots return to their baselines after failures.

Malformed native output clears once, retires the shared runtime and prevents
later calls. Nine reply-owner baselines pass. Premature scope closure rejects
the eight pointer-bearing shapes before decoding; inline Option remains valid.
Removing runtime retirement produces the named assertion and exit 1, not a
native crash or timeout.

Each language/path also passes 8,235 lifetime checks: concurrent close,
departed and virtual threads, deferred release, checked/unchecked Throwable
identity, reentry recovery, Cleaner fallback, 4,096-slot capacity and 8,192
subsequent allocations. A changed-PID simulation tests process guards. No
actual JVM fork is claimed. Cold invalid arguments reject without loading
Lean, and corrupting each of the four native assets fails authentication before
native loading.

## Regression and source evidence

The previous primitive and structured suites passed with original offline
installations. The copied-graph package suite passed all 10 tests without skips,
including independent reproduction, shared-runtime composition/conflicts and
cold Java/Kotlin compilation. Those regression runs used the isolated staging
loader. Production sources retain the same parsed code and exact generated
base, mixed and copied-only output. The final recursive and mixed installed
suites use normal repository imports, with no staging loader.

The two installed test selections together execute every case in the permanent
acceptance file. CI runs that file without filtering and retains both reports.
Source-history checks preserve earlier evidence without allowing unrelated
edits or substituting predecessor hashes.

## Limits and remaining work

Conversion permits 128 value levels, 262,144 visited values and separate 16 MiB
native-copy and accounted host-storage budgets. These do not bound Lean working
memory or every JVM allocation. Returned functions own explicit leases;
callbacks borrow one synchronous call. Reentry permits 64 active calls.

Native PHP, PHP-Wasm and WIT/WASI recursive callbacks remain assigned work.
Explicitly owned resource aggregates also remain in task 1219. This milestone
adds no support for identities inside copied values, retained host callbacks,
asynchronous delivery or post-fork reuse. Local development archives use glibc
2.36; the production profile remains glibc 2.38.
