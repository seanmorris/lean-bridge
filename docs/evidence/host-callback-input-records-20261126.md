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

CPython 3.12.14 ran ten cases against each fresh, relocated wheel. The
[ordinary](python-host-input-records-20261126/ordinary.staged.json) and
[reviewed](python-host-input-records-20261126/reviewed.staged.json) results
match their [ordinary wheel receipt](python-host-input-records-20261126/ordinary.package-set.json)
and [reviewed wheel receipt](python-host-input-records-20261126/reviewed.package-set.json).
A nested Python function could reenter Lean; an escaped function could not
call Python again. The client recovered the original exception and rejected
a closed field before dispatch. The independent observer counted one live
identity after each case and zero after the session closed.

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

## Rust callers

```rust
use tariff_quotes::{apply_tariff_with_host_fields, Error, TariffInput};

fn quote_twice() -> Result<(u32, u32), Error> {
    let mut price = 40;
    let mut row = TariffInput {
        quote: |units| { let result = units + price; price += 1; Ok(result) },
    };
    Ok((apply_tariff_with_host_fields(&mut row, 2)?,
        apply_tariff_with_host_fields(&mut row, 2)?)) // (42, 43)
}
```

The callback can borrow a Rust local; it does not need to be `'static`.
Use `TariffInput::from(&leased_tariff)` to pass an existing Lean function
in the same position. A returned tariff still contains a checked Lean lease:
calling it after an application callback's borrow has expired fails without
entering the callback again.

The [Rust client](../../tests/fixtures/structured-types/tariff-host-fields.rs)
ran seven cases against the compiled adapter in the ordinary **C** release.
It preserved a moved error and a caught panic payload, recovered after each,
and rejected both an expired borrow and a closed lease. The independent
observer saw three live identities in its positive control and zero at
every cleanup checkpoint. A separate compiler test mixes two input records,
two function fields, borrowed text and a scalar; Rust rejects dropping the
source while its input view is still in use.

These are adapter and compiler checks, not installed Cargo receipts.
`npm run test:rust-staged-callbacks` builds both source routes, installs each
crate offline, and runs the relocated binaries without the build tree.

## Ruby callers

```ruby
api = LeanBridge::TariffQuotes
row = api::TariffInput.new(quote: ->(units) { units + 40 })
api.apply_tariff_with_host_fields(row, 2) # => 42
```

An application callable is borrowed until this call returns. The same method
accepts an existing Lean function lease. Returning that lease preserves its
own lifetime; returning an application callable does not extend the borrow.
The ordinary `Tariff` result class still accepts only leased functions at
the call boundary.

The [Ruby client](../../tests/fixtures/structured-types/tariff-host-fields.rb)
ran against the compiled ordinary C archive using the generated Fiddle
adapter. It exercised direct invocation, reentry, two ways to return an
expired borrow, the original exception and a successful retry, input
validation, and independent ownership of a returned Lean function. The
broker counted one live identity at baseline, three in the held-owner
control, and one after each of the six cases. The C compiler separately
checked two record parameters containing two functions, a string and a scalar.
These checks are distinct from the [earlier installed gem
results](ruby-function-fields-20261126.md). To run the new end-to-end check,
use `npm run test:ruby-function-fields` to build and install both gems.
