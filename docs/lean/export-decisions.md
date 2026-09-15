# Choose an export shape

Choose the Lean API's meaning before choosing a host-language representation. Export public operations, preserve their input constraints, and specify how values, identity, failures, and effects cross the boundary.

Use the shared [export configuration](existing-package.md#configure-exports) to select modules and declarations. The [type reference](../reference/types.md#full-type-surface) inventories every supported or pending source form; the language tables below record current implementation evidence.

## Choose value and callable semantics

| Lean form | Author decision |
| --- | --- |
| `Unit`, `Bool`, fixed-width signed and unsigned integers | Preserve the unit value, Boolean meaning, and integer bounds. Reject invalid inputs before narrowing. |
| `Nat`, `Int`, `USize`, `ISize` | Keep arbitrary integers exact and use the compiled target's width for platform-sized integers. |
| `Float32`, `Float` | Preserve the specified precision, infinities, NaN classification, and signed zero. |
| `Char`, `String`, `ByteArray` | Separate Unicode scalar values, text, and binary data. Preserve embedded zero bytes. |
| Arrays, lists, tuples, records, aliases, variants, recursive values | Choose copied values or explicit retained identity. Keep constructor tags and fields; enforce allocation and nesting limits. |
| `Option`, `Except` | Preserve presence and branch payloads. `Some None` differs from `None`; `Except ε α` carries success `α` or error `ε`. |
| Defaults, optional arguments, host null | Keep omitted input, declared defaults, host null, Unit, and Option.None distinct. |
| Generics, implicit arguments, instances | Select finite build-time specializations and resolve the required dictionaries. |
| `Fin`, `Subtype`, dependent signatures | Preserve runtime constraints through checked constructors or validation. An erased proof does not authorize an unchecked input. |
| Theorems and proof arguments | Let Lean determine runtime erasure. Retain theorem identities and assumptions in assurance metadata. |
| Resources, host objects, mutable members | Declare identity, ownership, borrowing, transfer, and disposal. Keep incompatible runtimes separate. |
| Callbacks and returned closures | Specify argument/result types, retention, reentry, failure behavior, and lifetime. |
| `IO`, `EIO`, declared errors | Preserve effect order and typed failures. An IO action is not automatically asynchronous. |
| `Task`, cancellation, iterators, async iterators | Specify result delivery and cleanup after completion, cancellation, failure, or early termination. |

These decisions define the full authoring work. A listed form becomes usable in a profile when its compiler, generated API, package, and installed checks support that mapping. The [implementation stages](../architecture/cross-language-authoring.md#stages) track the remaining work.

Declare supported ownership, lifetime, refinement policy and boundary-effect requirements through [export contracts](existing-package.md#declare-export-contracts). The compiler checks them after resolving the signature; unsupported choices fail before linking. Contracts currently enforce copied values, native call-scoped resource/callback borrowing, explicit returned leases, and synchronous callback effects. They do not enable checked-constructor lowering, transferred ownership, retained host callbacks or async adapters.

## Check each consumer representation

| Consumer | Conversion table | Package guide |
| --- | --- | --- |
| JavaScript, TypeScript, browser, React, workers | [JavaScript and TypeScript](../javascript-typescript.md#type-conversions) | [npm](../publish/npm.md) |
| Python | [Python](../consume/python.md#type-conversions) | [PyPI](../publish/pypi.md) |
| Rust | [Rust](../consume/rust.md#type-conversions) | [Cargo](../publish/cargo.md) |
| C | [C](../consume/c.md#type-conversions) | [C packages](../publish/c.md) |
| C++ | [C++](../consume/cpp.md#type-conversions) | [C++ packages](../publish/cpp.md) |
| C# / .NET | [.NET](../consume/dotnet.md#type-conversions) | [NuGet](../publish/nuget.md) |
| Java and Kotlin | [Java](../consume/java.md#type-conversions), [Kotlin](../consume/kotlin.md#type-conversions) | [Maven](../publish/maven.md) |
| Ruby | [Ruby](../consume/ruby.md#type-conversions) | [RubyGems](../publish/rubygems.md) |
| Perl | [Perl](../consume/perl.md#type-conversions) | [CPAN](../publish/cpan.md) |
| PHP, native and PHP-Wasm | [PHP](../php.md#type-conversions) | [Composer and npm](../publish/php.md) |
| WIT / WASI | [WIT / WASI](../consume/wit-wasi.md#type-conversions) | [Component distribution](../publish/wit-wasi.md) |

## Start with the runnable npm shapes

Ordinary npm components support pure functions with zero to 32 primitive arguments:

| Lean type | JavaScript / TypeScript value |
| --- | --- |
| `Unit`, `Bool` | `undefined`, `boolean` |
| `UInt8`, `UInt16`, `UInt32`, `Int8`, `Int16`, `Int32` | Range-checked integer `number` |
| `UInt64`, `Int64` | Range-checked `bigint` |
| `Nat`, `Int` | Arbitrary-precision `bigint`; `Nat` must be nonnegative |
| `Float32`, `Float` | `number`, including NaN, infinities, and negative zero |
| `String` | Unicode `string`, including embedded NUL; unpaired UTF-16 surrogates are rejected |
| `ByteArray` | Copied `Uint8Array` |

Calls use a binary scalar frame. Integers cross as 32-bit limbs without narrowing. Each copied value has a 16 MiB transport budget; `Float32` rounds to IEEE single precision.

The [first-component tutorial](first-component.md) executes `add` and `isEmpty` from generated archives. Its source needs no publishing annotation or handwritten host wrapper.

Compilation, packaging, and loading check the same ordinary-component capability contract. `analyze` resolves aliases, notation, and inferred types using fresh Lean interfaces in the pinned engine. Ordinary builds use the same metadata extractor for captured and [generated entry modules](existing-package.md#generate-the-public-entry-module).

Use [concrete specializations](existing-package.md#export-concrete-specializations) to bind a generic function's leading type parameters and resolve its following instance dictionaries. Each configured name becomes a concrete npm function. The runtime arguments and result still use the primitive types above. CPAN accepts the same configuration against its native type profile, including [specialized returned closures](../publish/cpan.md#export-a-specialized-closure).

Analysis reports separate reasons for unresolved implicit, instance, dependent, generic, effectful and unsupported value types. The [compiler metadata](../architecture/elaborated-export-metadata.md) retains the binder types and source positions for inspection. Theorem references record direct relationships in Lean's environment; assurance claims require separate verification.

## Native C and C++ exports

Ordinary `c` and `cpp` builds accept the same 16 pure primitive parameter/result types listed above, including compiler-resolved aliases and concrete specializations. C uses exact-width scalars and copied buffer structs; C++ supplies owned standard-library values and exact Nat/Int limb vectors. Both targets share one compiled native component and include the runtime automatically. Use the [C/C++ author recipe](../publish/c.md#build-an-ordinary-lean-project).

The native C/C++ adapters also accept arrays and acyclic copied records, including nested combinations and primitive record fields. C uses typed spans and structs with generated deep cleanup; C++ uses owned vectors and structs. Resources, callbacks, effects and asynchronous functions remain unsupported on this path. A selected unsupported signature stops the build at its Lean source location. Selecting npm alongside C/C++ still requires a primitive-only API.

Ordinary [C# / NuGet builds](../publish/nuget.md#build-an-ordinary-lean-project) use the same copied-value native adapter. C# exposes exact-width scalars, `BigInteger`, `T[]` arrays and sealed records. Generated code handles native buffers, deep cleanup and compatible runtime loading. This path accepts pure primitives, arrays and acyclic records; the separate Alpha fixture still supplies the resource/callback example.

Ordinary [Java/Kotlin Maven builds](../publish/maven.md#build-an-ordinary-lean-project) support the same pure copied primitives, arrays and acyclic records. Unsigned values use wider checked JVM types: UInt8/UInt16 become `int`, UInt32 becomes `long`, and UInt64/Nat/Int become `BigInteger`. Public APIs keep FFM and native layouts private.

Ordinary [RubyGems builds](../publish/rubygems.md#build-an-ordinary-lean-project) support those copied types through Ruby `Integer`, `Float`, `String`, `Array` and generated record classes. The generated `UNIT` singleton represents Unit in every position; `nil` is rejected. Fixed-width integers are range checked, Nat/Int remain exact, and consumers need no native declarations or extension build.

Ordinary [Python/PyPI builds](../publish/pypi.md#build-an-ordinary-lean-project) expose `None`, `bool`, exact `int`, `float`, `str`, `bytes`, arrays and frozen record classes. Arrays accept lists or tuples and return tuples. Generated private conversions validate values, clear native results and share the bundled runtime automatically. Consumers install a prepared wheel without Lean, native declarations or an extension build. This path admits pure copied values; resources and callbacks remain in the separate Alpha fixture.

Ordinary [Rust/Cargo builds](../publish/cargo.md#build-an-ordinary-lean-project) expose typed functions returning `Result`, fixed-width Rust integers, `BigUint`/`BigInt`, `String`, `Vec` and named structs. Aggregate inputs are borrowed; results own independent values. Private C conversions and RAII guards handle native ownership. The crate embeds the native libraries and loads a shared runtime automatically. This path admits pure copied values; Alpha's resource and callback APIs remain separate.

Ordinary [WIT/WASI builds](../publish/wit-wasi.md#build-an-ordinary-lean-project) support the same copied types through Component Model functions and a packaged Wasmtime/native Lean host. Unit uses a single-case enum. Nat uses least-significant-first `u32` limbs; Int adds a sign flag. Empty records also use a single-case enum. Every selected function receives an executable adapter; the separate Alpha resource/callback fixture keeps its narrower WIT path.

Ordinary [native PHP builds](../publish/php.md#build-an-ordinary-lean-project) expose checked functions, readonly records, lists, and exact `BigInteger` values through Composer. They use the shared C adapter and automatic FFI loading. Parameters carry precise PHPDoc and use runtime checks to prevent weak-mode PHP coercion. This path covers NTS CLI; the Alpha Zend and PHP-Wasm profiles retain their separate adapters.

## Native Perl exports

The [native Perl backend](../publish/cpan.md) checks freshly elaborated declarations and the pinned Lean compiler's representations. It supports primitive values, finite acyclic copied records and arrays, configured identity resources, synchronous host callbacks, and returned Lean closures. Its shared compiler report preserves documentation, source ranges and theorem references alongside the native types; the C compiler checks the adapter prototypes against Lean's emitted definitions.

Shared export configuration selects modules, optional exact exports, resources, closure arities and checked export contracts. The builder supports local modules, the pinned Lean standard library, and [locked Lake dependencies](../publish/cpan.md#build-with-locked-lake-dependencies), including generated public modules. Open generics, dependent signatures, recursive copied structures, asynchronous operations, and retained host callbacks require further work. Unsupported native shapes fail before packaging.

Use the [Perl conversion table](../consume/perl.md#type-conversions) for position-specific installed coverage. The compiler supplies native types and declaration selection; npm's primitive frame is a separate ABI.

## Types understood by source analysis

The compiler-backed analyzer projects:

- `Unit`, `Bool`, `UInt8`, `UInt16`, `UInt32`, and `UInt64`;
- `Int8`, `Int16`, `Int32`, `Int64`, `Nat`, and `Int`;
- `Float32`, `Float`, `String`, and `ByteArray`.

`IO`, `Task`, collections, records, callbacks, resources, and configured closure arities produce unsupported diagnostics in this profile. The report retains their elaborated types for inspection. Analysis requires the same pinned engine backend as building; it does not compile a consumer adapter.

Explicit reviewed Binding IR can describe richer APIs and can be validated without a compiler. The [consumer support contract](../consumer-support.v1.json) records tested runtime profiles separately from the public analyzer's primitive projection.

## Declarations the analyzer skips

The default public proposal excludes private and protected declarations, theorems, and type declarations. Selected unsafe, partial, admitted, and unreviewed foreign implementations produce diagnostics. Duplicate unqualified host names require a naming decision.

Doc comments become generated API descriptions. Missing documentation produces a warning; it does not supply a proof or change a function's implementation.

## Resolve required decisions

Run analysis with machine-readable output:

```sh
lean-bridge analyze --project . --json --progress none
```

Required questions identify the declaration, reason, and closed choices. Current decisions cover:

| Reported boundary | Available direction |
| --- | --- |
| Existing foreign declaration | Exclude it or provide a reviewed foreign contract. |
| Unsupported value, effect, or callable shape | Exclude it or provide an adapter. |
| Contract differs from the implemented adapter | Correct the contract to match the intended supported behavior, or wait for the required type-family support. |
| Contract names no selected export | Correct the name or export selection. |
| Duplicate public names | Qualify, rename, or exclude the conflicting names. |
| Several Binding IR documents | Select the intended component. |

Analysis stays noninteractive unless `--interactive` is supplied. The CLI does not rewrite Lean source or generate a guessed adapter. Resolve required questions before `build`.

The [analyzer contract](../../src/analyze/README.md) and [Binding IR contract](../../src/binding-ir/README.md) define those boundaries. For a blocked command, use the [diagnostic table](diagnostics.md#match-the-diagnostic).
