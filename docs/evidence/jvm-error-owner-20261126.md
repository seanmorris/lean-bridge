# When a declared JVM error is the last owner of a Lean ticket

Both the [Java application](../../tests/fixtures/jvm-sync-resources/ErrorOwner.java)
and the [Kotlin application](../../tests/fixtures/jvm-sync-resources/KotlinErrorOwner.kt)
caught the generated exception for `Desk.checkTicket`. Each closed the ticket
that it had passed in. The closed handle refused a read, but the exception
payload still referred to the same live ticket. An independently packaged
Counter incremented it; Desk then read 42. At that point the native observer
counted one identity, and Linux showed one additional open `/dev/null`
descriptor. Closing the payload twice restored both counts to baseline,
and a new call on the same runtime succeeded.

The [ordinary](jvm-error-owner-20261126/ordinary.json) and
[reviewed](jvm-error-owner-20261126/reviewed.json) records each contain four
separate JVM executions: Java and Kotlin, each starting with Desk or Counter.
The [harness](../../tests/helpers/jvm-resource-acceptance.mjs) checked the
original JAR, POM and package identities against the
[November 23 installations](jvm-sync-resources-20261123.json) before offline
Maven restore. The clients executed against a relocated classpath with no
author tools on PATH. These are fresh client observations on those packages,
not new release builds, a terminal JVM fault, or an application-owned object.

To repeat, configure the JDK 22, Kotlin 2.2.0, Maven and offline dependency
cache used by the resource harness. Point the replay at the directory
containing the original ordinary, reviewed and peer package handoffs:

```sh
LEAN_BRIDGE_JVM_ERROR_OWNER_ORIGINAL=/path/to/verified node --test --test-name-pattern='last owner of a resource' tests/helpers/jvm-resource-acceptance.mjs
```

Fresh JVM resource captures also run these two applications. Replaying the
historical November 23 report does not rewrite it.
