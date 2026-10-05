# Owned JVM calls and callbacks

Java and Kotlin use typed native downcalls and synchronous callback interfaces.
Both nominal value families share the Java conversion engine and creator-thread
ownership runtime. Returning a Lean closure as a callback preserves its native
identity. Returning a host callback does not extend the callback's lifetime;
invoking it after its call ends rejects before entering Java or Kotlin.

Callback arguments borrow resources and closures until the callback returns.
Explicit retain creates an independent owner. The adapter copies callback replies
while their buffers and borrowed inputs remain valid. C owns each reply slot,
including failures after publication. Host exceptions retain their identity after
native cleanup, and the first exception prevents later callbacks from running.
Typed recovery values allow Lean to unwind when a result has no automatic default.
The caller receives the original failure, never a successful recovery value.

Inputs, callback arguments, replies and results share conversion budgets within
each call. Nested calls create their own budgets and owners. Native copies are
bounded independently. The tests inject failures into every observed Java bridge
allocation checkpoint and native adapter allocation until each call succeeds.
Both allocation and identity counters return to their baseline after each attempt.

The native suite compiles ordinary source and independently reviewed Binding IR
for resource compositions, all-nineteen-scalar packets, and all-nineteen-scalar
callback signatures. It executes Java and Kotlin consumers for all six builds.
It checks higher-order closures, invalid callback replies, explicit recovery,
expired borrows, retained closures, creator-thread affinity and shared limits.
Separate JVM processes retire the native runtime inside Java and Kotlin callbacks.

The final suite passed seven tests with no skips or failures in 157.4 seconds.
Each ordinary and reviewed build produced these counts:

| Fixture | Java checks | Kotlin checks | Injected Java failures | Injected native failures |
| --- | ---: | ---: | ---: | ---: |
| Resource compositions | 587 | 539 | 306 | 210 |
| Scalar packets | 175 | 170 | 110 | 46 |
| Callback signatures | 649 | 192 | 255 | 121 |

Each language's retirement process passed three checks and ended with zero
allocations and identities. The composition process observed five completed
native thread destructors and no destructor errors.

Thread tests retain Java wrappers and Thread objects after their creators exit.
They wait for the native destructor completion counter, which is independent of
Java Thread.join(), and require zero destructor errors and restored allocation
counters. An interrupted callback must propagate its original interruption after
native cleanup. No test uses garbage collection to satisfy these ownership checks.

The immutable JSON receipt reconstructs the complete generated Java, Kotlin, C
and native thread-cleanup sources from compiler inputs. It binds the independent
callers, injected checkpoint source, terminal test log and earlier converter
receipt without changing that receipt. Mutation tests reject missing language
cases, missing cleanup observations, source changes and unsupported claims.

This milestone does not install Maven artifacts or provide authenticated package
loading. Transferred inputs, anchored results and Wasm ownership remain required
work in VO 1219. It promotes no support-matrix cells.
