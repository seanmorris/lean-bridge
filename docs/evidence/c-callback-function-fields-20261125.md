# Exchange a record containing a Lean function through a C callback

In [`exchangeTariff`](../../tests/fixtures/onboarding/leased-closure-fields/Owned.lean),
Lean builds the input tariff itself, gives it to a host callback, and applies
the returned tariff's price function. No caller-owned input can accidentally
keep the original function alive after the callback returns. The
[C11 application](../../tests/fixtures/structured-types/tariff-exchange.c)
uses the generated header and no Lean runtime APIs.

| Author route | Package-set receipt | Execution |
| --- | --- | --- |
| Ordinary source | [Exact receipt](c-callback-function-fields-20261125/ordinary.package-set.json) | [pkg-config, relocated CMake and identity counts](c-callback-function-fields-20261125/ordinary.execution.json) |
| Independently reviewed interface | [Exact receipt](c-callback-function-fields-20261125/reviewed.package-set.json) | [pkg-config, relocated CMake and identity counts](c-callback-function-fields-20261125/reviewed.execution.json) |

The client tests six cases, in order:

1. Return the incoming record without supplying an owner. Lean calls its
   function successfully; the saved handle later fails.
2. Construct a new record during the callback and transfer its result owner
   with the reply. Lean observes the new base price. Neither the input nor the
   replacement handle remains usable after the outer call.
3. Explicitly retain the incoming function before returning a replacement.
   The retained function still computes the original price; releasing its
   lease invalidates the saved handle.
4. Return a host error after constructing an owned reply. The caller gets
   `CALLBACK_FAILED`, not a price. The reply owner is still released.
5. Return a tariff constructed in another session as an otherwise successful
   reply. The caller gets `INVALID_ARGUMENT` and neither session leaks a child.
6. Handle a nested failed exchange from inside a callback. The outer borrowed
   input remains valid and the outer call returns the expected replacement price.

In both error cases, the previous output value is unchanged and no output owner
is published. The [observer used for these receipts](https://github.com/seanmorris/lean-bridge/blob/8407c0eb19e60ad0fb192e149a43b003e3b8b0f5/tests/fixtures/structured-types/tariff-exchange-probe.c)
reads one live identity after **each** scenario, while the client session is
still open, and zero after session close. Each execution record binds the
public client and observer hashes to the actual installed archive's receipt.

The [client used for the original overlap scenario](https://github.com/seanmorris/lean-bridge/blob/1e58182/tests/fixtures/structured-types/tariff-exchange.c)
only checked that the saved borrow was stale **after** disposing the separate
lease. A later C archive (`45f7d4eb…`) still returned 35 through that borrow
while the lease was live. The current client checks this interval explicitly:
the borrow must fail while the retained handle still works. The older receipts
do not establish that stronger property.

With the corrected adapters, C++, Python, Rust, and Ruby passed the overlap
scenario against the original Lean components from both the
[ordinary archive](c-host-input-records-20261126/ordinary.package-set.json)
and the [reviewed archive](c-host-input-records-20261126/reviewed.package-set.json).
In all eight executions the lease still returned 35 after the borrow expired.

To replay the overlap through C++, Python, Rust, and Ruby, set
`LEAN_BRIDGE_FRAME_C_HANDOFF` to the directory containing both C exchange
handoffs and `LEAN_BRIDGE_LEAN_PREFIX` to the matching Lean installation.
Run `npm run test:callback-frame-facades` with a C/C++ compiler, CPython,
Rust and MRI Ruby 3.3. Set `LEAN_BRIDGE_FRAME_PYTHON`, `LEAN_BRIDGE_RUSTC`
or `LEAN_BRIDGE_RUBY` to select an interpreter or compiler.
The test verifies each archive and recompiles the current adapters against
its original compiled Lean component; it does not recompile the Lean code.
Each client compares the borrowed function with its independently retained
copy and with a different function, then calls both saved handles after
the callback returns. Only the retained call may succeed. This is adapter
evidence, not an installation of four separate downstream packages.

Both packages ran locally on Linux x86-64 with Lean 4.32.2 and glibc 2.36.
The ordinary exchange checks ran on a fresh offline install of the exact
verified ordinary archive. The reviewed route ran end to end from a separately
written interface. Both also passed the six original field-ownership cases.

Run `npm run test:c-leased-closure-fields` with the pinned author toolchain.
To keep exact handoffs for offline replay, set `LEAN_BRIDGE_TARIFF_REPLAY_ROOT`
to a private directory with no existing `ordinary/` or `reviewed/` children.
The installed client needs the C toolchain, not Lean. These local results
exercise a **record containing a function**, not a bare function returned by
a host callback or a registration that makes a C callback durable.
