# Structured C callbacks and returned closures

VO task 1219. This milestone covers target `c` on ordinary-source and
independently reviewed-IR builds.

The 26-export fixture transports arrays, Lists, options, results, products,
acyclic copied records, tagged variants and transparent aliases through host
callbacks and returned Lean closures. Mixed payloads include nested optional
values, asymmetric success/error branches, strings with embedded NUL and Unicode,
bytes, and exact arbitrary-precision integers. Empty containers, `None`,
`Some(None)` and `Some(Unit)` remain distinct.

Each source path passed 5,999 public-header consumer checks after removing the
producer source/build tree and relocating its verified package archives. The
consumer compiles against the installed headers, then runs without Lean or a
compiler on its search path. Returned closures retain their captured values
after the caller releases its input.

Each path also passed 112,193 allocation-failure checks over the generated native
adapter and public GMP facade. Those probes use the real compiled Lean code.
They exhaust allocation checkpoints during input/output conversion, repeated
callbacks, failed host calls, closure creation and closure invocation. Tracked
bridge allocations and runtime identities return to their baseline after every
failure. Address and undefined-behavior sanitizers report no conversion errors.
LeakSanitizer reports 128 bytes in 12 Lean/GMP startup allocations in the empty
control and the complete run, with no growth after the callback tests.

The public C API preserves call-scoped nested borrows, copied callback results,
initialized GMP outputs and explicitly disposed closure leases. Invalid tags,
oversized payloads, expired host callbacks, wrong-thread or wrong-signature
closures, and exceeded reentry limits leave outputs unchanged. A subsequent
valid call succeeds. Host errors preserve their code and byte-counted message
through cleanup, including embedded NUL.

Run the required installed gate:

```sh
LEAN_BRIDGE_C_STRUCTURED_CALLABLE_TEST=1 \
  node --test tests/c-structured-callables.test.mjs
```

The [execution record](c-structured-callables-20260924.json) retains archive,
fixture, consumer and sanitizer identities. The
[integration record](c-structured-callable-integration-20260924.json) records
exact source changes and preserves the earlier copied-value receipts.

Only 32 C callback input/result cells are promoted. The copied-recursive
milestone still covers all seventeen consumer profiles. Recursive callable
payloads, structured callables in other profiles and explicitly owned
resource-containing aggregates remain task 1219 work. Callbacks inside copied
containers and asynchronous delivery are not enabled by this milestone.
