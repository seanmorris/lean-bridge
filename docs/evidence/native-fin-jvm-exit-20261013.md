# Scalar JVM process-exit observation

Predecessor: `50a5cf414a914a3906ccf7676eb4006427b8ecd8`.

## Failure

Downstream run `38386497742`, job `115259485803`, failed the ordinary
installed scalar Fin test after GDB reported `No unwaited-for children left`.
The six-column observer returned 72 because GDB had not supplied a normal
exit status. The independently reviewed selection passed in the same job.

The original hosted log is retained in the archive. Its SHA256 is
`2ffcb44850ece17d3ebedcf0de345d3c5345dfe0fdac590fdecabdb5afd73448`.
The hosted debugger was GDB 15.1. The log does not establish whether the
kernel still held the child's exit status. We have not reproduced that
hosted shutdown race locally.

## Change

The scalar observer now uses the same exact-child exit protocol as the
container observer. It opens a Linux process handle before continuing the
inferior. A normal GDB exit remains sufficient. If GDB loses all threads
without an exit event, the observer can inspect the same child's pending
kernel exit through that handle. It waits at most once for one second,
does not resume the process and does not start another process.

An accepted run needs exit code zero and a receipt bound to the PID in its
counter record and breakpoint manifest. Nonzero exits retain their own
exit codes. Signals, missing status, conflicting identity and already-reaped
children without a GDB status remain failures. Printed counter rows do not
establish successful exit.

The original instrumentation text remains available for historical receipts.
All six counters, load-trigger checks, image hashes, extraction-root checks
and poisoning behavior retain their original text. Production code and CI
commands are unchanged. Seven exact source transitions preserve earlier
evidence. One live producer fingerprint changes in the support inventory;
its 500 evidence entries, 585 observations and support claims are unchanged.
Source-history ledger SHA256:
`f9194d7f7aedc5a3ae25ffcb5af0f98845e61989b28c4cafad1b92d4eb7232d8`.

## Validation

The full installed scalar JVM suite passed five tests with zero failures or
skips. Both ordinary and reviewed packages reproduced across two independent
author roots. Java and Kotlin each compiled offline, ran after relocation,
and completed their cold-process counter probe through the installed JAR.
All four probes produced their twelve exact rows and a successful GDB exit
receipt. The suite checked 5,466 source hashes before and after execution;
none changed. Original TAP SHA256:
`0a92c6b4d95e69738cd0aabe7d15a38e3987e0e440220d565b9b8b2217482859`.

Eight scalar exit controls use real kernel children and a simulated GDB
view. They demonstrate the old refusal condition and the new pending-exit
path, nonzero and signalled exits, reaped children, normal GDB exit and
missing or foreign manifests. Existing traced-child, identity and receipt
controls also remain active. Each real Java/Kotlin stand-in run rejects a
nonzero debugger result, a different script identity and four invalid exit
receipts. These controls do not reproduce the hosted debugger race.

The archive contains 54 original files plus its index. Four compressed
symbol-listing records expand to their exact original bytes, lengths and
digests. Its checker reads repository-relative files, not the recorded
temporary paths, and rejects 110 missing or altered archive cases.
Index SHA256:
`6f7b600a6688409b4783de5cf3d642ca056d7e84d68b8d461d4c629aa3f4c354`.

The broader regression suite passed 116 tests with three explicit
compiler/runtime skips and no failures. Those skips do not establish new
runtime acceptance. Regression TAP SHA256:
`d0b307c5f8db5e1717531bf100632bcaac57063bd4eca5eeaee21c4e1c356232`.

The final focused suite passed 33 tests without failures or skips. TAP SHA256:
`a17d5fc930a66ee6da7a06476ecbe90128a253fa01ba369577b340ac4c4eb4df`.
Full lint, checked-JavaScript type checking and all sixteen generated-reference
checks passed. The earlier failing regression, source-pin updater guard and
style-check outputs remain recorded; none is presented as a successful run.

Local installed acceptance used Linux x64, glibc 2.36, GDB 13.1, JDK 22.0.2
and Kotlin 2.2.0. Fresh hosted acceptance remains required. This repair adds
no nominal Subtype support claim or memory-safety observation.
