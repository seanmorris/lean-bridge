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

## Native Perl exports

The [native Perl backend](../publish/cpan.md) checks freshly elaborated declarations and the pinned Lean compiler's representations. It supports primitive values, finite acyclic copied records and arrays, configured identity resources, synchronous host callbacks, and returned Lean closures. Its shared compiler report preserves documentation, source ranges and theorem references alongside the native types; the C compiler checks the adapter prototypes against Lean's emitted definitions.

Shared export configuration selects modules, optional exact exports, resources, and closure arities. The builder supports local modules, the pinned Lean standard library, and [locked Lake dependencies](../publish/cpan.md#build-with-locked-lake-dependencies), including generated public modules. Open generics, dependent signatures, recursive copied structures, asynchronous operations, and retained host callbacks require further work. Unsupported native shapes fail before packaging.

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
| Duplicate public names | Qualify, rename, or exclude the conflicting names. |
| Several Binding IR documents | Select the intended component. |

Analysis stays noninteractive unless `--interactive` is supplied. The CLI does not rewrite Lean source or generate a guessed adapter. Resolve required questions before `build`.

The [analyzer contract](../../src/analyze/README.md) and [Binding IR contract](../../src/binding-ir/README.md) define those boundaries. For a blocked command, use the [diagnostic table](diagnostics.md#match-the-diagnostic).
