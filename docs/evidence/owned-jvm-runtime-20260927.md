# JVM ownership runtime foundation

Task 1219. This is private runtime support, not an installed Maven release.

The Java runtime tracks each native session on its creating platform thread.
Resource and closure handles share explicit leases. Retaining creates an
independent native owner; closing one alias does not close another owner.
Borrowed handles expire when their callback frame ends.

Cleaner actions mark pending releases without calling a thread-bound C session.
The creating thread drains those releases. A native C++ TLS destructor reclaims
remaining owners when that platform thread exits, even if Java wrappers and the
Java Thread object remain reachable. Virtual threads are rejected before a
native session opens.

Java thread-local registration precedes native session creation. Registration
and native allocation failures leave no untracked session. Result decoding
adopts its owner once, so unwinding a failed wrapper allocation cannot resurrect
an already released owner.

## Executed checks

The [runtime receipt](owned-jvm-runtime-20260927.json) records fresh Lean builds
from ordinary source and independently reviewed IR. Both paths pass 139
ordinary checks and seven runtime-retirement checks, including:

- Shared aliases, independent retention, expired borrows and cross-session use.
- Wrong-thread calls, cross-thread close and Cleaner-queued releases.
- Java registration and wrapper allocation failures, plus native allocation failures.
- Closing resources and sessions during an active native callback.
- Native cleanup with live Java wrappers after platform-thread exit.
- Process rejection before native locks and a native-only inherited-lock fork probe.

Both paths finish with zero bridge allocations, zero registered identities and
zero native thread-exit errors. Each ordinary run observes three native thread
destructors; each retirement run observes one.

The native fork probe does not execute Java in the child or establish general
JVM support after fork.

Run the fresh native checks with:

    LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test tests/owned-jvm-runtime.test.mjs

Public Java/Kotlin value declarations, structured conversions, typed callbacks,
authenticated package loading and installed Maven acceptance remain to be
implemented. This foundation changes no type-surface support cells.
