# Returned Lean functions in an installed Maven package

The Java consumer calls `remember(captured).invoke(supplied)` with two
different objects that compare equal. It checks the result with `==`;
the [Kotlin consumer](../../tests/fixtures/jvm-host-closures/Installed.kt)
uses `===`. Neither client supplies a JNI handle or loads a native library.

The [Java client](../../tests/fixtures/jvm-host-closures/Installed.java)
also calls the function on a virtual thread. During a call, an application
method invokes a sibling function, closes its own function and confirms
that a new invocation fails. The original invocation finishes. Reopening a
binding does not revive a revoked function. Dropping a function, dropping
its binding, or closing it explicitly releases its captured object. The
client drops the last application reference to a binding *during* a call
to check that collection cannot interrupt that invocation.

A separate JVM throws a deliberate `LinkageError` from the application
method. The caller receives that exact object and the shared runtime refuses
further invocations. Closing a function still releases its capture without
releasing the sibling binding's object. This does not require exhausting
JVM memory.

The [installation test](../../tests/helpers/jvm-host-closures-installed.mjs)
restores the JAR and POM into an offline Maven repository, relocates it,
checks the installed bytes against the package receipt, and removes the
handoff. The Java and Kotlin clients run in fresh processes without publisher
tools on their path. The author-side checks also reject a review that names
the wrong runtime owner and a file-reading function without a filesystem
grant. Run `npm run test:jvm-host-closures` with the [Maven publisher
toolchain](../publish/maven.md) and the offline Maven dependency cache.

| Maven package | Verified package-set receipt (SHA-256) |
| --- | --- |
| Ordinary | `b89d55a91c342a334fc0d677c4bedd6e598704787237132c3ea1db1f297f7398` |
| Reviewed | `fbde4ffd1cb4ce2ee060a69610cbbd12b5cf6caf2706b434d78db81b1576c306` |
| Worker with a filesystem grant | `d09fa6c5c35b0ca9df9ae5b51e6bd21f4819cb86ca210c4d84e1d1053b276235` |

The [Java worker](../../tests/fixtures/jvm-host-closures/Worker.java)
passes the returned function directly to `relay` and receives the original
*checked* exception at future settlement. The [Kotlin worker](../../tests/fixtures/jvm-host-closures/Worker.kt)
uses `f::invoke` from a suspending call. The Java client parks callbacks on
two bindings before closing one; its future is canceled, a late invocation
cannot use its revoked function, and the other callback completes exactly
once with its own captured object. A separate returned function reads two
successive versions of a file and raises `LeanIOException` for a missing file.

The [ABI and rollback checks](../../tests/helpers/jvm-host-function-abi.mjs)
are separate from those installs. One compiles the JNI provider against C
prototypes emitted by Lean. The other substitutes a failing JNI result transfer
in the generated Java API: a function allocated but never delivered must be
dropped, and cleanup must not replace the original failure. This is fault
injection, not an observed JVM out-of-memory event.
