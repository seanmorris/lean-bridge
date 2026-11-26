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
passed all six cases through relocated CMake consumers of the fresh
[ordinary](cpp-host-input-records-20261126/ordinary.package-set.json) and
[reviewed](cpp-host-input-records-20261126/reviewed.package-set.json) C++ releases.
Both [ordinary](cpp-host-input-records-20261126/ordinary.host-fields.json)
and [reviewed observations](cpp-host-input-records-20261126/reviewed.host-fields.json)
cover a move-only callable, reentry, expired borrows, preservation of the
original exception followed by a healthy retry, a closed input, and an
independently owned returned Lean function. The observer counted one live
identity between cases and zero after thread exit.

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

The [ordinary](rust-host-input-records-20261126/ordinary.host-fields.json)
and [reviewed](rust-host-input-records-20261126/reviewed.host-fields.json)
Cargo releases also passed all seven cases. Both offline installations
rejected a callback with the wrong reply type at compile time. The
relocated observer saw three live identities while the client deliberately
held them, then zero at all eight cleanup checkpoints on each route.
Run `npm run test:rust-staged-callbacks` to build the packages and repeat
the installed checks without the producer tree.

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
Both the [ordinary-source gem](ruby-host-input-records-20261126/ordinary.json)
and the [reviewed-source gem](ruby-host-input-records-20261126/reviewed.json)
passed the six cases after offline installation and relocation. The
live count rose from one to nine in the held-owner control and returned
to one after each case. The [older installed gem results](ruby-function-fields-20261126.md)
only cover leased fields. Use `npm run test:ruby-function-fields` to build
and install both packages.

## C# callers

The [.NET compiler check](../../tests/helpers/dotnet-function-fields-installed.mjs)
passes two input records to one generated method. Each record has two
function fields, a string, and an integer. C# accepts a delegate and a
leased Lean function in the same record, and rejects a delegate returning
a string where the field requires a `uint`.

The [C# consumer](../../tests/fixtures/structured-types/tariff-host-fields.cs)
passed all 14 scenarios on freshly built [ordinary](dotnet-host-input-records-20261126/ordinary.json)
and [reviewed](dotnet-host-input-records-20261126/reviewed.json) NuGet releases.
Each run installed the local archive, relocated the application and executed
it with the .NET runtime and no author tools on its path. The live identity
count rose from one to four while leases were held, returned to one after
reentry, expired borrows, host exceptions and validation, and reached zero
when the owner thread exited. The receipts pin two different archives and
the same consumer source.
Run `npm run test:dotnet-function-fields` for both NuGet authoring routes.
The earlier [leased-field receipts](dotnet-function-fields-20261126.md)
predate these input views and do not qualify delegate inputs.

## Perl callers

The [XS compiler check](../../tests/helpers/perl-function-fields-compiler.mjs)
compiles two record parameters containing two functions, a string and an
integer. It checks the native offsets against C's `offsetof`. The
[Perl consumer](../../tests/fixtures/structured-types/tariff-host-fields.pl)
uses code references and real leased Lean functions in the public input
class. Threaded and unthreaded Perl 5.36.3 and 5.38.2 each ran the
generated XS against the compiled Lean component. All four reported
one identity at baseline, four with live leases, one after each of six
scenarios, and zero after shutdown. Returning a borrowed coderef did not
let Lean invoke it later; an exception retained its Perl object identity.

The [ordinary CPAN package](perl-host-input-records-20261126/ordinary.json)
and [reviewed CPAN package](perl-host-input-records-20261126/reviewed.json)
also passed all six cases after offline installation and relocation. Each
of the eight clients used its matching prebuilt XS, with no author tools
on its search path. Both routes used the same runtime and different
component archives. A [separate replay](perl-host-input-records-20261126/reviewed-xs-536-threaded.json)
installed the reviewed archive both ways on threaded Perl 5.36.3. The
prebuilt and locally compiled XS binaries had different hashes; both passed
the same six cases and loaded the unchanged native payload. This replay
covers one interpreter and one route, not all eight. Run
`npm run test:perl-function-fields` with the four interpreters for both routes.

## Native PHP callers

The [PHP consumer](../../tests/fixtures/structured-types/tariff-host-fields.php)
passes native PHP functions and leased Lean functions in the same typed input
slot. PHP 8.2.35 and 8.5.10 ran the generated FFI adapter against the compiled
Lean component from the [ordinary Composer archive](php-function-fields-20261126/ordinary.json).
On each interpreter the live identity count rose from one to four with both
leases held, returned to one after each of the six cases, and reached zero
at shutdown. An expired borrowed function never reentered PHP; a throwing
field propagated the original exception object and the next valid call worked.

A [separate compiled Lean test](../../tests/helpers/php-function-fields-mixed.mjs)
passed two different records in one call. Each carried two PHP callbacks, UTF-8
text and an integer. Both interpreters returned 78; each of the four callbacks
received its own expected argument. An invalid callback in the second record
prevented all four from running. A weakly typed PHP caller cannot silently
coerce a number to the text field or a numeric string to the integer field.

Both [ordinary](php-host-input-records-20261126/ordinary.json) and
[reviewed](php-host-input-records-20261126/reviewed.json) Composer packages
subsequently passed the callback-input client after offline installation
and relocation. PHP 8.2.35 and 8.5.10 each ran the six input cases from
each package. The input callback ran three times with one reentry; four
identities were live while the leases were held, one after each case, and
zero at shutdown. The two-record test above is a separate check.
Use `npm run test:php-function-fields` to repeat the installed checks.

## JVM record layout

The [C and Java FFM comparison](../../tests/owned-jvm-layout.test.mjs)
measures a record containing two callbacks, a string and a 32-bit integer.
The borrowed input is 88 bytes, with fields at offsets 0, 32, 64 and 80.
The returned Lean record is 40 bytes, with fields at 0, 8, 16 and 32.
Both require 8-byte alignment. The C compiler and JDK 22 agreed on every
measurement.

The [Java](../../tests/fixtures/jvm-tariff/JavaInput.java) and
[Kotlin](../../tests/fixtures/jvm-tariff/KotlinInput.kt) consumers compiled
and ran separately against fresh managed and native adapters and the Lean
component from the [ordinary Maven archive](jvm-function-fields-20261126/ordinary.json).
Both exercised capture, reentry, two ways to return an expired borrow, the
original exception and a successful retry, independent leased results, and
rejection of invalid inputs. Each reported one live identity at every settled
checkpoint, four in the held-lease control, and zero after owner-thread exit.
A [separate compiled Lean call](../../tests/helpers/jvm-function-fields-mixed.mjs)
took two records, each containing two functions, UTF-8 text and an integer.
Java and Kotlin each returned 78 and invoked each of the four functions
once. Neither dispatched a callback when the second record was invalid.
Both native allocations and live identities reached zero at shutdown.
These direct adapter checks are separate from fresh Maven installation;
`npm run test:jvm-function-fields` builds and relocates both authoring routes.

### Installed Java and Kotlin consumers

The [ordinary Maven release](jvm-callback-input-records-20261126/ordinary.json)
and [reviewed Maven release](jvm-callback-input-records-20261126/reviewed.json)
passed separate offline installs. Each archive advertises a call-scoped
`TariffInput.quote`. The clients compile independently against the package:
Java supplies a lambda, and Kotlin supplies a function. They run after the
Maven repository and build inputs have been removed, on a JRE containing
only `java.base` 22.0.2.

On both routes and in both languages, an application callback could capture
state and reenter Lean. Neither a returned record nor a direct function
result could extend the callback's lifetime. An exception came back as the
same object, invalid input did not dispatch, and an explicitly leased Lean
function remained usable. The broker reported one live identity at baseline,
four while leases were held, one again after disposal, and zero after the
owner thread exited. The receipts include separate hashes for the JAR, POM,
source files and executed Java and Kotlin classes.

## PHP-Wasm callers

The Zend generator emits a separate input class for selected callback fields;
it uses the normal wasm32 PHP callback broker and call-scoped cleanup.
The old ordinary Tariff component reconstructed every generated file
byte-for-byte without the new capability. For a new component, the pinned
wasm32 compiler accepted the extension with two callbacks, a string and a
32-bit integer in the same record. In a real PHP 8.4 wasm32 guest, an invalid
callback in the second record failed before dispatch; the first record's
callback count stayed at zero.

The PHP-Wasm producer independently accepted the ordinary Lean source and
the reviewed contract. Their Binding IR digests begin with `6cfc1d0f` and
`5278498c`; the reviewed source digest begins with `758794f3`. Both
authenticated the two input record types. This check stops before packaging.

The [installed consumer](../../tests/fixtures/structured-types/tariff-zend.php)
also checks capture, reentry, expired callbacks, exception identity, retained
leases, and the four distinct callback arguments of the mixed-record call.
Run `npm run test:php-wasm-function-fields` for the ordinary and reviewed
packages in Node and Chromium. The [earlier receipts](php-wasm-function-fields-20261126.md)
predate this input class and do not count for it.

The [ordinary installed package](php-wasm-host-inputs-20261126/ordinary.json)
passed eight runs: Node and Chromium, each loading embedded and Composer
APIs both at startup and lazily. Each run returned 78 from the mixed
record, observed the same four arguments, and returned to zero live owners
after capture, reentry, expiry, a callback exception, retention, validation,
and the mixed call. The installed wasm32 module SHA-256 begins with
`17d8e96e`. This report covers ordinary source only.
