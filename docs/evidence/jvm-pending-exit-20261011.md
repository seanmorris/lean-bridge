# JVM pending-exit observation

The JVM observer now opens a Linux process handle before continuing the inferior. If GDB loses every thread without reporting an exit, the observer can obtain that same child's pending exit status from the kernel. It still rejects signals, missing status, a live child, conflicting debugger state and instrumentation failures. A nonzero normal exit remains nonzero.

## Hosted failure and recovery

[JVM job 114537520888](https://github.com/seanmorris/lean-bridge/actions/runs/38162208580/job/114537520888) failed on `b0cabee` after GDB 15.1 reported `No unwaited-for children left`. The diagnostics show no exit code, signal or event, no debugger threads, and a zombie process still traced by that GDB. The strict observer returned 72. The complete original log is retained in [the archive](jvm-pending-exit-20261011/hosted-failure.log).

GDB's Linux target removes zombie thread-group leaders and expects to restore them when their exit event arrives. Its wait loop can report no resumed threads before recording that event. This matches the observed state, but the hosted race has not been reproduced locally. [GDB 15.1 Linux target source](https://gnu.googlesource.com/binutils-gdb/+/refs/tags/gdb-15.1-release/gdb/linux-nat.c).

The new observer binds the child with `pidfd_open` while it is stopped before execution. Recovery requires absent GDB exit status/events and an empty thread list for the original inferior. It calls `waitid(P_PIDFD, ..., WEXITED | WNOHANG | WNOWAIT)`, waiting at most one second for that process. Only `CLD_EXITED` with matching process/user identity supplies a normal exit code. `WNOWAIT` leaves the event available to GDB. The observer never reruns the consumer or substitutes success for an unknown status. [Linux process handles](https://www.man7.org/linux/man-pages/man2/pidfd_open.2.html), [Linux wait semantics](https://www.man7.org/linux/man-pages/man2/waitpid.2.html).

Every successful new run records its exit source and status in the breakpoint manifest. The report checker requires this receipt for the exact new observer script. It continues to authenticate the two older observer versions, without adding new observations to their reports. Counter, defining-library, extracted-file and cleanup checks remain required.

## Local evidence

Twenty real-kernel child-process controls passed. They include normal exits 0, 7 and 255; genuine ptrace-traced exits 0 and 7; signal termination; a live-process timeout; wrong inferior/handle identity; unavailable or consumed status; and conflicting debugger or instrumentation state. The GDB-facing object in these controls is simulated. They exercise the actual process-handle and wait syscalls, not an installed JVM.

The unchanged archived Java package and complete consumer also ran under the new observer. All 12,046 call observations, final counters and extracted-library identities passed, with a real GDB normal-exit receipt. A second replay deliberately removed GDB's status after it had reaped the process. That run correctly returned 72 despite its complete consumer transcript. It did not create an exit receipt or count as acceptance.

These are local replay and recovery controls, not a fresh two-root package build or evidence that hosted CI has recovered. The normal replay did not take the kernel recovery branch. A fresh hosted JVM run remains required.

## Retained records

[The index](jvm-pending-exit-20261011/index.json) binds 25 artifacts, including both complete transcripts, original counter records, manifests, scripts, raw debugger output, the kernel-control TAP, source snapshots and the hosted failure log. Index SHA256: `2920296b61862f5eb1cd6876bf90a196b2d7d81c63bad6ffe0c87c8aa2409fa7`. The symbol listing includes every definition of the eight measured symbols, not unrelated Lean runtime symbols. Binary packages and toolchain distributions are not included.

The archive checker reads repository-relative files. Recorded absolute paths identify the original executions; CI does not need those producer directories. It rechecks both Java transcripts and the normal run's counters, mapped symbol offsets, library identities and exit receipt. It also refuses each missing or changed artifact and index, covering 52 mutations.

The history ledger records five exact transitions from `66639ddbe17be8d1d5264725c1e2816972a649ba`. It changes no inventory pins, evidence entries, observations or support claims. Earlier archives remain unchanged.

## Regression checks

The final three-root regression passed 124 tests, with zero failures and eight explicitly gated compiler/installed checks. TAP: `build/vo1454-jvm-wait-regression-r2.tap`, SHA256 `6e869d88d77aef2faa0516d434b4649f14b4f5a2d20985b927e70c96982f25ae`. The focused recovery/archive suite passed all eight tests. Targeted lint, checked JavaScript and all sixteen generated reference pages passed. Tests ran serially at low CPU and I/O priority.

An independent audit verifies the five inverse source transitions and all 25 archived artifacts. It confirms that the complete support inventory and all 10,021 older evidence files are byte-identical to the predecessor commit. The observed hosted failure remains recorded; this change still needs a fresh hosted run.
