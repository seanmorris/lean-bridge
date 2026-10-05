# Ruby callback sanitizer setup

The Ruby callback-result probes execute the compiled C/Fiddle boundary under
AddressSanitizer and UndefinedBehaviorSanitizer, with leak detection enabled.
Each exercised process must reproduce the complete normalized startup leak
report. Normalization changes process addresses and report order, not allocation
counts, byte totals or stack frames.

MRI 3.3 allocates its own alternate signal stack. The first exercised probe
stopped in ASan's thread destructor when ASan tried to unmap that malloc-backed
stack. The harness now sets `use_sigaltstack=0`, the setting described in
[Ruby issue 20256](https://bugs.ruby-lang.org/issues/20256). This changes ASan's
signal-stack handling, not its memory checks. `RUBY_FREE_AT_EXIT=1` asks MRI to
release interpreter allocations at shutdown; `detect_leaks=1` stays enabled.

An initial cold-start comparison initialized MRI's fiber and thread machinery
and Fiddle's per-thread last-error storage. Standalone Ruby probes reproduced a
608-byte root fiber and its 64-byte and 24-byte fiber-local storage without
loading any Lean code. Both no-host configurations then passed. The four
host-capable cases still produced different shutdown allocation reports, despite
zero tracked bridge allocations and identities. That six-case gate failed;
its result was not accepted.

An early-checkpoint experiment invoked `__lsan_do_leak_check` before interpreter
shutdown. It reported live MRI allocations and did not solve the discrepancy.
The harness now lets LSan check after normal interpreter shutdown.

The heap trace found a bridge retention bug. MRI's finalizer table held a
`ValueGuard`, which held a `Lease`, which held a `State` and its exited `Thread`.
The thread's return value could contain the same guarded wrappers. Native owner
counts had reached zero, but this Ruby reference chain kept the thread and its
root fiber alive. `State.retire` now drops the thread reference after closing the
session and marking the state exited. Calls on the retired state still reject
before consulting its thread. A weak-key regression requires the exited creator
thread to be collected while closed result wrappers remain in scope.

The test workload also returns from its Ruby method before clearing retained
test exceptions and collecting garbage. Every immediate native-cleanup assertion
runs before those exceptions are released. This removes harness roots without
removing any native ownership check.

All six ordinary/reviewed runtime configurations then passed in 465 seconds,
including all five sanitizer controls. Each exercised report exactly matches
the complete normalized cold report: 248 bytes in 13 startup allocations, with
no remaining thread-root allocations. The no-host, host and combined cases run
906, 2,776 and 4,849 semantic checks. A new compiled mutation removes the retirement
fix and fails the weak-key assertion. The focused no-host rerun passes all six
mutations and 173 public-API checks, including collection of exited creator
threads. The complete six-case rerun then passed in 341 seconds, rejecting
6 no-host and 10 host-capable mutations per source path. Combined installed
packages and the final acceptance gate remain unfinished.

The harness also avoids GCC 12's obsolete glibc TLS-header heuristic with
`intercept_tls_get_addr=0`. TLS and loader-allocation roots remain enabled.
Five compiled controls independently require detection of a heap overflow, an
invalid shift, an unreferenced 73-byte allocation, a reachable allocation held
only in dynamic TLS, and an 89-byte leak after clearing that TLS pointer.

Fresh ordinary and reviewed no-host gems passed 173 public checks before and
after relocation, 22 package mutations and automatic-loader checks. Those builds
include the thread-retirement repair but predate the Python milestone baseline.
The full gate is rebuilding all installed packages from the new baseline.
Combined releases and the final frozen Ruby acceptance remain required.
No leak suppressions have been added.
