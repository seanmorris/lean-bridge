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

Ordinary npm components support pure functions with any number of primitive arguments, including zero:

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

Analysis, compilation, packaging, and loading check the same ordinary-component capability contract.

## Native Perl exports

The [native Perl backend](../publish/cpan.md) checks freshly elaborated declarations and the pinned Lean compiler's representations. It supports primitive values, finite acyclic copied records and arrays, configured identity resources, synchronous host callbacks, and returned Lean closures.

Shared export configuration selects modules, optional exact exports, resources, and closure arities. Local modules and the pinned Lean standard library are supported. External Lake dependencies, open generics, dependent signatures, recursive copied structures, asynchronous operations, and retained host callbacks require further work. Unsupported native shapes fail before packaging.

Use the [Perl conversion table](../consume/perl.md#type-conversions) for position-specific installed coverage. npm's source scanner and primitive frame are not the native ABI description.

## Types understood by source analysis

The source-only analyzer recognizes:

- `Unit`, `Bool`, `UInt8`, `UInt16`, `UInt32`, and `UInt64`;
- `Int8`, `Int16`, `Int32`, `Int64`, `Nat`, and `Int`;
- `Float32`, `Float`, `String`, and `ByteArray`;
- nested `Array T`, `Option T`, and `Except E T` with supported arguments.

Ordinary npm components reject `IO`, `Task`, collection types, records, callbacks, and resources before compilation. Recognizing a source type does not authorize publishing it. Richer reviewed Binding IR and universal-package backends remain separate from this pure primitive path.

Reviewed Binding IR can describe richer APIs than source-only inference. The [consumer support contract](../consumer-support.v1.json) records tested runtime profiles; it does not imply that every inferred declaration runs through the ordinary-project npm path.

## Declarations the analyzer skips

The default public proposal excludes `private`, `protected`, `unsafe`, and `partial` definitions. An existing foreign declaration requires a reviewed boundary contract or exclusion. Duplicate unqualified host names require a naming decision.

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
