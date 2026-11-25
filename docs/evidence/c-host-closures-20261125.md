# Returned Lean functions over C application objects

The [factories](../../tests/fixtures/c-host-closures/Closures.lean) return
unary Lean IO functions. A downstream [C11 application](../../tests/fixtures/c-host-closures/consumer.c)
uses its package header and links through pkg-config. It adopts two application
objects with separate counted destructors. A closure returns its captured
object, not the distinct one passed as its argument.

The client opens two bindings of the same component. It exercises an original
host error code, nested invocation and closing the callable from inside its
own invocation. Wrong-signature and mixed-binding calls, calls from another
thread, and old tickets after slot reuse never reach the host method. Closing
one binding destroys its last captured object immediately while its sibling
stays callable. Reopening the binding does not revive a revoked ticket.

A second process returns malformed success from a C member: an object is
required but the member supplies none. The runtime refuses ordinary calls
through either binding after that fault. Each captured object still reaches
its own destructor exactly once. This is distinct from a declared host
error, after which the same binding can make another successful call.

All three packages also released an individual closure explicitly after
retirement, before closing its binding. Repeating that drop was harmless.

| Archive configuration | Verified package-set receipt (SHA-256) |
| --- | --- |
| Ordinary source | `5d3e619dcd0f68cc9ce1fa862258f9e6113ddf13270e5943b7ed6040d9d56438` |
| Reviewed interface | `24e6ced54317b51136747ac0e9bd4b129e73793d7386392ffc8fd0c423e81967` |
| Closures with a nominal worker task and filesystem grant | `2ee2a2fe391fae4cebcea5f90d67f88c94a333309503a3de39f90cdb23eda34b` |

The worker package additionally delivers the original object through a Lean
task. A second returned function reads a file on each invocation and observes
its changed contents. The publisher rejects the file-reading factory without
the required grant.

Run `npm run test:c-host-closures` with the native publishing toolchain.
The test installs the publisher CLI from its offline archive, verifies the
component receipt, relocates the extracted C package, removes its release
directory, and runs the compiled client with no tools on its path.
