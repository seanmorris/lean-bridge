# JVM container-entry exit observation

Fresh Java and Kotlin container-entry probes now require a recorded successful
exit from GDB or the same child's Linux process handle. The ten source/adapter
counters, defining-library checks, extraction policy and rejection controls are
unchanged. Historical scripts and reports keep their original identities.

## Failure and correction

[JVM job 114716526056](https://github.com/seanmorris/lean-bridge/actions/runs/38220864275/job/114716526056)
failed at `d2d819205189ceaaf80d7e2cc80901111c778de2` during the reviewed
Fin container probe. GDB printed `No unwaited-for children left`; the old observer
returned 72 because it had no normal-exit status. That log does not establish the
child's pending kernel status.

The newer edge observer already implements [same-child exit observation](jvm-pending-exit-20261011.md).
The container-entry observer now reuses that implementation. It opens a process
handle while the child is stopped, before continuing execution. If GDB loses its
threads without recording an exit, recovery requires the original process
identity, no exit event or conflicting status, and a kernel `CLD_EXITED` record.
The bounded wait does not consume the event or run another consumer. Signals,
live children, consumed or missing status, instrumentation errors and nonzero
exits remain failures.

Successful fresh runs put the exit receipt in the breakpoint manifest. The
reader matches its PID to the mapped counter record. The CI report gate requires
the receipt and current script identity for Java and Kotlin; older archived
reports do not acquire new observations.

## Executed checks

Eight focused controls use real Linux child processes with a simulated GDB view.
For the pending-exit case, the old tail returns 72 and the new tail records the
child's actual zero exit. Nonzero, signalled, already-reaped, missing-manifest and
foreign-manifest cases retain their refusal results. The existing twenty
kernel-exit controls also pass, including ptrace-traced children. These tests
exercise the kernel recovery path, not the hosted debugger race.

Both current generated probes ran against the retained, receipt-verified
FinContainers JAR. Java and Kotlin each produced all 24 expected public rows and
a real GDB successful-exit receipt. Separate controls removed GDB's status after
it had reaped the child; both correctly returned 72 despite complete transcripts.
The JAR and its extracted inspection libraries retained their hashes. These
replays did not take the pending-kernel-exit branch.

Fresh ordinary-source and independently reviewed package tests also passed on
Node 22.23.3. Each route reproduced its archives from two author directories and
installed Java and Kotlin consumers after removing author sources. The four
consumers completed 8,102 public API checks. Each produced all 24 public entry
rows and 11 separate raw-C-adapter rows. The missing-debugger, stale-parent,
outside-root and preloaded-library refusal controls remained required.

The two installed tests passed without skips in 381.7 seconds. The local runner
then used `java-kotlin` where the report CLI requires `java,kotlin`. That checker
invocation failed. Correcting the argument validated the same original reports;
neither compiled selection was repeated. The archive keeps both outcomes.

These runs used one CPU at low CPU and I/O priority. Their explicit local package
floor is glibc 2.36. Fresh hosted confirmation remains required.

Final focused checks passed 21 tests without skips. The twelve-root regression
passed 135 tests with six explicit compiled-test gates skipped; the separate
enabled installed run above passed both routes without skips. Regression TAP
SHA256: `a7ce0f5ca75affb523ba67425e0561aa25ede969e0c61255faa3909444acfb1b`.
Full lint, checked JavaScript and all 16 generated reference checks passed on the
same source bytes. The independent audit verifies all seven source transitions,
48 archived files, seven source snapshots and the unchanged support inventory.

## Retained evidence

[The archive index](jvm-container-entry-exit-20261012/index.json) binds 48 files:
the original hosted failure, complete replay streams and records, scripts,
manifests, selected symbol listings, kernel-control TAP, both installed reports
and their actual checker results. Index SHA256:
`246f5db0604d5ef7eb18cf5f08be0a396a76b8d4dfb0d34b6f109056f2d23d24`.
Package binaries and complete toolchains are not included.

The archive tests read repository-relative files. Recorded absolute paths
identify the original processes; CI does not need those directories. Independent
checks validate counter records, observed rows, defining offsets, script hashes,
exit identities and all four installed report entries. Missing or altered
artifacts and index bytes fail 98 controls.

The [source history](jvm-container-entry-exit-source-history-20261012.json)
records seven exact transitions from `42bd530c3c1edab1fe5764144f7965f845b69f81`.
Ledger SHA256: `8f0ad9a39bb9f69c53b70efdd59631a4b5e782fada3e1dce237efeede3845d55`.
The support inventory, workflow and older evidence files are unchanged. This
repair does not add language support or close #1220.
