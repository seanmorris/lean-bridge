# JVM ownership-aware value conversion

VO task 1219. Java snapshots and readers now execute against the owned C ABI
on ordinary-source and reviewed-IR Lean builds.

The converter handles all nineteen scalar kinds, arrays, lists, products,
aliases, records, variants, nested options and results, and recursive values.
Resources and returned closures use typed wrappers. Result aliases share an
owner but close independently. Explicit retain creates an independent owner.
Temporary input pins keep native identities alive if their source wrapper
closes before the input scope ends. Callback-frame borrows expire at frame exit.

Conversion uses iterative traversal, a 128-level depth cap, 262144-node cap,
and separate 16 MiB native and managed-storage budgets. Checks reject invalid
Unicode, erased generic payloads of the wrong type, cycles, invalid native
flags and tags, missing or misaligned spans, and malformed GMP views.
Arbitrary integers preserve sign and limb boundaries. Floating-point echoes
preserve raw bits, including signed zero and NaN payloads.

Each composed-value run passes 786 assertions, including 222 injected Java
allocation failures and 115 native allocation failures. Each scalar run passes
300 assertions, including 55 Java and 23 native allocation failures.
Every fault checkpoint returns allocation and identity counters to their
baseline. Each process finishes with both native counters at zero.

The receipt includes full compiler inputs for all four runs, the terminal
test log, source hashes, generated Java hashes, and native C/TLS hashes.
Its verifier reconstructs the generated code and the independent caller.
The earlier JVM lifetime receipt remains unchanged.

This milestone does not implement host upcalls, Kotlin value declarations,
authenticated loading, or installed Maven packages. It promotes no support
inventory cells. Those integration stages remain part of task 1219.
