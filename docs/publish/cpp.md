# Build and publish C++ packages

Prepare C++20 wrappers, C bindings, native libraries, and CMake metadata, then distribute the original archive through a release page or artifact server.

For ordinary-source builds, declare the library's [description, authors and URLs](../publishing.md#declare-package-metadata) once in `lean-bridge.exports.json`.

## Build an ordinary Lean project

Use the [ordinary C/C++ build](c.md#build-an-ordinary-lean-project) with `--target cpp`. Select `--target c --target cpp` to produce both archives from one native compilation. The author needs Node 22, Lean 4.32.2, C11 and C++20 compilers, and binutils on Linux x86-64; consumers need only their C++ toolchain and the prepared archive.

The generated namespace follows the source component. A project named `sample` produces `sample.hpp` and functions in `lean_bridge::sample`. Fixed-width integers use exact-width C++ types, `String` becomes `std::string`, and `ByteArray` becomes `std::vector<uint8_t>`. Both `Nat` and `Int` use `boost::multiprecision::cpp_int`; negative `Nat` inputs raise `Error` before Lean runs. Unit parameters use `std::monostate`, and Unit results return `void`.

Packages using `Nat` or `Int` include pinned Boost.Multiprecision and Boost.Config 1.90.0 headers and their Boost Software License. Builds and downstream installs need no Boost download. CMake and pkg-config supply `BOOST_MP_STANDALONE`; use the packaged include path and this same mode throughout your application. The package records dependency sources and file hashes in `share/lean-bridge/boost.json`.

C++ arrays use `std::vector<T>` and records use generated structs with owned fields. Both can nest. `Array Bool` uses `std::vector<bool>`; its packed storage is converted to the C API's individual Boolean values. Empty records use empty C++ structs. The [copied-value rules](c.md#copied-arrays-and-records) define the shared budget and nesting limit.

Records provide defaulted field-by-field `operator==`, including packages with
no tagged variants. Floating-point fields follow C++ equality: NaN is unequal
to itself, and positive and negative zero compare equal. Conversion preserves
their values, including the sign of zero. C/C++ keywords in field names gain a
trailing underscore. See the [Parcel export](c.md#copied-arrays-and-records),
[consumer example](../consume/cpp.md#arrays-and-records) and
[installed collection checks](../evidence/native-collections-20260921.md).

`Option T` uses `std::optional<T>`, including `std::optional<std::monostate>` for `Option Unit` and nested optionals for nested options. `Except E T` uses `Result<T, E>`, an alias for `std::variant<Ok<T>, Err<E>>`. Construct `Ok<T>{value}` or `Err<E>{error}` and read its `value` member with `std::get` or `std::visit`. Products use `std::pair<A, B>` and retain their binary nesting. All three can contain supported primitives, arrays, copied records and each other, including in synchronous callback signatures. The [installed compound checks](../evidence/native-compounds-20260920.md) cover ordinary-source and reviewed-IR packages.

Concrete copied aliases export source-named `using` declarations for the target's
C++ type. Alias chains and aliases of supported primitives, records and containers
preserve their compiler-checked identities without adding value wrappers. Public
name collisions fail before packaging. See
[named copied aliases](c.md#named-copied-aliases) for admission rules and
[consumer examples](../consume/cpp.md#named-aliases).

C++ results own their data. Scoped input views keep nested buffers alive through the call. Generated wrappers free intermediate C results on success and exceptions, including allocation failures partway through a nested result. Invalid UTF-8 or an exceeded copy budget raises the generated `Error` with the underlying status and code. C++ allocation failures propagate as `std::bad_alloc`. The [type conversion table](../consume/cpp.md#type-conversions) records installed coverage by position.

Set `targets.cpp.name` and `targets.cpp.version` in `lean-bridge.exports.json` to choose archive coordinates. The package includes the C API, native libraries, matching runtime, CMake and pkg-config metadata. C++ does not require a separately installed C package or Lean runtime.

## Copied tagged variants

Export concrete, non-recursive Lean inductives with copied constructor fields.
Lean Bridge emits a named struct for each constructor and a `std::variant` for
the enclosing type. `Signal.data (count : UInt32) (label : String)` becomes
`SignalData{count, label}`. Empty constructors have different types, even when
they have no payload. `Unit` fields remain present as `std::monostate`.

Generated Lean functions construct, identify and read each branch. The native
adapter does not inspect Lean object tags or constructor offsets. Inputs and
outputs share the 16 MiB copy budget and the 32-level type nesting limit.
Payloads may nest supported copied records and containers. Case and field name
collisions fail during generation; C++ keywords in fields gain a trailing
underscore. Variants can be synchronous callback arguments and results; their
fields cannot retain callback or resource identities. For recursive APIs, see
[recursive copied values](../consume/cpp.md#recursive-copied-values).

Select `--target cpp` for these packages. Add `--target c` for the
[public C/C-GMP representation](c.md#copied-tagged-variants). Combined native
variant builds also admit [Python](pypi.md#export-tagged-variants),
[Rust](cargo.md#export-copied-tagged-variants),
[.NET](nuget.md#export-copied-tagged-variants),
[Java/Kotlin](maven.md#export-copied-tagged-variants),
[Ruby](rubygems.md#export-copied-tagged-variants) and
[Perl](cpan.md#export-copied-tagged-variants) when each selected target accepts
the full API. Native PHP, PHP-Wasm and WIT/WASI also support copied variants;
structured callback signatures still require support from every selected target.
The C transport included
in a C++ archive is an implementation layer; use the C target for its public API
and GMP integer handling.
See the [consumer example](../consume/cpp.md#tagged-variants) and
[installed evidence](../evidence/cpp-variants-20260921.md).

## Primitive callbacks and returned closures

Ordinary-source and independently reviewed builds support synchronous callbacks and returned Lean closures with all nineteen primitives. Pass a typed lambda or function as a callback; move-only lambdas work too. Arguments are owned C++ values. Return the declared C++ type exactly, including an explicit `cpp_int` result for arithmetic expression templates. A `Unit` callback result is `void`.

Generated trampolines catch C++ exceptions before returning to C and rethrow the original exception once the native call returns. The first failure suppresses later callbacks in the same call. Returned `LeanClosure<Result(Args...)>` values are move-only, provide `call`, `operator()`, `close` and `is_closed`, and release automatically on destruction. Invoke and explicitly close them on their creating thread. Moving them does not transfer thread ownership. Self-close during an active call defers disposal until the call returns.

For an ordinary export that returns a function, set its outer parameter count in `arities`. Reviewed contracts carry that count in their declaration instead. Call-scoped host callbacks must not escape into a retained Lean closure. The adapter rejects expired borrows, calls after close, and post-fork use. Callables share the C adapter's 16 MiB conversion budget, 64-level call nesting limit and 4,096 live-closure capacity. See the [installed primitive acceptance record](../evidence/cpp-callables-20260919.md).

### Export copied callback payloads

Arrays, Lists, options, results, products, acyclic records, tagged variants and aliases work in callback and returned-closure signatures on both authoring paths. Declare their Lean types directly. The [structured fixture](../../tests/fixtures/onboarding/structured-callables/Structured.lean) and [C++ consumer example](../consume/cpp.md#structured-callbacks-and-closures) show the generated API.

C++ receives owned values in callbacks and copies the returned value into Lean. Consumers use standard containers and generated value types without C buffers or ownership hooks. Callback and closure results receive the same validation as ordinary arguments, including nonnegative `Nat`, valid UTF-8 and the conversion budget. Acyclic type nesting is limited to 32 levels. Packages containing recursive callback values use the graph conversion limits instead. Copied fields cannot hide resource or callback identities. Resource aggregates use the explicit ownership API below; asynchronous calls remain unsupported.

Select `--target cpp`, or combine `--target c --target cpp`. All seventeen consumer profiles accept acyclic copied callback signatures. The [installed structured acceptance](../evidence/cpp-structured-callables-20260924.md) includes typed compiler rejections, exception recovery, allocation-failure cleanup and runtime-only deployment.

### Export recursive callbacks

The [recursive publisher example](c.md#export-recursive-callbacks) builds C and
C++ archives from one Lean tree definition. Select only `--target cpp` if no C
archive is needed. The [C++ consumer](../consume/cpp.md#recursive-callbacks) uses
named constructors, owned containers and move-only returned closures.
Recursive callback payloads currently work in C, C++ and npm packages. A combined
release still requires every selected target to support every export.

## Resource-containing values

Select resource types and the [aggregate ownership policy](c.md#resource-containing-c-values)
in `lean-bridge.exports.json`, then build with `--target cpp`. Add `--target c`
to generate both archives from one native compilation. Other targets must support
that ownership contract before they can join the same build.

The [owned-value fixture](../../tests/fixtures/onboarding/owned-cpp-composition/lean-bridge.exports.json)
selects `Owned.Ticket` as a resource and uses lease ownership with required
disposal, queued finalization and cycle rejection. It exports resource-bearing
collections, records, variants, boxed recursive chains and typed callbacks.
Set `arities` to the outer argument count for exports returning functions.
Independently reviewed version-4 contracts can select the same API after the
builder reconciles them with fresh Lean metadata.

```sh
lean-bridge build --project /path/to/owned-package \
  --target c --target cpp --output /path/to/new-owned-release
```

C++ packages contain generated value/call headers, the shared C adapter, the
compiled Lean component and runtime, GMP 6.3.0, and pinned Boost 1.90.0 headers
when exact integers are used. The CMake target supplies C++20, threads and the
Boost standalone definition. pkg-config supplies matching include/link settings.
The archive records its package and target names; the C++ CMake name ends in
`Cpp` and its target ends in `_cpp`, so it can coexist with the C target.

Resource wrappers use checked leases and automatic cleanup. Copied containers
own their storage while resource leaves preserve identity. Callback resources
borrow the invocation's lifetime; consumers call `retain()` to keep one. Returned
closures can receive typed mutable callbacks. Factories that cannot derive typed
recovery require the consumer's `with_recovery(callback, value)` wrapper.
See [resource-containing C++ values](../consume/cpp.md#resource-containing-values).

Packaging regenerates the headers and lifetime rules from the authenticated
contract and compares the pinned Boost files. Recomputed file hashes cannot
authorize altered adapters. The
[installed checks](../evidence/owned-cpp-values-20260927.md) build both source paths,
delete producer inputs before installation, and run consumers through pkg-config,
relocated CMake and sanitizers. Copied records still cannot conceal resource
ownership. Owner-anchored borrowed results remain unimplemented.

### Transfer input ownership

Select `ownership: "transfer"` for the consuming parameter through
[export contracts](c.md#transfer-input-ownership). Ordinary configuration and an
independently reviewed version-4 API support the same selection. Build with
`--target cpp`, or select a combination of C, C++, Cargo and PyPI.
Other consumer targets still reject these transfer contracts.

C++ projects transferred arguments as rvalue references. Consumers pass
`std::move(value)`; resource aliases close at the native handoff, before a host
callback can run. Independent `retain()` references survive. Validation failures
preserve all inputs, while later failures leave them consumed. See
[the C++ consumer rules](../consume/cpp.md#transferred-inputs).

These packages use native model version 8, package manifest version 4,
`ownedValues` version 3 and `cppValues` version 2. Packaging reconstructs both
the native move contract and C++ alias/lifetime rules from compiler-authenticated
metadata. Borrow-only packages keep their original versions and header bytes.

## Build the reviewed Alpha example

### Check the build inputs

The Alpha example uses a reviewed universal bundle containing its compiled native component and target metadata. An ordinary Lake project alone does not provide those inputs. Follow [existing-library preparation](../lean/existing-package.md) and the [target overview](../publishing.md) before adapting another package.

### Build the target package

From a Lean Bridge checkout, [build the example bundle](../contributing/testing.md#build-the-example-artifacts-as-a-maintainer). With that bundle at `build/consumer-universal-bundle`, use a new output directory:

```sh
node scripts/build-c-family-package.mjs --ecosystem cpp \
  --bundle build/consumer-universal-bundle --output build/publish-cpp
```

The builder emits `lean-bridge-alpha-0.0.0-cpp.tar.gz`. The package identity and version come from the bundle; change them upstream before generating a public candidate. The tested native runtime is x86-64 Linux with glibc 2.38 or newer.

## Verify installation

Run the complete [C++ consumer example](../consume/cpp.md) against the produced archive. It installs or links the generated public API without compiling Lean. Keep the platform requirements and verification result with the package.

## Distribute and recover

Use [archive distribution](archives.md#freeze-the-handoff) for checksum records, GitHub Releases, HTTPS hosting, download verification, and interrupted-upload recovery. A universal `cpp` target retains an archive; it does not upload it. Your release owner chooses the destination and approves the exact bytes.

The archive supplies its documented host integration. It does not register a package with Conan, vcpkg, an OCI registry, or another unimplemented package manager. [Signed Nix caches](nix.md) provide an additional channel for declared flake outputs.
