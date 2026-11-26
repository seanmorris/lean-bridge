# Passing an application function in a record

`Owned.Tariff.quote` has type `UInt32 → UInt32`. A tariff can contain an
already leased Lean function, or the caller can supply its own function
for the duration of a call. These are different lifetimes. Returning a
tariff from Lean does not make an application callback permanent.

The C11 binding provides an alternate input record for this second case:

```c
tariff_quotes_tariff_t_host_input tariff = {
    .quote = { .call = quote_from_app, .context = &prices }
};
tariff_quotes_status status = tariff_quotes_apply_tariff_with_host_fields(
    session, &tariff, 2, &price, &owner);
```

The [complete C client](../../tests/fixtures/structured-types/tariff-host-fields.c)
also passes a leased Lean function in the same input layout. That function
keeps its original session and lifetime. The existing return record and
calls accepting a `tariff_quotes_tariff_t` are unchanged.

In Python the generator exposes a separate input dataclass so a type
checker can still tell what comes back from Lean:

```python
from lean_tariff_quotes import TariffInput, apply_tariff

assert apply_tariff(TariffInput(quote=lambda units: 40 + units), 2) == 42
```

Only borrowed record parameters with explicitly selected function fields
get the new form. A copy, transferred owner, lifetime anchor, or callback
reply cannot use it to manufacture a durable function. Nor does a checked
refinement on a Lean-produced closure become a guarantee about a function
written in C or Python.

The compiled C adapter passed the six application cases against the actual
Lean component: direct and reentrant calls, expired callback after echo,
recoverable callback failure, invalid descriptor, and a leased function
used in the wrong session. The separate [observer](../../tests/fixtures/structured-types/tariff-exchange-probe.c)
saw one live identity (the session) after each case and zero after close.
The same client passes against the [ordinary C archive](c-host-input-records-20261126/ordinary.package-set.json)
and the [reviewed C archive](c-host-input-records-20261126/reviewed.package-set.json)
after removing each producer. The [ordinary observations](c-host-input-records-20261126/ordinary.host-fields.json)
and [reviewed observations](c-host-input-records-20261126/reviewed.host-fields.json)
match their respective package receipts. Each records both pkg-config and
relocated CMake executions, plus the independent observer's counts.

The release checks are `npm run test:c-leased-closure-fields` and
`npm run test:leased-closure-fields`; each builds ordinary and reviewed
packages and runs the downstream application after removing the author tree.
Set `LEAN_BRIDGE_C_TARIFF_REPLAY` to a retained directory containing
`ordinary/` and `reviewed/` to verify and install those archives instead of
rebuilding them. Set `LEAN_BRIDGE_CMAKE` if CMake is not at `/usr/bin/cmake`.

## C++ callers

```cpp
namespace api = lean_bridge::tariff_quotes;
auto row = api::TariffInput{[rate = std::make_unique<uint32_t>(40)](uint32_t n) {
    return *rate + n;
}};
assert(api::apply_tariff(row, 2) == 42);
```

`TariffInput` stores the application callable itself; the call does not
copy it or require `std::function`. The result of `echo_tariff` is still
a `Tariff` with a checked lease. Echoing an input with a borrowed function
does not make the application function live longer. Echoing a genuine
Lean function can return a usable lease.

The [C++ client](../../tests/fixtures/structured-types/tariff-host-fields.cpp)
passed six cases against the real C adapter from the ordinary C archive,
including nested calls, expired borrows, and the original exception followed
by a healthy retry. Its independent observer saw only the session between
cases and zero after thread exit. This is a check of freshly generated C++
headers, not yet an installed C++ archive on either source route.
