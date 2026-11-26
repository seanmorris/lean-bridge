# A fatal callback from a Kotlin coroutine

Cancelling one suspended call and retiring its shared runtime are different
events. This [Kotlin client](../../tests/fixtures/jvm-retained/KotlinTrap.kt)
calls two independently installed Maven components. It never requests
retirement. A `LinkageError` thrown by the application's own callback is
the fault source.

| When the callback throws | What the application checks |
| --- | --- |
| While its caller is awaiting it | The suspend call throws the **same** `LinkageError` instance. Neither package accepts another call; the rejected call does not enter its callback. |
| After its caller has cancelled and joined | The other package still works before the callback is released. Once the released callback throws, both packages refuse calls. The original coroutine remains cancelled, with one cancellation completion and no successful return. |

Each case runs in a new JVM in both component load orders. The test observes
one actual callback entry, one runtime and two initialized components before
the fault, zero live native identities and no net event descriptors at the
end. It uses the public Kotlin suspend functions; a test-only Java observer
reads counters without initiating the fault.

The [ordinary](kotlin-callback-fault-20261126/ordinary.json) and
[reviewed](kotlin-callback-fault-20261126/reviewed.json) records pin the
Kotlin and observer sources, JARs, POMs and all eight process results.
The [archive harness](../../tests/helpers/kotlin-callback-fault-installed.mjs)
verifies the three original [package identities](jvm-retained-tasks-20261123.json),
installs them offline with Maven and relocates the resolved classpath.
Neither Lean nor Maven is on the consumer's execution path.

To replay with the original Feedback and Relay packages, set the JDK 22,
Kotlin 2.2.0, Maven and offline cache paths described in the original
package record, then run:

```sh
LEAN_BRIDGE_KOTLIN_CALLBACK_FAULT_REPLAY=/path/to/original-handoffs node --test --test-name-pattern='Kotlin fatal callbacks' tests/helpers/kotlin-callback-fault-installed.mjs
```

This exercises a catchable, deliberately thrown JVM linkage error. It does
not simulate a process crash, actual memory exhaustion, or general recovery
from native memory corruption. Fresh JVM retained-callback qualification also
runs the probe; replaying the original historical report does not change it.
