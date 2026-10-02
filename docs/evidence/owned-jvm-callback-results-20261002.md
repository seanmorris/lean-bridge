# JVM callback-result ownership

Work on VO 1219 adds callback-local result anchors to the Java and Kotlin
projections. The callback's selected argument owns the returned view. Closing or
transferring that original owner expires its borrowed descendants. Retaining a
result gives it an independent owner.

Native closures accept a checked `Value<T>` at anchored argument positions.
Generated overloads pass native closures directly when a Lean export or another
closure takes a callback. Host callbacks receive borrowed values and return
`CallbackResult.value(value)` or `CallbackResult.owner(owner)`. The adapter copies
the reply while its source owner and callback frame are still live.

The implementation covers Java and Kotlin. Native-only packages omit host
upcalls. The combined fixture exercises callback replies alongside input
transfers, export anchors, receiver methods, and mixed host/native callbacks.

## Verified so far

- Real Lean-backed Java and Kotlin probes execute raw and whole callback replies,
  direct native closure calls, higher-order closures, mixed consuming receiver
  overloads, and exception identity. Native allocation and identity counts return
  to the active-session baseline after owner cleanup and zero after shutdown.
  The probes cover original-owner expiration, empty and recursive descendants,
  independent retains, and rejection of expired recovery values before transfer.
- Maven packaging verifies the native component, adapter, compiled JVM sources,
  Kotlin compiler options, and archive receipt. Reassembly produces identical JAR
  and POM bytes. The native-only fixture rejects 30 artifact or receipt mutations;
  the combined fixture rejects 51.
- Existing callback and scalar packages compile with Java 22 and Kotlin 2.2.0,
  including their external consumers and invalid type examples. Partially
  anchored higher-order signatures compile with host callbacks enabled and
  disabled.
- The standalone CLI and type-support inventory pass 99 contract tests. All 26
  frozen .NET callback reports still reconstruct against their original source
  identities. The JVM source-history ledger records this stage without changing
  those receipts or promoting any type-support cells.

The first package run exposed a missing v5 entry in the Kotlin compiler profile.
It omitted the required `-Xuse-type-table` option, and packaging rejected the
compiler receipt. The compiler now recognizes `jvm-owned-values-v5`.

Independent review also found two generated signature errors. Legacy Kotlin
closures unnecessarily required a raw invocation argument, and native-only
higher-order calls converted nested closures to host callback interfaces. Both
fixes have compilation regressions.

## Acceptance still in progress

All four installed Maven cases pass: ordinary Lean configuration and independently
reviewed IR, each with native-only and combined ownership capabilities. The matrix
installs prepared archives into empty offline repositories, compiles Java and
Kotlin consumers, removes producer sources, and runs relocated consumers with a
runtime containing only `java.base`. Combined packages use the installed CLI;
native-only packages use the native build API with host callbacks disabled.
Each native-only consumer executes 22 ownership checks, and each combined consumer
executes 47. Each also checks its public signatures and rejects invalid typed
calls. Both language consumers execute twice after the handoff is removed.

The expanded CI job requires 28 execution, compilation, and fault tests to pass
without skips. It requires the installed-package, direct-runtime, garbage
collection, thread cleanup, sanitizer, and shared-release reports, and preserves
the reports and execution log as artifacts.
Ten separate evidence tests reconstruct those reports and reject altered source,
contract, execution, and cleanup claims.

## Allocation-failure checks

Both ordinary and reviewed inputs pass 11,263 assertions each. Java and Kotlin
each exercise native anchored closure results, raw host replies, whole-owner host
replies, and a consuming receiver with whole-owner recovery. Every case injects
managed and native allocation failures until the call succeeds.

The sweeps reach failures after native callback-result copying and, for consuming
receivers, before and after ownership transfer. Input aliases follow the actual
transfer; independent retains and reply owners remain usable. Explicit cleanup
restores the active-session counters after every attempt while the wrappers and
exceptions remain reachable. Final session shutdown leaves zero native allocation
and identity counters. These checks do not depend on garbage collection.

## Lifetime and cleanup checks

Both source paths pass the callback-specific garbage collection tests. The Java
and Kotlin probes collect original owners of populated and empty results, verify
that borrowed descendants expire, and keep independent retains usable. Temporary
whole-owner callback replies survive publication and become collectible afterward.
The test records C2 compilation of the exercised methods. Removing the reply's
rooting mechanism makes both language probes fail their lifetime assertion.
Restoring the generated source restores the passing result.

Creator-thread tests keep wrappers and their `Thread` objects reachable while
the workers exit. Both native-only and combined packages reject wrong-thread
access, expire the dead-thread owners, and release native allocations and
identities. Combined fixtures also retire the runtime during raw and whole-owner
host callbacks in fresh Java and Kotlin processes. These tests do not claim JVM
support after `fork`.

All four ordinary/reviewed and native-only/combined sanitizer cases pass against
the generated C adapter and C++ thread guard. Java and Kotlin execute the same
public consumer checks against instrumented and uninstrumented adapters. Separate
buffer-overflow and invalid-shift controls confirm that ASan and UBSan detect
their respective faults. The JVM and Lean runtime are not instrumented, and
LeakSanitizer is disabled; the probes check native ownership counters separately.

The consumer guides now contain standalone Java and Kotlin examples for retaining
callback results, returning host replies, and observing creator-thread cleanup.
The expanded Maven tests compile and run these files from installed archives.

The direct runtime suite also compiles 16 deliberately broken ownership variants.
Each Java probe rejects the intended violation: choosing the closure as the result
owner, accepting an expired empty value, or leaving an escaped callback frame live.
The test restores the generated source and requires identical Java and Kotlin
output. The report verifiers reconstruct all six runtime reports and reject 478
altered variants. The lifetime verifier reconstructs 12 reports and rejects 472.

## Remaining acceptance

The installed matrix now also requires an independent producer build with
byte-identical archives and 40 installed-asset forgery rejections. The initial
native-only case passes those additions; the complete matrix is being rerun with
the executable guide examples and captured runtime output.

The shared release builds C, C++, Cargo, PyPI, RubyGems, NuGet, Maven, and npm from
one Lean API. Both independent ordinary builds produced matching archives. The
first local installation run stopped because the wheel advertised glibc 2.38 on
a glibc 2.36 machine. The rerun uses the existing 2.36 test setting, which checks
every compiled library's required symbols before packaging. This does not change
the release default or bypass Python's compatibility check.

Core CI exposed unintended README byte changes in eight older JVM receipt checks.
The generator now preserves those older outputs. A comparison of six runtime and
four package fixtures confirms that all 964 callback-enabled generated files and
their contracts remain byte-identical. The CLI source inventory changes, so
packages built before this correction cannot serve as final current-CLI evidence.
Those package cases need a fresh build; their reports are not relabeled.

Shared-release execution, independent report reconstruction, frozen acceptance,
and the full contract suite remain open. This staging milestone does not change
the published type-support inventory or publish a registry package.

## Commands

```sh
LEAN_BRIDGE_OWNED_JVM_CALLBACK_RESULT_TEST=1 node --test --test-concurrency=1 \
  tests/owned-jvm-callback-results.test.mjs \
  tests/owned-jvm-callback-mixed-signatures.test.mjs \
  tests/owned-jvm-callback-result-faults.test.mjs \
  tests/owned-jvm-callback-result-gc.test.mjs \
  tests/owned-jvm-callback-result-sanitizers.test.mjs

LEAN_BRIDGE_OWNED_JVM_CALLBACK_RESULT_PROCESS_TEST=1 node --test \
  tests/owned-jvm-callback-result-process.test.mjs

LEAN_BRIDGE_OWNED_JVM_CALLBACK_RESULT_PACKAGE_TEST=1 node --test --test-concurrency=1 \
  tests/owned-jvm-callback-result-packaging.test.mjs
```
