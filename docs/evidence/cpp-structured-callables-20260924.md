# Installed structured C++ callbacks and closures

VO task 1219. This milestone adds arrays, Lists, options, results, products,
acyclic records, variants and aliases to C++ callback and returned-closure
parameters and results on both authoring paths.

The independent fixture selects 26 Lean exports. Each installed consumer passes
9,366 checks, including 5,956 injected C++ allocation failures across 384 cases.
Each shape has 48 cases covering direct callbacks, repeated callbacks, closure
construction and closure invocation. Nested absent options, engaged Unit,
empty containers, success/error branches, all variant constructors, embedded NUL,
Unicode, bytes and large integers retain their values.

Seven ill-typed public callers fail compilation at their source locations.
Callbacks preserve their C++ exception type after native cleanup. The consumers
also check nested reentry, expired callback borrows, explicit disposal, moved
closures, wrong-thread calls, post-fork rejection, invalid values and budget
failures.

The test removes the author's Lean sources and build output before installing
relocated archives. It then checks the public C++ API under address, leak and
undefined-behavior sanitizers. A final deployment retains only the executable
and packaged libraries; headers, archives and the compiler are unavailable.
The startup control and full run report the same 128-byte, 12-allocation GMP
startup baseline. No additional leak or address/undefined-behavior error is
reported.

The generator qualifies copied type names to prevent implementation helpers
from shadowing public types, including `Result`, `Lease`, `Function1` and `View0`.
The [code-generation regression record](cpp-structured-codegen-regression-20260924.json)
compares every emitted file with the preceding implementation for the existing
callable, collection, compound, List, alias and variant fixtures. All six
packages retain byte-identical generated output.

Run the installed gate:

```sh
LEAN_BRIDGE_CPP_STRUCTURED_CALLABLE_TEST=1 \
  node --test tests/cpp-structured-callables.test.mjs
```

It writes `build/structured-callables/cpp.json`. The separate primitive regression
uses `LEAN_BRIDGE_CPP_CALLABLE_TEST=1 node --test tests/cpp-callables.test.mjs`.

Recursive callable payloads, structured callables in the other host projections,
owned resource aggregates and final cross-language acceptance remain assigned
work. This milestone does not complete task 1219.
