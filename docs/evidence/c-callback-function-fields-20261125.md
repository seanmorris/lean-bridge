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
is published. The [test-only observer](../../tests/fixtures/structured-types/tariff-exchange-probe.c)
reads one live identity after **each** scenario, while the client session is
still open, and zero after session close. Each execution record binds the
public client and observer hashes to the actual installed archive's receipt.

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
