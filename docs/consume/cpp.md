# Use a Lean package from C++

Ordinary-source C++ releases include a generated header, C API, component library and matching Lean runtime. The package README and `lean-bridge-package.json` give its namespace, CMake target and pkg-config name. Loading the package initializes Lean automatically; no separate C package or Lean installation is needed. The walkthrough below uses Alpha's prepared example. Authors can [build C++ packages from ordinary Lean source](../publish/cpp.md#build-an-ordinary-lean-project).

The Alpha C++20 package provides typed values and move-only RAII wrappers over the compiled Lean component. CMake links the component and its shared runtime through one imported target. Ordinary-source and reviewed primitive packages also provide typed callbacks and move-only `LeanClosure` values.

## Use a prepared release

### Requirements and package

Use a C++20 compiler, CMake 3.20 or newer, and tar on Linux x86-64 with glibc 2.38 or newer. The [support contract](../consumer-support.v1.json) records the tested profile.

Request `lean-bridge-alpha-0.0.0-cpp.tar.gz` and the authentication files in [Use a prepared release](receive-package.md). Authenticate the archive before extraction.

## Create the project

Put the archive in your project directory and extract it:

```sh
mkdir -p vendor
tar -xzf ./lean-bridge-alpha-0.0.0-cpp.tar.gz -C vendor
```

Save this file as `CMakeLists.txt`:

```cmake file=cpp/CMakeLists.txt
cmake_minimum_required(VERSION 3.20)
project(lean_alpha_docs CXX)
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
find_package(LeanBridgeAlpha 0.0.0 EXACT CONFIG REQUIRED)
add_executable(consumer main.cpp)
target_link_libraries(consumer PRIVATE LeanBridge::Alpha)
```

## Call Lean

Save this file as `main.cpp`:

```cpp file=cpp/main.cpp
#include <lean_alpha.hpp>
#include <iostream>
#include <stdexcept>

void require(bool condition) {
    if (!condition) throw std::runtime_error("Unexpected Alpha result");
}

int main() {
    try {
        using namespace lean_bridge::alpha;
        Box box{42};
        require(box.read() == 42 && &box.identity() == &box);
        const Payload input{true, 41, "Lean λ", {0, 255}, {0, UINT32_MAX}};
        const auto value = round_trip(input);
        require(!value.enabled && value.count == 42);
        require(value.label == input.label && value.bytes == input.bytes);
        require(value.values == input.values);
        require(with_callback(40, [](std::uint32_t current) { return current + 2; }) == 44);
        auto add_two = make_adder(2);
        require(add_two(40) == 42);
        add_two.close();
        box.close();
        box.close();
        require(box.closed() && add_two.closed());
        std::cout << "Box: 42; payload: 42; callback: 44; closure: 42\n";
    } catch (const std::exception& error) {
        std::cerr << error.what() << '\n';
        return 1;
    }
}
```

Configure, compile, and execute:

```sh
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_PREFIX_PATH="$(pwd)/vendor/lean-bridge-alpha-0.0.0-cpp"
cmake --build build
./build/consumer
```

Expected output:

```text
Box: 42; payload: 42; callback: 44; closure: 42
```

## Values and cleanup

Ordinary-source arrays become `std::vector<T>`, and records become generated structs with owned fields. Both can nest; `Array Bool` uses `std::vector<bool>`. The wrapper keeps input views alive through the call and releases the intermediate C result even if copying a nested result throws. Returned C++ values are independent of the inputs and need no explicit cleanup.

The package enforces the same [copy budget and nesting limit](../publish/c.md#copied-arrays-and-records) as C. Invalid values raise the generated `Error`; C++ allocation failures propagate as `std::bad_alloc`.

### Arrays and records

For an installed [Parcels package](../publish/c.md#copied-arrays-and-records),
save `parcels.cpp`:

```cpp
#include "parcels.hpp"
#include <iostream>

namespace api = lean_bridge::parcels;

int main() {
    const api::Parcel input{"Seeds", {2, 7}};
    auto output = api::reverse(input);
    std::cout << output.label << ": " << output.counts[0]
              << ", " << output.counts[1] << '\n'; // Seeds: 7, 2
    output.counts[0] += 1;
    std::cout << input.counts[1] << '\n'; // 7; output owns a separate copy
    return output == api::Parcel{"Seeds", {8, 2}} ? 0 : 1;
}
```

Compile with the package's CMake target or pkg-config flags. Records support
field-by-field `==`, including nested vectors and arbitrary integers.
Floating-point fields retain ordinary C++ equality: NaN is unequal to itself
and signed zeros compare equal. Use `std::isnan` or `std::signbit` when those
distinctions matter. Field names follow the generated C API, including keyword
escaping such as `char_`.

The [installed collection checks](../evidence/native-collections-20260921.md)
cover both source paths and verify cleanup when C++ result allocation throws.

### Lists

Lean `List T` uses owned `std::vector<T>`, including `std::vector<bool>`. Lists preserve order, duplicates and nested copied values. Inputs stay alive for the call, and returned vectors own independent copies. The contract retains the distinction between Lean Lists and Arrays. The [installed List checks](../evidence/native-lists-20260920.md) cover both source paths. Lists also work as synchronous callback and returned-closure arguments and results.

### Named aliases

Concrete Lean aliases become source-named C++ `using` declarations. For example,
`abbrev Count := UInt32` produces `using Count = uint32_t` in the package namespace.
Aliases of copied records and containers reuse their generated C++ types, so an
alias of `Array (List UInt32)` uses `std::vector<std::vector<uint32_t>>`.

Use aliases as their target values. They add no wrapper or conversion and keep
the target's validation, copying and automatic cleanup. An alias of `Nat` still
rejects a negative input. The
[installed alias checks](../evidence/native-aliases-20260921.md) cover all nineteen
primitives, chains, records and nested containers on both build paths.

### Exact integers and callable APIs

Ordinary-source and reviewed primitive packages use `boost::multiprecision::cpp_int` for both `Nat` and `Int`. The generated namespace also provides `Nat` and `Int` aliases. A negative value passed as `Nat`, including a record field or callback result, raises `Error`. Arithmetic uses ordinary Boost operations; there are no public limb buffers to construct.

The prepared archive includes pinned Boost 1.90.0 standalone headers when needed. Its CMake target and pkg-config flags set the include path and `BOOST_MP_STANDALONE`. Use those settings consistently across translation units, including any that include Boost directly. Consumers do not fetch Boost or compile Lean.

For example, a package exporting the [callable fixture](../../tests/fixtures/onboarding/callables/Callables.lean) supports this `main.cpp`:

```cpp
#include "callables.hpp"
#include <iostream>

namespace api = lean_bridge::callables;

int main() {
    const api::Nat large = api::Nat(1) << 200;
    const auto incremented = api::call_nat(large, [](api::Nat n) -> api::Nat {
        return n + 1;
    });
    auto choose = api::make_nat(incremented);
    std::cout << choose.call(true, 0) << '\n';
    // choose releases its Lean closure when it leaves scope.
}
```

Callbacks receive owned values and return the declared type exactly. The explicit `-> api::Nat` above converts Boost's arithmetic expression into a value before returning. `Unit` arguments use `std::monostate`; `Unit` results return `void`. Callback exceptions are rethrown in C++ after the native call returns, with the original exception type and payload.

Returned `LeanClosure<Result(Args...)>` values are move-only. Use `call(...)` or `operator()`, let destruction release them, or call `close()` explicitly. Repeated close is safe; `is_closed()` also identifies moved-from values. Invocation and explicit close must stay on the creating thread. Moving a closure to another thread does not make it callable there. Shared-object access still follows C++ synchronization rules. Start a fresh process after `fork` before using Lean.

The [installed primitive checks](../evidence/cpp-callables-20260919.md) cover all nineteen primitives, both source paths, invalid conversions, exceptions and allocation failures. Alpha's older named `Transform` wrapper below is a separate example API.

### Bounded integers

A Lean `Fin n` parameter or result uses the same `cpp_int` as `Nat`. For `Library.mirror (value : Fin 10) : Fin 10`, `mirror(3)` returns `6`. `mirror(10)` and `mirror(-1)` throw `Error` with `status == LIBRARY_STATUS_INVALID_ARGUMENT`. The check runs before Lean is called, so a later valid call still works. `Fin 0` parameters reject every value, and bounds wider than 64 bits are compared exactly. The header does not repeat the bound; read it from the Lean signature or the packaged `binding-ir.json`. Top-level parameters and results are supported, including inside `Array`, `List` and `Option` (for example `Array (Fin 10)` or `Option (List (Fin 10))`): every element is checked before Lean is called, an empty array or `none` is valid even for `Fin 0`, and a rejection names the parameter and the bound of the element that failed. Both ordinary-source and reviewed packages also check `Prod` and active `Except` branches, including arrays of products. Closed nonrecursive record and active variant fields retain their bounds through these containers. The [product reports](../evidence/native-fin-products-20261007/receipt.json), [Array reports](../evidence/native-fin-product-array-dispatch-20261007/receipt.json) and [field reports](../evidence/native-fin-records-20261007/receipt.json) record the installed C/C++ checks. Refined callbacks and generic or recursive native fields remain unaudited. Source-dispatch counters were measured in C only.

### Checked values

A Lean `Subtype` parameter or result over a primitive base, such as `{ value : String // value.length > 0 }`, uses the base's usual type. The package runs the author's checked constructor from the export contract before the exported function; a rejected value fails the call with the same invalid-argument error as a `Fin` bound, with the message naming the parameter and constructor (`arg0 was rejected by Library.checkedWord`), and caller data stays unchanged. The exported function receives the constructed value, which a normalizing constructor may change. The package README names each constructor. Only top-level parameters and results are supported; see the [installed checks](../evidence/native-subtype-20261007.md).

### Checked records and fixed indices

Use the generated value record with its payload fields: `Interval` has `lo` and `hi`, `Sized 3` has a `data` vector, and `Bounded 0 101` has `value`. Natural-number payloads use `boost::multiprecision::cpp_int`. Proof fields are absent from the host record; normal value ownership handles result cleanup.

The constructor selected by the package validates each input site before Lean receives the record. It rejects invalid intervals, lengths and bounds, or normalizes a copied payload without changing your input. The same record type can use different constructors at different functions. Results expose fields from a record Lean already constructed, including packages with no checked input.

The [ordinary, reviewed and result-only runs](../evidence/checked-records-20261008/receipt.json) cover these top-level C++ mappings. Nested checked records, refined payloads, other indices and general dependent runtime values are not covered. Dispatch was measured only in the C process. These packages declare glibc 2.38, while the local runner measured host glibc 2.36.

### Structured callbacks and closures

Callbacks and returned closures also accept arrays, Lists, options, results, products, copied records, tagged variants and their aliases. They use the same owned C++ types as ordinary calls. A callback can return a different constructor or container size. Returned Lean closures retain independent copies of captured values.

For the [structured callable fixture](../../tests/fixtures/onboarding/structured-callables/Structured.lean), save `structured.cpp`:

```cpp
#include "structured.hpp"
#include <cassert>

namespace api = lean_bridge::structured;

int main() {
    const api::Payload input{"Seeds", {std::nullopt, std::string("found")},
                             api::Nat(1) << 200, std::nullopt};
    const auto output = api::call_record(input, [](api::Payload value) {
        value.count += 1;
        value.rows.emplace_back("visited");
        return value;
    });
    assert(output.count == input.count + 1);
    assert(input.rows.size() == 2 && output.rows.size() == 3);
    auto choose = api::make_record(output);
    assert(choose.call(true, input) == output);
    assert(choose.call(false, input) == input);
}
```

Use the archive's CMake target or pkg-config flags to compile it. Callback results must have the declared value type, not a borrowed reference. C++ exceptions retain their original type when rethrown; partial conversions release their storage before the exception reaches the caller.

The [installed structured checks](../evidence/cpp-structured-callables-20260924.md) cover all eight acyclic shapes on both source paths, nested empty and nonempty constructors, allocation failures and compiler-free deployment. These signatures allow acyclic copied types up to 32 levels deep and share the 16 MiB native conversion budget. Recursive callback values use the graph API below. Resources inside copied values, nested callback identities and asynchronous calls remain unsupported.

### Recursive callbacks

Recursive callbacks use the same named variants and owned containers as ordinary
recursive calls. Arguments, returned values and captured values own independent
copies. For the [publisher example](../publish/c.md#export-recursive-callbacks),
save `recursive-callables.cpp`:

```cpp file=cpp/recursive-callables.cpp
#include "structured.hpp"
#include <cassert>
#include <iostream>

namespace api = lean_bridge::structured;

int main() {
    const api::Tree input = api::TreeBranch{{api::TreeLeaf{42}}};
    const auto output = api::call_recursive(input, [](api::Tree value) {
        auto &children = std::get<api::TreeBranch>(value.value).children;
        std::get<api::TreeLeaf>(children.at(0).value).value += 1;
        return value;
    });
    const api::Tree expected = api::TreeBranch{{api::TreeLeaf{43}}};
    assert(output == expected && input != output);
    auto choose = api::make_recursive(output);
    assert(choose.call(true, input) == expected);
    assert(choose.call(false, input) == input);
    std::cout << "43\n";
}
```

Compile with the installed archive's CMake target or pkg-config flags. The program
prints `43`. Recursive callbacks keep the same exact return-type checking,
exception propagation and creator-thread closure rules as other C++ callbacks.
They share the graph's 128-level, 262,144-node and 16 MiB native-copy limits across
arguments, callbacks and results. Each constructor or container edge counts
toward depth; the 64-active-call and 4,096-live-identity limits still apply.
C and C++ headers from the same release work in either include order and link to
one runtime.

### Options, results and products

| Lean | C++ |
| --- | --- |
| `Option T` | `std::optional<T>` |
| `Option Unit` | `std::optional<std::monostate>` |
| `Except E T` | `Result<T, E>` (`std::variant<Ok<T>, Err<E>>`) |
| `A × B` | `std::pair<A, B>` |

`std::nullopt`, an engaged Unit value and an engaged empty optional remain distinct. `Ok<T>` and `Err<E>` each have a `value` member, so success and error remain distinct even when `T` and `E` are the same type. A domain error returns `Err<E>`; boundary failures throw the generated `Error`. Nested products remain nested pairs. These values can also appear inside arrays and generated record fields. Returned values own their contents and release them automatically. The [installed compound checks](../evidence/native-compounds-20260920.md) cover both build paths.

### Tagged variants

Each Lean constructor has a named C++ struct. The Lean type becomes a
`std::variant` of those structs. For the
[variant example](../../tests/fixtures/onboarding/native-variants/Variants.lean):

```cpp
#include "variants.hpp"
#include <cassert>

namespace api = lean_bridge::variants;

int main() {
    api::Signal input = api::SignalData{41, "ready"};
    const auto output = api::next(input);
    const auto& data = std::get<api::SignalData>(output);
    assert(data.count == 42 && data.label == "ready!");

    const auto stopped = api::next(api::SignalIdle{});
    assert(std::holds_alternative<api::SignalStopped>(stopped));
}
```

Use `std::get`, `std::holds_alternative` or `std::visit` with the named
alternatives. Empty constructors remain distinct types; a Unit payload uses
`std::monostate`. You do not supply constructor numbers. Payloads can contain
supported primitives, records, variants, arrays, Lists, options, results and
products. Returned strings and containers own their storage, independently of
the inputs and other returned fields. Constructor fields use snake_case; C++
keywords gain a trailing underscore, as in `bool_` and `char_`. Naming collisions
reject during generation.

The [installed variant checks](../evidence/cpp-variants-20260921.md) cover both
source paths, malformed inputs and allocation-failure cleanup. Variant callback
payloads and identity-bearing fields remain separate work.

## Recursive copied values

Packages containing recursive types expose named structs, owned standard
containers and `Box<T>` where a recursive field needs indirection. Copying a box
duplicates its contents. Variant constructors remain named types; inspect their
`value` member with `std::get`, `std::holds_alternative` or `std::visit`.

For the recursive acceptance package:

```cpp
#include <recursive.hpp>
#include <cassert>

int main() {
    namespace api = lean_bridge::recursive;
    const api::Spine input = api::SpineNext{api::SpineLeaf{41}};
    const auto output = api::spine(input);
    const auto& next = std::get<api::SpineNext>(output.value);
    assert(std::get<api::SpineLeaf>(next.value->value).value == 41);
}
```

The package loads its shared Lean runtime automatically. Results own independent
copies, including exact Boost integers. Required empty boxes reject; nested
options preserve `None` versus `Some(None)`.

Calls share limits of 128 levels, 262,144 visited nodes and 16 MiB native copied
storage across inputs and result. C++ conversion storage has a separate 16 MiB
budget. Invalid values and exceeded limits throw `Error` with status
`INVALID_ARGUMENT`. C++ allocation failures propagate `std::bad_alloc`; scoped
cleanup releases the native result. Malformed results retire the shared runtime.
See the [C++ conversion checks](../evidence/cpp-recursive-conversions-20260922.md).

## Resource-containing values

Packages built with an explicit [aggregate ownership policy](../publish/cpp.md#resource-containing-values)
support resources inside records, variants and containers, including recursive
values. They ship their C adapter, Lean runtime, GMP and any required Boost headers.
Use the package's CMake target or pkg-config flags; no separate runtime setup or
Lean installation is needed.

Containers own their copied storage. Resource leaves have named wrapper types,
such as `Ticket`, and preserve their underlying identity. Copying a wrapper shares
its result lease. `close()` releases that wrapper, while other owning copies stay
usable. `retain()` creates an independent lease. Default-constructed, moved-from
and closed wrappers reject calls.

Resource arguments passed into a callback are borrowed until that invocation
returns. Copying the wrapper does not extend the borrow. Retain a resource inside
the callback when it needs to survive the call. For the
[owned-value example](../../tests/fixtures/onboarding/owned-cpp-composition/Owned.lean):

```cpp
#include "owned_aggregates.hpp"
#include <cassert>

namespace api = lean_bridge::owned_aggregates;

int main() {
    auto first = api::new_ticket(41, "saved");
    const api::Bundle input{first, std::nullopt, {first}, {}, {-7, {0, 255}}};
    api::Ticket borrowed, kept;
    auto output = api::callback_record(input, [&](const api::Bundle& value) {
        borrowed = value.primary;
        kept = value.primary.retain();
        return value;
    });
    assert(borrowed.is_closed());
    assert(api::serial(kept) == 41);
    assert(output == input);
}
```

Returned closures in this ownership API use function-call syntax, `close()`,
`is_closed()` and `retain()`. They can receive typed host callbacks, including
mutable function objects. A retained Lean closure cannot extend a captured host
callback's call-scoped lifetime.

Factories without a usable failure-path value in their arguments require
`with_recovery(callback, value)`. The recovery must have the callback's declared
result type and pass normal input validation. For example:

```cpp
auto fallback = api::new_ticket(0, "recovery");
auto created = api::factory(api::with_recovery(
    [](const std::monostate&) { return api::new_ticket(42, "created"); },
    fallback));
```

Failure never returns the recovery as a successful result. C++ exceptions retain
their original type and payload after C and Lean cleanup. Later host callbacks
in that failed call are suppressed; subsequent independent calls can recover.

Resource calls belong to the creating thread and process. Foreign-thread
destruction queues cleanup for the creator; it does not allow foreign-thread
calls. Thread exit releases registered owners and invalidates escaped wrappers.
Objects inherited through `fork` reject use.

Each call shares 128-level, 262,144-visit and 16 MiB native/storage conversion
budgets across inputs, callbacks and output. Boundary failures throw `Error` with
a `status` member; C++ allocation failures throw `std::bad_alloc`. The
[owned-value checks](../evidence/owned-cpp-values-20260927.md) exercise both source
paths, boxed recursion, nested options, retained resources and source-free installs.
The inventory below retains its separately audited copied-value and Alpha cells.

### Transferred inputs

When the author [selects input transfer](../publish/cpp.md#transfer-input-ownership),
the generated function takes an rvalue reference. Pass `std::move(value)` or a
temporary. The bridge validates every argument before consuming any resource
lease. Validation failures preserve the inputs. Once Lean starts, the submitted
leases and their aliases are closed, even if the call later fails.

For the transfer-enabled `Owned` example, save `owned-transfers.cpp`:

```cpp file=cpp/owned-transfers.cpp
#include "owned_aggregates.hpp"
#include <cassert>
#include <iostream>
#include <utility>

namespace api = lean_bridge::owned_aggregates;

int main() {
    auto input = api::new_ticket(41, "saved");
    auto alias = input;
    auto kept = input.retain();
    auto output = api::retain_ticket(std::move(input));
    assert(input.is_closed() && alias.is_closed());
    assert(api::serial(kept) == 41);
    assert(api::serial(output) == 41);
    std::cout << "transferred\n";
}
```

Compile it with the package's CMake target or pkg-config flags. `retain_ticket`
is this example's transfer-enabled Lean export; the wrapper's `retain()` method
always creates an independent owner without consuming its input.

A host-assembled record or container may contain resources from several leases.
The call consumes each submitted lease as a whole, including sibling resources
outside the submitted value. Two transferred arguments cannot share a lease.
Call `retain()` first when a sibling or another argument must remain usable.
Copied fields remain ordinary C++ values.

Callbacks observe consumed inputs as closed before their body runs. Their own
resource arguments borrow the callback's lifetime and cannot be transferred;
retain those resources before passing them to a consuming export. Returned Lean
closures can be moved under the same rules. Moving does not change the creating
thread or process.

### Borrowed results

Packages with [parameter-anchored results](../publish/cpp.md#anchor-a-result-to-an-input)
return resource-containing values as `Value<T>`. This wrapper keeps the original
result owner even for an empty vector, `None`, or an empty variant. `get()`, `*`
and `->` check that owner before exposing the C++ value.

```cpp file=cpp/owned-borrows.cpp
#include "owned_aggregates.hpp"
#include <cassert>
#include <iostream>

namespace api = lean_bridge::owned_aggregates;

int main() {
    auto owner = api::new_ticket(42, "example");
    auto borrowed = api::retain_ticket(owner);
    auto kept = borrowed.retain();
    assert(borrowed == owner);
    owner.close();
    assert(borrowed.is_closed());
    std::cout << api::serial(kept) << '\n';
}
```

Copying `Value<T>` shares its immutable storage and owner. `close()` releases that
copy; the owner remains alive while another owning copy or extracted resource
wrapper holds it. A borrowed result does not keep its anchor alive. Releasing the
last owning reference or transferring the owner expires every borrowed descendant.
Calling `retain()` or `copy_value(value)` creates an independent owner.

Use `copy_value(rawValue)` to give a resource-containing record or container its own
owner before passing it as an anchor. Anchor parameters require `Value<T>`, not a
raw container. In these packages, transferred parameters take `Value<T>&&` and
consume the original owner. Borrowed values must be retained before transfer. A
call cannot transfer its own result's anchor or an ancestor of that anchor.

Call `get()` again when you need a fresh lifetime check. A previously obtained
C++ reference does not check later access automatically; copied resource wrappers
still reject use after their borrowed lifetime ends. Resource equality uses Lean
identity, including when the two wrappers belong to different result owners.

### Callback-result owners

A returned Lean closure can borrow its result from one of its arguments. Pass
that argument as `Value<T>`. The result expires with the supplied argument's
original owner, even when Lean returns data from the closure's capture. Closing
the closure does not close the supplied argument's owner.

```cpp file=cpp/owned-callback-results.cpp
#include "owned_aggregates.hpp"
#include <cassert>
#include <iostream>

namespace api = lean_bridge::owned_aggregates;

int main() {
    auto ticket = api::new_ticket(42, "callback");
    api::Bundle raw{ticket.get(), {}, {}, {}, {api::Int(0), {}}};
    auto captured = api::echo_record(raw);
    auto supplied = api::echo_record(raw);
    auto closure = api::make_record(captured);
    auto borrowed = closure(true, supplied);
    auto kept = borrowed.retain();
    supplied.close();
    assert(borrowed.is_closed());
    captured.close();
    closure.close();
    std::cout << api::serial(kept->primary) << '\n';
}
```

Borrowed descendants expire transitively, including empty recursive values.
`retain()` and `copy_value()` create independent owners. Callback-result anchors
do not require ordinary result anchors, receiver methods, or host callbacks.

For a host callback with a borrowed result contract, return the declared `T` or
`Value<T>`. Lean Bridge checks the reply and retains its resource contents before
the callback's borrowed arguments expire. An expired reply rejects. Exceptions
retain their C++ type and rethrow after native cleanup. Host callbacks remain
synchronous and call-scoped.

When a consuming method invokes a callback, aliases and borrowed descendants
close before that callback runs. A failure before the native handoff leaves the
input usable; a failure after the handoff leaves it consumed. Independent retains
survive either case.

### Methods and properties

Packages with [receiver exports](../publish/cpp.md#export-methods-and-properties)
provide named members on `Value<T>`. Properties use zero-argument const accessors.
Names use snake case: Lean's `retainTicket` becomes `retain_ticket()`.

```cpp file=cpp/owned-receivers.cpp
#include "owned_aggregates.hpp"
#include <cassert>
#include <iostream>

namespace api = lean_bridge::owned_aggregates;

int main() {
    auto owner = api::new_ticket(42, "receiver");
    auto view = owner.retain_ticket();
    auto kept = view.retain();
    std::cout << view.serial() << '\n';
    owner.close();
    assert(view.is_closed());
    std::cout << kept.serial() << '\n';
}
```

A receiver-bound result expires with its receiver's original owner. A method
can instead borrow another argument's owner; closing an unrelated receiver does
not expire that result. Copied properties, including strings and integers, own
their storage after the call.

Consuming methods require `std::move(value).method(...)`. Passing an lvalue or
const receiver to them fails compilation. Non-consuming properties on resource
leaves, such as `bundle->primary.serial()`, keep the same lifetime checks as free
functions. Record fields remain fields; `bundle.primary()` is the exported
property, while `bundle->primary` reads the record's field.

Receiver packages return resource-containing values as `Value<T>` even when
they have no borrowed-result exports. `retain()` and `copy_value()` create
independent owners; generated free functions remain available.

### Type conversions

Profiles: C++. Installed checks apply only to the named positions and package path. Generator inspection records syntax without compiled acceptance. Not audited means type-specific evidence is missing.

The [conversion rules](../reference/types.md#full-type-surface) cover ranges, copying, ownership, nulls and errors. The [audit inventory](../type-surface.v1.json) records commands, source hashes, limitations and implementation owners.

| Lean type or source form | Host representation | Current evidence | Conversion rules |
| --- | --- | --- | --- |
| `Unit` | `std::monostate` (input, field, callback input); `void (no output)` (result, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Pass std::monostate; Unit results return void. Required: One inhabitant. A result with no host return value still requires an explicit argument and field mapping. |
| `Bool` | `bool` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Typed bool values. Callback result types must match exactly. Required: Exactly two Boolean values; do not coerce numbers or strings. |
| `UInt8` | `uint8_t` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Exact-width C++ integers. C++ conversions occur before API entry; check wider or signed values before conversion. Callback result types must match exactly. Required: 0..255; reject overflow before narrowing. |
| `UInt16` | `uint16_t` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Exact-width C++ integers. C++ conversions occur before API entry; check wider or signed values before conversion. Callback result types must match exactly. Required: 0..65535; reject overflow before narrowing. |
| `UInt32` | `uint32_t` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Exact-width C++ integers. C++ conversions occur before API entry; check wider or signed values before conversion. Callback result types must match exactly. Required: 0..4294967295, including on hosts with 32-bit signed integers. |
| `UInt64` | `uint64_t` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Exact-width C++ integers. C++ conversions occur before API entry; check wider or signed values before conversion. Callback result types must match exactly. Required: 0..18446744073709551615; no conversion through a floating-point host number. |
| `Int8` | `int8_t` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Exact-width C++ integers. C++ conversions occur before API entry; check wider or signed values before conversion. Callback result types must match exactly. Required: -128..127; reject overflow before narrowing. |
| `Int16` | `int16_t` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Exact-width C++ integers. C++ conversions occur before API entry; check wider or signed values before conversion. Callback result types must match exactly. Required: -32768..32767; reject overflow before narrowing. |
| `Int32` | `int32_t` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Exact-width C++ integers. C++ conversions occur before API entry; check wider or signed values before conversion. Callback result types must match exactly. Required: -2147483648..2147483647; reject overflow before narrowing. |
| `Int64` | `int64_t` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Exact-width C++ integers. C++ conversions occur before API entry; check wider or signed values before conversion. Callback result types must match exactly. Required: -9223372036854775808..9223372036854775807; preserve exact values. |
| `Nat` | `boost::multiprecision::cpp_int` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Exact Boost.Multiprecision 1.90.0 cpp_int values. Prepared archives include standalone headers. Negative Nat inputs reject in all positions. Required: No fixed bit-width limit. Reject negative inputs and enforce documented allocation limits. |
| `Int` | `boost::multiprecision::cpp_int` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Exact signed Boost.Multiprecision 1.90.0 cpp_int values. Prepared archives include standalone headers. Required: Preserve sign and magnitude without narrowing; enforce documented allocation limits. |
| `Float32` | `float` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | C++ float values preserve binary32 subnormals, signed zero, infinities and NaN classification. Callback results must return float. Required: Round to binary32. Specify NaN, infinities and signed zero; do not claim NaN payload preservation without a bit-level test. |
| `Float` | `double` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | C++ double values preserve binary64 subnormals, signed zero, infinities and NaN classification. Callback results must return double. Required: Preserve binary64 values, NaN classification, infinities and signed zero. |
| `String` | `std::string` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Length-delimited valid UTF-8, including embedded NUL. Invalid UTF-8 is rejected before the Lean call. Length-delimited valid UTF-8, including embedded NUL. Invalid UTF-8 rejects. Callback arguments and results own their strings. Required: Preserve Unicode scalar values and embedded NUL. Reject invalid encodings; declare byte and allocation limits. |
| `ByteArray` | `std::vector<uint8_t>` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Copied uninterpreted bytes. Clear owned C outputs; C++ vectors own their data. Owned `std::vector<uint8_t>` values preserve uninterpreted bytes, including NUL. Required: Each byte is 0..255. Preserve zero bytes and owned result storage; declare copy limits. |
| `Array α` | `std::vector<T>` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Owned `std::vector<T>`, including `std::vector<bool>`; scoped views preserve all nested input storage. Returned values are independent copies. Standard containers and generated value types retain nested constructors and independent ownership. Typed callbacks must return the declared value, not a reference. Exceptions rethrow after native cleanup; RAII releases partial inputs/results and returned closures. Expired borrows, invalid values, post-fork and wrong-thread use reject. Owned `std::vector` values preserve all nineteen primitive elements, order, duplicates, empty and nested arrays and records, including `std::vector<bool>`. Output storage is independent. Required: Validate every element recursively, length and allocation limits. Array UInt32 alone does not cover Array α. |
| `Option α` | `std::optional<T>` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Disengaged, engaged Unit and engaged empty optional remain distinct. Returned payloads own their storage. Standard containers and generated value types retain nested constructors and independent ownership. Typed callbacks must return the declared value, not a reference. Exceptions rethrow after native cleanup; RAII releases partial inputs/results and returned closures. Expired borrows, invalid values, post-fork and wrong-thread use reject. Required: Keep none, some unit and nested options distinct; do not flatten them all to null. |
| `Except ε α` | `Result<T, E> = std::variant<Ok<T>, Err<E>>` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | `Ok<T>` and `Err<E>` wrappers each hold value, preserving branch identity even for equal payload types. Domain errors do not throw boundary exceptions. Standard containers and generated value types retain nested constructors and independent ownership. Typed callbacks must return the declared value, not a reference. Exceptions rethrow after native cleanup; RAII releases partial inputs/results and returned closures. Expired borrows, invalid values, post-fork and wrong-thread use reject. Required: Preserve the success/error branch and both payload types. Lower Except ε α to IR result arguments [α, ε], in success/error order. |
| `Prod α β / tuples` | `std::pair<A, B> (nested binary products)` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | std::pair retains binary nesting, per-position types and owned copied contents. Standard containers and generated value types retain nested constructors and independent ownership. Typed callbacks must return the declared value, not a reference. Exceptions rethrow after native cleanup; RAII releases partial inputs/results and returned closures. Expired borrows, invalid values, post-fork and wrong-thread use reject. Required: Preserve arity, nesting and per-position types; do not infer tuples from arbitrary arrays. |
| `Copied structure` | `generated record struct` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Generated structs with owned fields and deep result cleanup on exceptions. Empty records use empty structs. Standard containers and generated value types retain nested constructors and independent ownership. Typed callbacks must return the declared value, not a reference. Exceptions rethrow after native cleanup; RAII releases partial inputs/results and returned closures. Expired borrows, invalid values, post-fork and wrong-thread use reject. Named structs preserve fields and nested values with defaulted field-by-field equality. Keyword fields gain a trailing underscore. Floating-point equality follows C++ semantics. Returned values release automatically, including partial output copies when allocation throws. Required: Preserve every field and mutability rule. A Payload example is not evidence for arbitrary records. |
| `Type alias` | `Source-named using declaration for the owned C++ target type` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Transparent target values, validation and ownership. Aliases add no wrapper; returned C++ containers and records own their copies. Aliased Nat still rejects negative input. Standard containers and generated value types retain nested constructors and independent ownership. Typed callbacks must return the declared value, not a reference. Exceptions rethrow after native cleanup; RAII releases partial inputs/results and returned closures. Expired borrows, invalid values, post-fork and wrong-thread use reject. Required: Resolve aliases without losing constraints, identity or ownership; reject alias cycles. |
| `Inductive sum` | `std::variant of named constructor structs` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Named alternatives retain constructor identity, including empty cases and Unit payloads. Use std::get, std::holds_alternative or std::visit; no public constructor numbers. Payloads and results own independent storage. C++ keywords in fields gain a trailing underscore; naming collisions reject. Invalid input and budget failures throw Error; C++ allocation failures propagate std::bad_alloc with intermediate native cleanup. Standard containers and generated value types retain nested constructors and independent ownership. Typed callbacks must return the declared value, not a reference. Exceptions rethrow after native cleanup; RAII releases partial inputs/results and returned closures. Expired borrows, invalid values, post-fork and wrong-thread use reject. Required: Preserve constructor identity and payloads without exposing Lean constructor numbers. |
| `Identity-bearing value` | `Box` (result) | Ordinary source: Not audited. Reviewed IR: Not audited (input, field, callback input, callback result); Generator inspected (result) | Required: Preserve cross-component identity and explicit disposal; reject stale or foreign resources. |
| `Host function passed to Lean` | `typed C++ callable` (input) | Ordinary source: Installed checks passed (input); Not audited (result, field, callback input, callback result). Reviewed IR: Installed checks passed (input); Not audited (result, field, callback input, callback result) | Call-scoped borrow; typed owned callback arguments; original C++ exceptions rethrow after native cleanup. Same-thread nested calls are supported. Required: Preserve argument/result types, re-entry, invocation count, self-disposal and errors. |
| `List α` | `std::vector<T>` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Owned `std::vector<T>`, including `std::vector<bool>`. Lists preserve order, duplicates and nesting with independent results. List and Array retain distinct IR constructors. Standard containers and generated value types retain nested constructors and independent ownership. Typed callbacks must return the declared value, not a reference. Exceptions rethrow after native cleanup; RAII releases partial inputs/results and returned closures. Expired borrows, invalid values, post-fork and wrong-thread use reject. Required: Preserve order, duplicates and nesting with a distinct list constructor. Validate all elements and copying limits; never expose Lean cons cells. |
| `Char` | `char32_t` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Exactly one Unicode scalar, 0..0x10FFFF excluding surrogates. NUL, supplementary characters, combining scalars, noncharacters and line endings are preserved without normalization. Multi-scalar grapheme clusters require String. The shared C boundary rejects out-of-range values before calling Lean. Required: 0..0x10FFFF excluding 0xD800..0xDFFF; not one UTF-16 code unit or an arbitrary string. |
| `USize` | `uint64_t` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | 64-bit compiled Lean target, 0..18446744073709551615. C++ conversions occur before API entry; check wider or signed values before conversion. Lean arithmetic wraps at the compiled width. Required: Bind width to the compiled Lean target, not the consumer process; reject out-of-range values. |
| `ISize` | `int64_t` (input, result, field, callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | 64-bit compiled Lean target, -9223372036854775808..9223372036854775807. C++ conversions occur before API entry; check wider values before conversion. Lean arithmetic wraps at the compiled width. Required: Bind signed width to the compiled Lean target and record architecture explicitly. |
| `Fin n` | `GMP mpz_srcptr (C) or boost::multiprecision::cpp_int (C++) checked against the declared bound` (input); `GMP mpz_ptr (C) or cpp_int (C++) below the declared bound` (result); `GMP integer (C) or cpp_int (C++) checked against the field's closed bound` (field) | Ordinary source: Installed checks passed (input, result, field); Not audited (callback input, callback result). Reviewed IR: Installed checks passed (input, result, field); Not audited (callback input, callback result) | Use Nat values with their declared closed bounds through arrays, lists, options, products and active Except branches. Every present constrained leaf is checked; empty or absent Fin 0 containers remain valid. Record and active variant fields keep Nat values and exact closed bounds. Constraints also apply inside their structural containers; an inactive Fin 0 branch is not constructed or read. Required: Keep the bound and validate it before erasing proof fields. Fin 0 has no constructible value. |
| `Subtype / {x // p x}` | `GMP mpz_t, const char and uint8_t spans or cpp_int, std::string and std::vector<uint8_t>, checked by the exported Lean validator and constructed by the adapter before dispatch` (input); `the base value projected from the proof-backed Lean result` (result) | Ordinary source: Installed checks passed (input, result); Not audited (field, callback input, callback result). Reviewed IR: Installed checks passed (input, result); Not audited (field, callback input, callback result) | Values cross as their base. The exported validator and the adapter each run the author's checked constructor independently; the export receives the constructed value. Reviewed Binding IR selects the checked constructor, including normalizing constructors that preserve the caller's input. Required: Generate a checked constructor when validation is executable; require explicit decisions for non-decidable predicates. |
| `Checked records and closed Nat indices` | `Generated value record with cpp_int and vector payload fields` (input); `Generated owning value record with cpp_int and vector payloads` (result) | Ordinary source: Installed checks passed (input, result); Not audited (field, callback input, callback result). Reviewed IR: Installed checks passed (input, result); Not audited (field, callback input, callback result) | Pass only payload fields: Interval {lo, hi}, Triple {data} for Sized 3, and Percent {value} for Bounded 0 101. Input constructors validate cross-field predicates or normalize values inside Lean without changing caller input. Results expose payload fields, not proofs. A standalone result-only package works without any checked input. Other indices, nested/refined/recursive records and dynamic dependent payloads are not covered. Required: Construct inputs only through the selected safe Lean constructor over the exact payload fields. Preserve closed indices and per-site choices; project proof-backed results without fabricating proofs. |
| `Dependent parameters and results` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve the dependency through a checked lowering or a reviewed exclusion; never discard it as an implicit argument. |
| `Recursive copied structures` | `Named structs and variants, standard containers and deep-copy Box<T>` (input, result, field); `Named C++ variants, owned containers and recursive Box<T> values` (callback input, callback result) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Owned standard containers and named alternatives retain recursive identities. Copying `Box<T>` makes an independent copy; missing required boxes reject. Scoped cleanup releases native output on exceptions. Invalid input or limits throw Error; C++ allocation failures throw std::bad_alloc. Callbacks receive owned recursive values and return the exact declared type. Exceptions retain their original type. Returned move-only LeanClosure values retain independent captures and stay bound to the creator thread lifetime. Standard containers and RAII release results and partial conversions. Required: Bound nesting and allocation; reject host cycles unless the declared identity model supports them. |
| `Polymorphic exports` | `Concrete function; generated struct per alias-named record (GMP integers in C, cpp_int in C++)` (signature); `Concrete host function for each reviewed finite specialization` (signature) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Each configured type application becomes a distinct monomorphic host function. The unspecialized Lean declaration is absent. An alias-named instantiation is one monomorphic host record type per alias; no type argument crosses at runtime. Name a closed generic structure application with an abbrev to get a host record with instantiated fields. Configured functions over these records, List aliases and Option aliases use ordinary concrete signatures. Reviewed packages select finite applications from the authored Binding IR. Required: Deliver checked finite specializations; record open-generic gaps without using an untyped transport. |
| `Implicit arguments {α}` | `Concrete host signature with no runtime type argument` (signature) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Lean elaboration supplies configured type arguments before native compilation; the host passes no placeholder value. Required: Separate erased type arguments from implicit runtime values; resolve them from elaborated information. |
| `Instance arguments [C α]` | `Concrete host signature with the Lean-selected instance dictionary erased` (signature) | Ordinary source: Installed checks passed. Reviewed IR: Installed checks passed | Lean synthesizes the selected dictionary before native compilation. The host cannot provide or replace it. Required: Specialize or supply the selected dictionary without changing runtime behavior. |
| `Prop / theorem / proof arguments` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Record theorem identity and assumptions. Erasure does not remove the need to check a runtime refinement. |
| `Optional parameter with default` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Apply only the declared default; distinguish omitted input from a supplied Option.none. |
| `Explicit nullable host value` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Select an explicit host projection; null does not stand for every missing, erased or unsupported value. |
| `IO α` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Executing IO is not automatically asynchronous. Preserve effect order and exceptions. |
| `EIO ε α` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve typed failures separately from transport validation and unexpected traps. |
| `Declared failure contract` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Project every declared error and payload; preserve trap or poisoned-runtime handling separately. |
| `Task α / asynchronous result` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Keep completion, rejection, cancellation and runtime lifetime distinct; do not block a browser event loop. |
| `Declared host object` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Generate typed members and preserve receiver identity, dynamic-access policy and lifetime. |
| `Lean function returned to the host` | `LeanClosure<Result(Args...)>` (result) | Ordinary source: Not audited (input, field, callback input, callback result); Installed checks passed (result). Reviewed IR: Not audited (input, field, callback input, callback result); Installed checks passed (result) | Move-only typed calls, automatic destruction and idempotent close. Retained creator-thread tokens reject reused thread IDs. Expired borrows and post-fork calls reject. Required: Preserve captured state, call signature, errors and deterministic disposal. |
| `Cancellation protocol` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Specify acknowledgement and late completion; release pending work exactly once. |
| `Synchronous iterator` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve values, end-of-sequence, failure, early return and cleanup. |
| `Asynchronous iterator` | No host mapping recorded | Ordinary source: Not audited. Reviewed IR: Not audited | Required: Preserve backpressure, pending-pull cancellation and terminal cleanup. |

### Alpha example API

These are the prepared Alpha package's public types in `lean_bridge::alpha`. The C++ wrapper handles the underlying C status and buffer cleanup.

| Lean type | C++ type | Conversion rules |
| --- | --- | --- |
| `Bool` | `bool` | Native Boolean value. |
| `UInt32` | `std::uint32_t` | Full unsigned 32-bit range. Check wider or signed values before conversion; a cast can wrap or truncate. |
| `String` | `std::string` | Owned UTF-8 bytes, including embedded NUL; length is explicit. |
| `ByteArray` | `std::vector<std::uint8_t>` | Owned byte buffer copied across the boundary. |
| `Array UInt32` | `std::vector<std::uint32_t>` | Owned vector of unsigned 32-bit elements. |
| `Payload` | `Payload` | Copyable value struct. `round_trip` borrows its input and returns an owned copy. |
| `Box` | `Box` | Move-only RAII resource; `identity()` returns a reference to the same wrapper. |
| `UInt32 → UInt32` callback | Callable taking and returning `std::uint32_t` | Pass a lambda or function object to the templated `with_callback`; it runs synchronously. |
| Returned Lean closure | `Transform` | Move-only RAII resource with `operator()` and optional early `close()`. |

Its generated `lean_alpha.hpp` defines the available API.

## Types, errors, and cleanup

`Payload` owns its `std::string` and `std::vector` fields. `round_trip` toggles `enabled`, increments `count`, and preserves the other values. Alpha adds two to the host callback result, giving 44 in the example. Scalar values use `std::uint32_t`.

`Box` and returned `Transform` objects are move-only. Their destructors release the Lean resources, including when an exception unwinds the stack. Call `close()` for early release; repeated close is safe. `identity()` returns a reference to the same wrapper, so its lifetime cannot exceed the owning object. Copied payloads need no explicit cleanup.

Native status failures raise `lean_bridge::alpha::Error`, which exposes `status()` and `code()`. Calls on closed wrappers raise `std::runtime_error`. The callback adapter catches a C++ exception and rethrows it after control returns from Lean; do not throw across the underlying C ABI yourself.

## Troubleshooting

- If CMake cannot find the package, pass the extracted root through `CMAKE_PREFIX_PATH`.
- If compilation reports deleted copy operations, move the wrapper or pass it by reference instead of copying it.
- A closed wrapper cannot make further Lean calls. Keep the resource open for every callback or reference that depends on it.
- Keep the package's native libraries together, and check the glibc requirement when deploying.

## Start from a raw Lean package

Follow [the C++ build-and-publish guide](../publish/cpp.md) for source inputs and package preparation. For an existing library, start with [Adapt an existing library](../lean/existing-package.md).

### Package authors and acceptance

Repository checks live in [Contributing](../contributing/testing.md#consumer-acceptance).

### Publish this package

Continue in the [build-and-publish workflow](../publish/cpp.md).
