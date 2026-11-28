# Java objects crossing a compiled Lean worker boundary

The [transport test](../../tests/helpers/jvm-worker-transport.mjs) builds the
[Lean component](../../tests/fixtures/jvm-host-workers/Jobs.lean), its shared
runtime, the JVM owner library, and the JNI adapter from source. It runs a
[Java client](../../tests/fixtures/jvm-host-workers/WorkerProbe.java) on a
virtual thread with JDK 22.0.2 and `-Xcheck:jni`.

The client passes a Java object through a Lean task, a returned `Except`, a
declared `EIO` failure, and a cursor. It checks reference identity with
`==`. A retained Lean callback receives that object and replies with a
different one. Cursor exhaustion, a typed step error, and an IO step error
produce three distinct outcomes. Null and wrong-class inputs fail without
creating a task handle; closing one binding does not invalidate its sibling.

The [Java frame](../../src/backends/jvm/host-worker-frame.java) also runs with
memory allocated in an arena confined to the calling virtual thread.
The native owner resolves object references during the JNI call. The client
checks that neither the original argument buffer nor the returned result
contains a native object handle. After closing the bindings it checks both the
runtime's live identity count and the Java host registry's live object count;
both must be zero.

The [Java delivery check](../../tests/fixtures/jvm-host-workers/BoundDeliveryProbe.java)
uses the generated task reactor and callback machinery. A callback runs on a
virtual thread, calls a second binding and returns its result. A thrown
application exception keeps its identity. Cancelling a future while its
callback is blocked prevents a late reply from replacing cancellation.
A `Flow.Publisher` starts the Lean cursor on demand, emits one item for the
first request, and reports exhaustion on the second.

The [binding shutdown check](../../tests/fixtures/jvm-host-workers/ScopeProbe.java)
closes a binding with a blocked callback, a subscribed but never requested
cursor, and a cursor parked after one item. The future is cancelled and both
subscribers receive a terminal error. A blocked application completion handler
does not delay shutdown; a sibling binding finishes its own callback. A member
or retained callback cannot close the binding during its own call. An abandoned
cold publisher releases its argument before unbind; one kept by the application
releases its argument at unbind, and cannot start against a reopened binding.

The [generator compatibility check](../../tests/helpers/jvm-lease-tasks-compat.mjs)
compared 48 generated files against the original, receipt-verified JARs:
17 from copied tasks, 17 from retained callbacks, and 14 from synchronous
resource bindings. All matched byte-for-byte.

Run `npm run test:jvm-worker-transport` with the pinned Lean toolchain and a
JDK 22 compiler. This is a local bridge test, **not** an installed Maven
package. The test knows private operations; application consumers must not.
The [Maven package checks](jvm-worker-packages-20261124.md) separately exercise
public Java and Kotlin signatures and shutdown in installed applications.
