# JVM Fin edge shutdown investigation

The hosted JVM edge gate remains unresolved. This milestone adds failure diagnostics and preserves local investigation results. It does not close VO #1454, #1427 or #1220.

## Hosted failure

[JVM job 114211587262](https://github.com/seanmorris/lean-bridge/actions/runs/38051564992/job/114211587262) failed on `b8765be` after GDB reported `No unwaited-for children left.` The observer had no acceptable normal process exit and returned status 72. Earlier ordinary and reviewed container-entry gates passed in that job.

The [original log](fin-jvm-exit-diagnostics-20261010/hosted-failure.log) has SHA-256 `4f28f167fb17ecab1c3c1853823e25a34c7ac52d7ead9b88deed8cb725ece693`. The available hosted log does not establish why GDB stopped before recording process exit.

## Exact local fixture

The diagnostic package was built from `3beb2ca905ee1c4020033aa9dce540a386b091dc`. It uses the twelve-export edge fixture, the complete Java `Consumer`, and the eight-column edge observer. An earlier ten-column diagnostic exercised a different fixture and is not evidence about this failure.

The task-owned Ubuntu 24.04 container used GDB `15.1-1ubuntu1~24.04.1`, Temurin 22.0.2+9 and glibc 2.39. The original installed JAR and probe class bytes were checked before replay. Every normal replay checked all 12,046 public-call rows, the final entry counters, defining ELF addresses, and hashes of the JVM's extracted libraries before and after shutdown.

| Replay | Result |
| --- | --- |
| Unchanged production observer | Normal exit, complete transcript verified |
| Observer with exit-event tracing | Normal exit, complete transcript verified |
| Four scheduling variants: one/two CPU affinity and two/four JVM active processors | All four exited normally with complete transcripts |
| New diagnostic observer | Normal exit, complete transcript verified |
| Missing exit-code control | Refused with status 72 |
| Missing exit code plus diagnostic-read exception | Refused with status 72 |

The first two runs' task-local checker omitted its `code`, `output` and `stderr` fields. Their [original summary](fin-jvm-exit-diagnostics-20261010/gdb15-r1/summary.json) retains that checker failure. A separate [read-only recheck](fin-jvm-exit-diagnostics-20261010/gdb15-r1/recheck.json) supplies the original captured fields and verifies both records, including five refusal controls per record. Neither the original records nor the production checker were rewritten.

These local runs did not reproduce the hosted failure. They are single-package diagnostics, not fresh two-root installed acceptance or a repair.

## Diagnostic change

The JVM observer now records up to eight process-exit events. Before its existing abnormal-exit refusal, it prints GDB's exit code and signal, inferior identity, thread states, selected `/proc` status fields, GDB version and kernel release. Thread output is capped at 64 entries. It emits no new diagnostic output on a normal process exit.

The existing exit guard, nonzero exit propagation, instrumentation failures, package checks and counters are unchanged. There is no retry and no replacement exit status. A diagnostic-read exception is reported and still reaches the original refusal.

Report verification accepts exactly the original observer and the version with diagnostic logging. Removing only the added statements reproduces the archived original script byte for byte. Tests reject any other script hash, including a script with its exit guard removed. Old reports do not acquire new observations.

The two negative replays deliberately remove the recorded exit code after the real process exits. They test the refusal and diagnostic paths; they do not reproduce the hosted shutdown race.

## Retained evidence

[The archive index](fin-jvm-exit-diagnostics-20261010/index.json) binds 89 files with SHA-256 `b093c653bfcebc45b78d3a91a3806f5f96d23adb7a22a42522b29480a0082a2e`. It contains original results, transcripts, counter records, debugger scripts, runner sources, selected producer and observer sources, and the hosted failure log. It excludes the binary package and toolchain distributions. Selected source snapshots are not a complete build-input closure.

An independent check verifies the exact file set and every byte count/hash, seven normal runs, and both refused controls. The completed diagnostic container was removed after its records were copied. The installed package and all original local records remain under `build/vo1454-actual-edge-jvm-3beb2ca`.

The source-history ledger records nine exact transitions and six current-source pin updates. It leaves all 407 evidence entries, 509 observations, original archives and support claims unchanged.

## Verification

The four-root regression run passed 117 tests with zero failures and 13 explicit installed/compiler skips. Checked JavaScript and all 16 generated reference pages passed. The independent archive check rejected appended bytes in all 89 files and same-length mutations in the 80 nonempty files. A separate Git audit verified all nine source predecessors and confirmed that the 5,067 earlier evidence files were unchanged.

The first regression run is retained under `build/vo1454-jvm-exit-diagnostics-integration-r1.tap`: 112 passed, three failed, 13 skipped. It exposed a binary/text hashing mistake in the updated history test and two old observer-hash expectations. The corrected run is `build/vo1454-jvm-exit-diagnostics-integration-r2.tap`. Neither failure was suppressed or reclassified.

Next: inspect the new shutdown diagnostics if the hosted gate fails again. Do not classify this milestone as a JVM fix or accept a run without an observed normal exit.
