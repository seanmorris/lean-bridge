# JVM signature probe: wait for native thread cleanup

VO task 1219. The signature probe now waits for the observed native TLS
destructor after Java's `Thread.join()`, before starting allocation-failure
checks. This changes the test harness, not the generated runtime or public API.

CI run 36378254925 failed the ordinary signature probe with
`allocation rollback false/13: 4 != 5`. The rejected cross-thread closure call
created a native session. Java reported that its thread had finished before
the native TLS destructor released that session. The fault-injection harness
sampled five allocations; cleanup then reduced that count to four.

The repair uses the existing native exit counter and checks both allocation
and identity counts against their pre-thread values. It retains the strict
rollback assertions.

The installed-consumer generator omits these private counter observations.
It keeps the public wrong-thread rejection check and produces the same Java
consumer bytes recorded in the original installed Maven acceptance.

## Deterministic reproduction

Run with the pinned Lean compiler, JDK 22.0.2, Kotlin 2.2.0 and a native compiler:

```sh
LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test tests/owned-jvm-thread-exit.test.mjs
```

The regression compiles the actual Lean signature fixture and generated
Java/Kotlin bindings through ordinary-source and reviewed-IR paths. A
test-only condition-variable gate holds the native destructor. The Java
probe confirms that `Thread.join()` returned while cleanup is still held.
The repaired wait releases the gate and observes completed cleanup before
the fault-injection baseline.

A negative control removes only that wait, in a separate JVM process using
the same compiled native library. It releases cleanup after sampling the
baseline and must fail with `allocation rollback false/0: 4 != 5`. An unrelated
failure does not satisfy the control. Gate observation has bounded waits;
the test does not use a sleep to manufacture the race.

Both repaired runs require 651 Java checks, 192 Kotlin checks, 255 managed
allocation failures, 121 native allocation failures, one held and released
native exit, zero cleanup errors, and zero remaining allocations or identities.
The ordinary signature suite also runs without the gate on both source paths.

## Evidence and scope

[The source-bound receipt](jvm-thread-exit-repair-20260928.json) binds the
positive and negative observations to the native guard, Java/Kotlin probes,
generated bindings, source files and terminal test logs. It preserves the
earlier wasm32, PHP, Perl and JVM receipts through exact, hash-checked source
transitions. Historical reports and archive identities are unchanged.

CI runs the regression in the JVM job, requires both reports, uploads them
and propagates test failure. No type-support cells are promoted. PHP-Wasm's
public ownership wrappers, JavaScript/Wasm ownership, WIT/WASI ownership,
transferred inputs and anchored results remain separate work.
