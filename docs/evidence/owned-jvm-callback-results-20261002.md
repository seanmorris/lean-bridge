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

The dedicated CI job requires all 14 execution, compilation, and fault tests to
pass without skips, requires all four installed-package reports and both fault
reports, and preserves the reports and execution log as artifacts.

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

Callback-specific garbage collection, creator-thread and process cleanup,
multi-target release, and frozen acceptance evidence still need completion. This
staging milestone does not change the published type-support inventory or publish
a registry package.

## Commands

```sh
LEAN_BRIDGE_OWNED_JVM_CALLBACK_RESULT_TEST=1 node --test --test-concurrency=1 \
  tests/owned-jvm-callback-results.test.mjs \
  tests/owned-jvm-callback-mixed-signatures.test.mjs \
  tests/owned-jvm-callback-result-faults.test.mjs

LEAN_BRIDGE_OWNED_JVM_CALLBACK_RESULT_PACKAGE_TEST=1 node --test --test-concurrency=1 \
  tests/owned-jvm-callback-result-packaging.test.mjs
```
