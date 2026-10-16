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

Declare supported ownership, lifetime, refinement policy and boundary-effect requirements through [export contracts](existing-package.md#declare-export-contracts). The compiler checks them after resolving the signature; unsupported choices fail before linking. Contracts enforce copied values, native call-scoped resource/callback borrowing, explicit returned leases, and synchronous callback effects. Ordinary-source npm packages accept [bounded integers inside containers, copied fields, aliases, recursive values, callbacks, and returned closures](existing-package.md#export-bounded-integers) and [checked top-level `Subtype` constructors](existing-package.md#export-a-checked-subtype) over primitive bases. PHP-Wasm copied-graph packages also retain selected constructors and `Fin` bounds through [finite recursive copied values](../evidence/recursive-subtype-php-wasm-20261015.md). Refined callback results must have a finite recovery value; bare `Fin 0` results are rejected at build time. C, C++, Rust, Python, Ruby, C#, Java, Kotlin, Perl, native PHP, PHP-Wasm, JavaScript/TypeScript and WIT/WASI packages also support [explicit input transfers](../publish/c.md#transfer-input-ownership). Other checked-constructor positions, retained host callbacks and async adapters remain unfinished.

For a reviewed `Subtype` API, select the checked constructor by public export
name in the review. Two finite specializations of one generic can select
different constructors. Lean Bridge reconciles the exact input base type,
result subtype and selected constructor with fresh Lean compilation; the
consumer passes the base value. [Reviewed native checks](../evidence/reviewed-subtype-native-promotion-20261010.md)
and [reviewed browser checks](../evidence/reviewed-subtype-browser-promotion-20261010.md)
record installed top-level primitive-base parameters and results. The later
[structural checks](../evidence/structural-subtype-promotion-20261011.md) cover
`Array`, `List`, `Option`, products and `Except` on both source routes across
all seventeen profiles. Each present leaf keeps its selected constructor and
normalization, including through transparent aliases and the tested closed
`List` specialization. Acyclic plain record and variant fields have
[native](../evidence/nominal-subtype-native-20261011.md) and
[component](../evidence/component-nominal-subtype-20261011.md) compiler checks,
with constructor choices attached to each use rather than to the shared type.
Both compiler paths also project constructor-free results.
[Installed npm checks](../evidence/nominal-subtype-npm-acceptance-20261011.md)
cover the tested Nat fields, aliases and constructor-free outputs on both source
routes in Node 22.23.2 with strict TypeScript, including result-only packages.
[Nineteen-base npm checks](../evidence/nominal-primitive-subtype-npm-20261014/index.json)
extend those Node fields to every admitted primitive base, including signed
and heap-backed values, floats, Unicode text and bytes. Constructors still
belong to each input site; results project existing payloads. Both author
routes and API modes pass offline installation and relocated replay with
wasm32 machine words. [Nineteen-base browser checks](../evidence/nominal-primitive-subtype-browser-20261014/index.json)
extend these fields and constructor-free results to pages, React
production/Strict Mode and workers in Chromium, Firefox and WebKit. All four
source/API selections execute source-free bundles after offline installation,
with asset recovery, remount, pending-unmount and worker restart/disposal
checks. Python, C/C++, Perl, Ruby, Rust and C# also have nineteen-base checks
below; the remaining host checks cover their tested Nat forms.
[Installed C/C++ checks](../evidence/nominal-subtype-native-acceptance-20261011.md)
cover the same Nat forms on both source routes in Linux x64/glibc 2.36, including
standalone result-only packages. [Nineteen-base C/C++ checks](../evidence/nominal-primitive-subtype-native-20261014/index.json)
extend these fields to all admitted primitive bases with independent C11/GMP
and C++20 callers. Each field retains its public native representation and
64-bit machine words. Both source routes check normalization, active branches,
input snapshots, C output preservation and recovery after rejection in the full
API. Standalone result-only packages omit input constructor selections. All
four source/API selections reproduce complete packages from two author roots,
install offline after author removal and replay after relocation.
[Installed Perl checks](../evidence/nominal-subtype-perl-acceptance-20261012.md)
cover those Nat fields and constructor-free outputs on both source routes, with
all four pinned ABIs and both installation modes on Linux x64/glibc 2.36.
[Nineteen-base Perl checks](../evidence/nominal-primitive-subtype-perl-20261015/index.json)
extend those fields to all admitted primitive bases on the same four ABIs and
both delivery modes, with per-site normalization, active branches, caller
snapshots and recovery after rejection in the full API and constructor-free
standalone result-only packages.
[Installed Python checks](../evidence/nominal-subtype-python-acceptance-20261012.md)
cover those Nat forms on both source routes in CPython 3.11 and 3.12, with the
same reproduced wheel installed offline and replayed after relocation.
[Nineteen-base Python checks](../evidence/nominal-primitive-subtype-python-20261014/index.json)
extend the copied fields to all admitted primitive bases and test standalone
result-only packages. Both author routes reproduce complete wheels and replay
on CPython 3.11.16 and 3.12.14 after offline installation and relocation, using
Linux x64/glibc 2.36 and 64-bit machine words.
[Installed Ruby checks](../evidence/nominal-subtype-ruby-acceptance-20261012.md)
add those Nat forms on MRI Ruby 3.3.12, with reproduced gems, offline installation
and relocated replay on Linux x64/glibc 2.36.
[Nineteen-base Ruby checks](../evidence/nominal-primitive-subtype-ruby-20261015/index.json)
extend those fields and constructor-free results to all admitted primitive
bases. Both author routes and API modes reproduce complete gems from two roots,
install offline after author removal and replay after physical relocation on
MRI Ruby 3.3.12 and Linux x64/glibc 2.36 with 64-bit machine words.
[Installed Rust checks](../evidence/nominal-subtype-rust-acceptance-20261012.md)
add those Nat forms with Rust and Cargo 1.90.0, offline crate installation,
relocated replay and execution after deleting all consumer sources.
[Nineteen-base Rust checks](../evidence/nominal-primitive-subtype-rust-20261015/index.json)
extend those fields and constructor-free results to all admitted primitive
bases with exact Rust representations and 64-bit machine words. Both author
routes and API modes reproduce complete crates from two roots, install offline
with fourteen authenticated dependencies, replay after relocation and execute
again after deleting all consumer sources on Linux x64/glibc 2.36.
[Installed C# checks](../evidence/nominal-subtype-dotnet-20261012.md)
add those Nat forms with .NET SDK 8.0.424 and shared framework 8.0.30, offline
NuGet installation, relocated replay and source-free deployment on Linux
x64/glibc 2.36.
[Nineteen-base C# checks](../evidence/nominal-primitive-subtype-dotnet-20261015/index.json)
extend those fields and constructor-free results to all admitted primitive
bases with their exact C# representations and 64-bit machine words. Both author
routes and API modes reproduce complete NuGet packages from two roots, install
offline after author removal, replay after relocation and execute again after
deleting all consumer sources. Full APIs check per-site normalization, active
branches, exact rejection paths, caller snapshots and recovery after rejection
on .NET SDK 8.0.424 and shared framework 8.0.30 with Linux x64/glibc 2.36.
[Installed Java/Kotlin checks](../evidence/nominal-subtype-jvm-20261013.md)
add those Nat forms with JDK 22.0.2 and Kotlin 2.2.0. Both consumers install
offline and replay after relocation and consumer-source removal on Linux
x64/glibc 2.36; separate compiled probes check invalid callers and nullability.
[Installed native PHP acceptance](../evidence/nominal-subtype-php-20261013.md)
adds PHP 8.2.33 and Composer 2.5.5 with offline installation and weak/strict
replay before and after relocation on Linux x64/glibc 2.36. Author/build roots
are removed before installation; consumer PHP source remains required at runtime.
[Nineteen-base native PHP checks](../evidence/nominal-primitive-subtype-php-20261015/index.json)
extend those fields and constructor-free results to all admitted primitive bases
with 64-bit machine words. Both author routes and API modes reproduce complete
Composer ZIPs, install offline after author and build removal, and run weak and
strict callers before and after relocation. Full APIs check per-site
normalization, active branches, nested copied containers, exact rejection paths,
caller snapshots and recovery after rejection.
[Installed WIT/WASI acceptance](../evidence/nominal-subtype-wit-promotion-20261013.md)
adds those Nat forms through the actual Component Model adapter and its required
packaged native Lean host. Both source routes reproduce packages from two roots,
install offline and replay after relocation on Linux x64/glibc 2.36 with
Wasmtime 42.0.1.
[Installed browser acceptance](../evidence/nominal-subtype-browser-promotion-20261014.md)
adds both source routes and API modes in Chromium 151.0.7922.34, Firefox 153.0
and WebKit 26.5 pages, React and workers. The reproduced npm packages pass
missing-asset recovery, remount, pending-unmount, worker restart and disposal
checks.
[Installed PHP-Wasm acceptance](../evidence/nominal-subtype-php-wasm-promotion-20261014.md)
adds both source routes and API modes on wasm32 PHP 8.4.1 in Node 22.23.2 and
Chromium 151.0.7922.34. Embedded, Composer and bundled callers pass startup/lazy
loading and weak/strict execution twice after relocation. The archive
retains all three reproduced packages.
[Nineteen-base PHP-Wasm acceptance](../evidence/nominal-primitive-subtype-php-wasm-20261015/index.json)
extends those fields and constructor-free results to every admitted primitive
base with 32-bit machine words. Both author routes and API modes reproduce the
complete Composer API, npm component and npm shared runtime, install offline,
and run twelve Node and Chromium contexts twice after relocation. Full APIs
check per-site normalization, active branches, exact rejection paths, caller
snapshots and recovery.
[Nineteen-base WIT acceptance](../evidence/nominal-primitive-subtype-wit-20261015/index.json)
extends the same fields and constructor-free results to every admitted primitive
base through the Component Model adapter and its 64-bit native Lean host. Both
author routes and API modes reproduce the complete WIT archive, install offline
and execute one compiled public C caller before and after relocation.
[Nineteen-base Java and Kotlin acceptance](../evidence/nominal-primitive-subtype-jvm-20261015/index.json)
extends the same fields and constructor-free results to Java and Kotlin
packages with 64-bit machine words. Both author routes and API modes reproduce
the complete Maven package, install offline, and run Java and Kotlin callers
after relocation and from a source-free deployment. Refined
callbacks, owned and recursive Subtypes, and Subtype fields in generic records
remain unfinished.

### Select constructors inside containers

For example, save `StructuralSubtypes.lean` in the Lean package:

```lean
namespace StructuralSubtypes

abbrev Positive := { value : Nat // 0 < value }

def checkedPositive (value : Nat) : Option Positive :=
  if proof : 0 < value then some ⟨value, proof⟩ else none

def arrays (values : Array Positive) : Array Positive := values

end StructuralSubtypes
```

Select the export and its input/result constructors in
`lean-bridge.exports.json`. This example selects npm; the same checked function
can target any consumer profile listed above.

```json
{
  "schemaVersion": 1,
  "modules": ["StructuralSubtypes"],
  "exports": ["StructuralSubtypes.arrays"],
  "targets": { "npm": { "name": "structuralsubtypes", "version": "1.0.0" } },
  "contracts": {
    "StructuralSubtypes.arrays": {
      "parameters": [{
        "ownership": "copy",
        "lifetime": null,
        "refinement": {
          "kind": "array",
          "arguments": [{ "constructor": "StructuralSubtypes.checkedPositive" }]
        }
      }],
      "result": {
        "ownership": "copy",
        "lifetime": null,
        "refinement": {
          "kind": "array",
          "arguments": [{ "constructor": "StructuralSubtypes.checkedPositive" }]
        }
      }
    }
  }
}
```

JavaScript passes an array of `bigint` values. `[1n, 2n]` succeeds, `[]`
succeeds without constructing an element, and `[1n, 0n]` rejects without
changing the array. Other consumers use their generated array and `Nat` types.
No consumer supplies a proof or implements the predicate.

An ordinary export contract describes nested constructor choices in transport
order. For `Array (Option Positive)`, the site's `refinement` is:

```json
{
  "kind": "array",
  "arguments": [
    {
      "kind": "option",
      "arguments": [{ "constructor": "Library.checkedPositive" }]
    }
  ]
}
```

Products list the first and second components. Results list success and error,
the reverse of Lean's `Except Error Success` type arguments. A `null` child
means no author-selected constructor on that branch; it does not remove a
compiler-derived `Fin` bound. Reviewed APIs derive these choices from their
refinement trees and reconcile them against fresh Lean metadata.

### Select constructors in native records

This native compiler-stage example uses a copied record with a Subtype field
and a Fin sibling. The shared component compiler now admits the same field
choices and result projections. [Installed npm acceptance](../evidence/nominal-subtype-npm-acceptance-20261011.md)
and [installed C/C++ acceptance](../evidence/nominal-subtype-native-acceptance-20261011.md)
cover the separate Nat nominal fixture on Node and Linux x64/glibc 2.36.
[Installed Perl acceptance](../evidence/nominal-subtype-perl-acceptance-20261012.md)
adds all four pinned Perl ABIs and both installation modes on the same glibc floor.
[Nineteen-base Perl acceptance](../evidence/nominal-primitive-subtype-perl-20261015/index.json)
extends that matrix to every admitted primitive base.
[Installed Python acceptance](../evidence/nominal-subtype-python-acceptance-20261012.md)
adds CPython 3.11 and 3.12 with offline installation and relocated replay.
[Installed Ruby acceptance](../evidence/nominal-subtype-ruby-acceptance-20261012.md)
adds MRI Ruby 3.3.12 with offline gem installation and relocated replay.
[Nineteen-base Ruby acceptance](../evidence/nominal-primitive-subtype-ruby-20261015/index.json)
extends that matrix to every admitted primitive base on both author routes and
API modes.
[Installed Rust acceptance](../evidence/nominal-subtype-rust-acceptance-20261012.md)
adds Rust and Cargo 1.90.0 with offline crate installation, relocated replay
and execution after deleting all consumer sources.
[Nineteen-base Rust acceptance](../evidence/nominal-primitive-subtype-rust-20261015/index.json)
extends that matrix to every admitted primitive base on both author routes and
API modes.
[Installed C# acceptance](../evidence/nominal-subtype-dotnet-20261012.md)
adds .NET SDK 8.0.424 and shared framework 8.0.30 with offline NuGet installation,
relocated replay and source-free deployment on Linux x64/glibc 2.36.
[Nineteen-base C# acceptance](../evidence/nominal-primitive-subtype-dotnet-20261015/index.json)
extends that matrix to every admitted primitive base on both author routes and
API modes.
[Installed Java/Kotlin acceptance](../evidence/nominal-subtype-jvm-20261013.md)
adds JDK 22.0.2 and Kotlin 2.2.0 with offline installation, relocated replay
and source-free deployment of both consumers on Linux x64/glibc 2.36.
[Installed native PHP acceptance](../evidence/nominal-subtype-php-20261013.md)
adds PHP 8.2.33 and Composer 2.5.5 with offline installation and weak/strict
replay before and after relocation on Linux x64/glibc 2.36. Author/build roots
are removed before installation; consumer PHP source remains required at runtime.
[Nineteen-base native PHP acceptance](../evidence/nominal-primitive-subtype-php-20261015/index.json)
extends that matrix to every admitted primitive base on both author routes and
API modes, including standalone result-only packages.
[Installed WIT/WASI acceptance](../evidence/nominal-subtype-wit-promotion-20261013.md)
adds those Nat forms through the actual Component Model adapter and its required
packaged native Lean host. Both source routes reproduce packages from two roots,
install offline and replay after relocation on Linux x64/glibc 2.36 with
Wasmtime 42.0.1.
[Installed browser acceptance](../evidence/nominal-subtype-browser-promotion-20261014.md)
adds both source routes and API modes in Chromium 151.0.7922.34, Firefox 153.0
and WebKit 26.5 pages, React and workers. The reproduced npm packages pass
missing-asset recovery, remount, pending-unmount, worker restart and disposal
checks.
[Installed PHP-Wasm acceptance](../evidence/nominal-subtype-php-wasm-promotion-20261014.md)
adds both source routes and API modes on wasm32 PHP 8.4.1 in Node 22.23.2 and
Chromium 151.0.7922.34. Embedded, Composer and bundled callers pass startup/lazy
loading and weak/strict execution twice after relocation. The archive
retains all three reproduced packages.
[Nineteen-base PHP-Wasm acceptance](../evidence/nominal-primitive-subtype-php-wasm-20261015/index.json)
extends that matrix to every admitted primitive base on both author routes and
API modes, including standalone result-only packages with 32-bit machine words.
[Nineteen-base WIT acceptance](../evidence/nominal-primitive-subtype-wit-20261015/index.json)
extends that matrix to every admitted primitive base on both author routes and
API modes through Wasmtime 42.0.1, with 64-bit native machine words.
[Nineteen-base Java and Kotlin acceptance](../evidence/nominal-primitive-subtype-jvm-20261015/index.json)
extends that matrix to every admitted primitive base on both author routes and
API modes through Maven packages on JDK 22.0.2 and Kotlin 2.2.0.
Save `NominalSubtypes.lean`:

```lean
namespace NominalSubtypes

abbrev Positive := { value : Nat // 0 < value }

def checkedPositive (value : Nat) : Option Positive :=
  if proof : 0 < value then some ⟨value, proof⟩ else none

structure Packet where
  count : Positive
  digit : Fin 3

def echoPacket (value : Packet) : Packet := value

def producePacket (value : Nat) : Packet :=
  ⟨⟨value + 1, Nat.zero_lt_succ value⟩, ⟨2, by decide⟩⟩

end NominalSubtypes
```

In `lean-bridge.exports.json`, name the record and every field in source order:

```json
{
  "schemaVersion": 1,
  "modules": ["NominalSubtypes"],
  "exports": ["NominalSubtypes.echoPacket", "NominalSubtypes.producePacket"],
  "targets": { "c": { "name": "nominal-subtypes", "version": "1.0.0" } },
  "contracts": {
    "NominalSubtypes.echoPacket": {
      "parameters": [{
        "ownership": "copy",
        "lifetime": null,
        "refinement": {
          "kind": "record",
          "name": "NominalSubtypes.Packet",
          "fields": [
            { "name": "count", "refinement": { "constructor": "NominalSubtypes.checkedPositive" } },
            { "name": "digit", "refinement": null }
          ]
        }
      }],
      "result": { "ownership": "copy", "lifetime": null }
    }
  }
}
```

`count` uses the checked constructor. The null selection on `digit` leaves its
compiler-derived `Fin 3` check intact. Neither result selects a constructor:
Lean produces each `Packet`, and the adapter projects its payload. A package
exporting only `producePacket` needs no `contracts` entry.

Two export sites can select different checked constructors for the same
`Packet` type, including two fields of one enclosing record. For a variant,
select `kind: "variant"`, its qualified `name`, and every `cases` entry in source
order. Each case has its source `name` and ordered `fields`, including an empty
array for a payload-free case. Only the active case runs its constructors. The
[selection fixture](../../tests/helpers/nominal-subtype-selection-fixture.mjs)
shows variants, nested aliases and repeated records with different choices.

A reviewed API puts the same named record/case structure in the declaration's
`lean-lang.org/refinements` tree. It includes exact Fin bounds, not a null
selection in their place. Constructor-free result leaves use
`{ "kind": "subtype", "constructor": null }`; input leaves must name a checked
constructor. The null marker belongs to reviewed result metadata, not ordinary
configuration syntax. Fresh Lean reconciles every member, bound and choice.

C, C++, Rust, Python, Ruby, C#, Java, Kotlin, Perl, native PHP, PHP-Wasm, JavaScript/TypeScript and WIT/WASI packages also support [parameter-anchored function results](../publish/c.md#anchor-a-result-to-an-input). The [JavaScript/TypeScript owner API](../javascript-typescript.md#borrowed-results-and-whole-value-owners) uses `LeanValue<T>`; the [WIT/WASI API](../consume/wit-wasi.md#borrowed-results) carries the original owner through the Component Model call.
The result expires with the selected input owner; callers explicitly retain or
copy it when they need independent ownership. C, C++, Rust, Python, Ruby, C#, Java, Kotlin, Perl, native PHP, PHP-Wasm, JavaScript/TypeScript and WIT/WASI also support
[methods, properties and receiver-bound results](../publish/c.md#export-methods-and-properties),
with named members in [C++](../publish/cpp.md#export-methods-and-properties),
[Rust](../publish/cargo.md#export-methods-and-properties),
[Python](../publish/pypi.md#export-methods-and-properties),
[Ruby](../publish/rubygems.md#export-methods-and-properties),
[C#](../publish/nuget.md#export-methods-and-properties),
[Java/Kotlin](../publish/maven.md#export-methods-and-properties),
[Perl](../publish/cpan.md#export-methods-and-properties),
[native PHP and PHP-Wasm](../publish/php.md#export-methods-and-properties) and
[JavaScript/TypeScript](../publish/npm.md#export-methods-and-properties).
WIT/WASI exposes [typed receiver-first functions](../publish/wit-wasi.md#export-methods-and-properties), including owned-record and variant receivers.
Callback-result anchors are available for C, C++, Rust, Python, Ruby, C# and npm;
the other targets remain in development.

For a record whose proofs relate its fields, use a [checked constructor over the payload fields](existing-package.md#export-a-record-with-proof-fields). The host supplies no proof. The compiler checks each input through the selected Lean constructor and erases proofs from Lean-produced results. Closed `Nat` indices stay in type metadata. Top-level inputs and results have installed acceptance in C/C++, Node JavaScript/TypeScript, browser pages, React, workers, Python, Rust, Ruby, .NET, Java/Kotlin, Perl, native PHP, PHP-Wasm and WIT/WASI. npm has [installed nested acceptance](../evidence/nested-checked-record-browser-20261016/index.json), C/C++ have an [installed nested archive](../evidence/nested-checked-record-native-20261016/index.json), .NET has an [installed NuGet archive](../evidence/nested-checked-record-dotnet-20261016/index.json), Java/Kotlin have an [installed Maven archive](../evidence/nested-checked-record-jvm-20261016/index.json), Perl has an [installed CPAN archive](../evidence/nested-checked-record-perl-20261016/index.json), native PHP has an [installed Composer archive](../evidence/nested-checked-record-php-20261016/index.json), Python has an [installed wheel archive](../evidence/nested-checked-record-python-20261016/index.json), Ruby has an [installed gem archive](../evidence/nested-checked-record-ruby-20261016/index.json), WIT/WASI has an [installed component archive](../evidence/nested-checked-record-wit-20261016/index.json), and PHP-Wasm has an [installed Node/Chromium archive](../evidence/nested-checked-record-php-wasm-20261016/index.json). They cover direct and repeated parameters, arrays, lists, options, products, `Except`, enclosing record fields, active variant fields and constructor-free container results. Select the record constructor and each nested checked field's constructor independently at every public input site; only an active variant branch runs. Generic, recursive, inherited, callback, owned and open dependent combinations remain unfinished, and Rust still needs separate nested evidence.

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

Ordinary npm components support synchronous functions with zero to 32 arguments. Arguments and results can use primitives, concrete copied aliases, nested arrays and Lists, copied records, concrete tagged variants (including bounded recursive values), `Option`, `Except` and nested binary products. Synchronous callbacks and returned functions accept one to sixteen arguments and a result using these same copied types, including finite recursive values. Copied values and callables can share a component.

| Lean type | JavaScript / TypeScript value |
| --- | --- |
| `Unit`, `Bool` | `undefined`, `boolean` |
| `UInt8`, `UInt16`, `UInt32`, `Int8`, `Int16`, `Int32` | Range-checked integer `number` |
| `UInt64`, `Int64` | Range-checked `bigint` |
| `USize`, `ISize` | Range-checked `number`, unsigned or signed 32-bit for the compiled Wasm target |
| `Nat`, `Int` | Arbitrary-precision `bigint`; `Nat` must be nonnegative |
| `Float32`, `Float` | `number`, including NaN, infinities, and negative zero |
| `String` | Unicode `string`, including embedded NUL; unpaired UTF-16 surrogates are rejected |
| `Char` | A `string` containing exactly one Unicode scalar, including supplementary characters and NUL |
| `ByteArray` | Copied `Uint8Array` |
| `Array α` | Dense ordinary arrays, declared as `ReadonlyArray<T>` in TypeScript; elements can be any supported copied value |
| `List α` | The same host array representation, preserving order and nesting; the reviewed contract retains `constructor:list` |
| Copied structure | Plain objects with exact own fields; named readonly TypeScript interfaces |
| Concrete inductive sum | `{ kind: "constructorName", ...fields }`; named readonly discriminated unions. Empty constructors retain their names; explicit Unit fields remain present. |
| `Option α` | `{ tag: "none" }` or `{ tag: "some", value: T }`; Unit payloads and nested options retain their tags |
| `Except ε α` | `{ ok: T }` or `{ error: E }`, exactly one own branch |
| `α × β` | Exact two-element ordinary array; readonly TypeScript tuple retaining Lean's product nesting |

Calls use typed binary frames. Integers cross as 32-bit limbs without narrowing; `Float32` rounds to IEEE single precision. Scalar-only calls limit each copied value to 16 MiB. Container calls share a 16 MiB budget across copied slots and payloads in all arguments and the result, with at most 32 container levels for the acyclic transport. Recursive graph calls allow 128 value edges and 262,144 value slots within the same byte budget. Returned copied values own their storage and need no disposal. Variants allow up to 1,024 constructors with at most 1,024 fields each, subject to the 4,096-node descriptor bound. `kind` is reserved for the discriminator. Generic, indexed and proof-bearing variants need further adapter work.

[Recursive npm values](../evidence/npm-recursive-20260922.md) have installed checks on both source paths. [C/C++](../evidence/native-recursive-packages-20260923.md), [Rust/Cargo](../evidence/rust-recursive-packages-20260923.md), [Python wheels](../evidence/python-recursive-packages-20260923.md), [Ruby gems](../evidence/ruby-recursive-packages-20260923.md), [Perl](../evidence/perl-recursive-packages-20260923.md), [C#/JVM/PHP](../evidence/recursive-managed-acceptance-20260924.md) and [WIT/WASI](../evidence/wit-recursive-acceptance-20260924.md) complete installed recursive copied-value coverage across all seventeen profiles. npm, C, C++, [Python](../evidence/python-recursive-callables-20260925.md), [Rust](../evidence/rust-recursive-callables-20260925.md), [Ruby](../evidence/ruby-recursive-callables-20260925.md), [Perl](../evidence/perl-recursive-callables-20260925.md), [C#](../evidence/dotnet-recursive-callables-20260926.md), [Java/Kotlin](../evidence/jvm-recursive-callables-20260926.md), [native PHP](../evidence/php-recursive-callables-20260926.md), [PHP-Wasm](../evidence/php-wasm-recursive-callables-20260926.md) and [WIT/WASI](../evidence/wit-recursive-callables-20260926.md) also accept recursive callback payloads. Resource-containing aggregates use the explicit ownership profiles described below; support varies by target.

C, C++, Python, Rust, C#, Java, Kotlin, Ruby, Perl, native PHP, PHP-Wasm and WIT/WASI also compile options, results and products; concrete copied variants compile across all seventeen consumer profiles, including [WIT/WASI](../evidence/wit-variants-20260921.md). Combined builds require every selected target to support the API.

`Char` is one Unicode scalar, including NUL and supplementary characters. Native and PHP-Wasm packages also support it in copied arrays and record fields. C uses `uint32_t`, C++ `char32_t`, Rust `char`, .NET `System.Text.Rune`, Java/Kotlin `int`/`Int` code points, and WIT `char`. Python, Ruby, Perl and PHP use one-scalar strings. Multi-scalar grapheme clusters require `String`. See the [conversion tables](../reference/types.md).

`USize` and `ISize` follow the compiled Lean target: 32 bits for npm and PHP-Wasm, 64 bits for native packages and native-backed WIT components. The consumer's architecture does not change that range. Adapters reject out-of-range inputs before narrowing; arithmetic inside Lean retains Lean's word-sized wraparound. Use a fixed-width integer when the same API must have the same range on both targets.

The [first-component tutorial](first-component.md) executes `add` and `isEmpty` from generated archives. Its source needs no publishing annotation or handwritten host wrapper.

Compilation, packaging, and loading check the same ordinary-component capability contract. `analyze` resolves aliases, notation, and inferred types using fresh Lean interfaces in the pinned engine. Ordinary builds use the same metadata extractor for captured and [generated entry modules](existing-package.md#generate-the-public-entry-module).

Use [concrete specializations](existing-package.md#export-concrete-specializations) to bind a generic function's leading type parameters and resolve its following instance dictionaries. Each configured name becomes a concrete npm function with supported runtime arguments and results. CPAN accepts the same configuration against its native type profile, including [specialized returned closures](../publish/cpan.md#export-a-specialized-closure).

A [schema-3 reviewed contract](existing-package.md#compile-a-reviewed-contract) can select those finite specializations and describe closed generic-record instantiations in its source extensions. Fresh Lean must reproduce the closed signature, alias identity, record fields and exact application, including resolved instances. The review owns the selection; configuration cannot override it. The [installed reviewed-specialization checks](../evidence/reviewed-specializations-20261008/receipt.json) cover C, C++ and npm with strict TypeScript.

[Inherited records](existing-package.md#export-inherited-records) retain Lean's own parent subobjects and field order. A generic parent's unnamed type requires one matching alias in the compiled source closure. Missing or ambiguous aliases stop that export; explicitly named fields keep their chosen alias.

Alias-named generic records can contain arrays and appear as array elements. The [native Array checks](../evidence/generic-record-array-rollout-20261009.md) exercise `Box (Array Nat)`, `Array NatBox` and `Box (Array NatBox)` across all eleven native profiles. Name each structure instantiation with an alias; generated consumers use concrete host record and array types.

Analysis reports separate reasons for unresolved implicit, instance, dependent, generic, effectful and unsupported value types. The [compiler metadata](../architecture/elaborated-export-metadata.md) retains the binder types and source positions for inspection. Theorem references record direct relationships in Lean's environment; assurance claims require separate verification.

## Native C and C++ exports

Ordinary `c` and `cpp` builds accept all 19 pure primitive parameter/result types above, including compiler-resolved aliases and concrete specializations. C uses exact-width scalars, copied buffers and GMP `mpz_t` for Nat/Int; C++ supplies owned standard-library values and Boost.Multiprecision cpp_int. Packages include and configure the exact-integer dependency. Both targets share one compiled native component and include the runtime automatically. Use the [C/C++ author recipe](../publish/c.md#build-an-ordinary-lean-project).

The native C/C++ adapters also accept arrays, Lists and acyclic copied records, including nested combinations, Option/Except/product payloads and primitive record fields. [List inputs, results and fields](../evidence/native-lists-20260920.md) use typed C spans or owned C++ vectors. C uses typed spans and structs with generated deep cleanup; C++ uses owned vectors and structs. [Concrete copied aliases](../publish/c.md#named-copied-aliases) retain public names through C typedefs and C++ using declarations, including alias chains and nested containers. Both targets support synchronous primitive callbacks and returned closures: [C uses signature-specific function/context structs](../publish/c.md#export-callbacks-and-closures), while [C++ uses typed lambdas and move-only LeanClosure values](../publish/cpp.md#primitive-callbacks-and-returned-closures). Both targets additionally support acyclic copied callback payloads, including arrays, Lists, options, results, products, records, variants and aliases. Asynchronous functions remain unsupported. A selected unsupported signature stops the build at its Lean source location. Selecting npm alongside C/C++ requires an API admitted by both profiles.

C and C++ builds also support [resource-containing aggregates](../publish/c.md#resource-containing-c-values) when the author selects resource identities and an explicit aggregate ownership policy. The version-4 transport exposes named values with session/result owners in C and checked RAII leases in [C++](../consume/cpp.md#resource-containing-values), including recursive values, captured Lean closures and call-scoped host callbacks. Both ordinary source and independently reviewed contracts compile into prepared archives. [Resource-containing callbacks](../consume/c.md#callbacks-containing-resources) use typed recovery and preserve resource identity through temporary reply cleanup. C++ copies of callback resource wrappers expire on return unless explicitly retained. Input transfers require an explicit export contract; C and C++ also support parameter-anchored borrowed results.

Ordinary [C# / NuGet builds](../publish/nuget.md#build-an-ordinary-lean-project) use the same private native adapter. C# exposes exact-width scalars, `BigInteger`, `T[]` arrays and Lists, and sealed records. [Installed List checks](../evidence/dotnet-lists-20260920.md) cover inputs, results and record fields on both source paths. [Copied aliases](../publish/nuget.md#export-named-copied-aliases) keep ordinary CLR values and preserve their names and targets in installed metadata and XML API documentation. Synchronous primitive and [acyclic structured callbacks](../publish/nuget.md#structured-callback-values) use `Func`/`Action`; returned functions use disposable `LeanClosure<TDelegate>` values. Generated code handles native buffers, callback exception recovery, deep cleanup and compatible runtime loading. The [explicit ownership profile](../publish/nuget.md#export-resource-containing-values) also supports resources inside records, variants, recursive values and synchronous callback payloads. Sealed resource wrappers implement `IDisposable` and explicit `Retain`; callback borrows expire on return. Consumers call the installed assembly without unsafe C#, Lean, a native compiler or a separate runtime installation.

Ordinary [Java/Kotlin Maven builds](../publish/maven.md#build-an-ordinary-lean-project) support copied primitives, arrays, Lists, records, bounded recursive values and synchronous primitive, [acyclic structured](../publish/maven.md#structured-callback-values) or [recursive callables](../publish/maven.md#recursive-callback-values). [Installed List checks](../evidence/jvm-lists-20260920.md) cover both languages on both source paths, using primitive or reference arrays. [Copied aliases](../publish/maven.md#export-named-copied-aliases) retain target values and preserve their names and chains in installed metadata and generated Java source documentation. Unsigned values use wider checked JVM types: UInt8/UInt16 become `int`, UInt32 becomes `long`, and UInt64/Nat/Int become `BigInteger`. Callbacks use typed functional interfaces; returned functions implement the matching interface and `AutoCloseable`. Public APIs keep FFM and native layouts private.

The [Maven ownership profile](../publish/maven.md#owned-resources-and-aggregates)
also supports resource leaves inside records, containers, variants, recursive
values and synchronous callback payloads. Java and Kotlin use typed,
`AutoCloseable` wrappers with explicit retention. Callback borrows expire on
return, and creating-thread exit drains native owners. The prepared JAR
includes both language APIs, compatible shared libraries and private GMP.

Ordinary [RubyGems builds](../publish/rubygems.md#build-an-ordinary-lean-project) support those copied types through Ruby `Integer`, `Float`, `String`, `Array` and generated record classes. [Lists](../evidence/ruby-lists-20260921.md) use copied Arrays for inputs, results and fields on both source paths. [Copied aliases](../publish/rubygems.md#export-named-copied-aliases) retain target values and preserve their names and chains in gem metadata and API comments. The generated `UNIT` singleton represents Unit in every position; `nil` is valid only for Option.None. Options use `nil` or `Some`, results use `Ok` or `Err`, and binary products use two-element arrays. Fixed-width integers are range checked, Nat/Int remain exact, and consumers need no native declarations or extension build. Synchronous primitive, [structured](../publish/rubygems.md#structured-callback-values) and [recursive callbacks](../publish/rubygems.md#export-recursive-callbacks-and-closures) accept callables or blocks; returned `LeanClosure` values support `with` and `close`. The [explicit ownership profile](../publish/rubygems.md#export-resource-containing-values) also admits resources in records, variants, recursive values and synchronous callback payloads. Generated wrappers use checked leases and explicit retention; callback borrows expire on return. Prepared gems load their native libraries and private GMP automatically.

Ordinary [Python/PyPI builds](../publish/pypi.md#build-an-ordinary-lean-project) expose `None`, `bool`, exact `int`, `float`, `str`, `bytes`, arrays, Lists and frozen record classes. Arrays and Lists accept exact lists or tuples and return owned tuples. [Installed List checks](../evidence/python-lists-20260920.md) cover both source paths, including nested copied values. [Concrete copied aliases](../publish/pypi.md#export-named-copied-aliases) retain public names as `TypeAlias` declarations in modules, stubs, signatures and fields without adding wrappers. [Recursive records and variants](../consume/python.md#recursive-values) use named frozen constructor classes, finite runtime annotations and precise stubs, with bounded depth and storage. Generated private conversions validate values, clear native results and share the bundled runtime automatically. Consumers install a prepared wheel without Lean, native declarations or an extension build. Synchronous primitive, [structured](../publish/pypi.md#structured-callback-values) and [recursive callbacks](../publish/pypi.md#export-recursive-callbacks-and-closures) accept Python callables; returned `LeanClosure` values support `with` and `close()`. The [explicit ownership profile](../publish/pypi.md#export-resource-containing-values) also supports resources inside records, variants, recursive values and callback payloads on both source paths. Generated resource wrappers use checked leases and explicit retention; callback borrows expire on return. The prepared wheel handles native loading and cleanup.

Ordinary [Rust/Cargo builds](../publish/cargo.md#build-an-ordinary-lean-project) expose typed functions returning `Result`, fixed-width Rust integers, `BigUint`/`BigInt`, `String`, `Vec` and named structs. [Lists](../evidence/rust-lists-20260920.md) borrow slices and return owned vectors, including nested copied values on both source paths. [Concrete copied aliases](../publish/cargo.md#export-named-copied-aliases) export `pub type` declarations, keeping alias chains and named fields without newtype wrappers. Aggregate inputs are borrowed; results own independent values. [Recursive values](../consume/rust.md#recursive-values) use owned enums, structs and Box fields, with depth, node and storage limits. Private C conversions and RAII guards handle native ownership. The crate embeds the native libraries and loads a shared runtime automatically. Synchronous primitive, [structured](../publish/cargo.md#structured-callback-values) and [recursive callbacks](../publish/cargo.md#export-recursive-callbacks-and-closures) use typed `FnMut` functions returning `Result`; returned `LeanClosure` values use `Drop` or explicit `close`. Rust prevents sending or sharing these closures across threads. The [explicit ownership profile](../publish/cargo.md#export-resource-containing-values) admits resource leaves in aggregates, recursive values and callable payloads on both source paths. Generated resource wrappers use checked leases and explicit retention; callback borrows expire on return.

Ordinary [WIT/WASI builds](../publish/wit-wasi.md#build-an-ordinary-lean-project) support copied primitives, arrays, Lists, acyclic records, options, results, products, aliases and [named variants](../publish/wit-wasi.md#export-copied-variants) through Component Model functions and a packaged Wasmtime/native Lean host. Variant cases carry named payload records; empty cases and Unit fields remain distinct. [List parameters, results and fields](../evidence/wit-lists-20260921.md) use canonical WIT lists on both source paths; returned Wasmtime values own independent storage. Unit uses a single-case enum. Nat uses least-significant-first `u32` limbs; Int adds a sign flag. Empty records also use a single-case enum. Synchronous primitive, [acyclic structured](../publish/wit-wasi.md#export-structured-callbacks) and [recursive callbacks](../publish/wit-wasi.md#export-recursive-callbacks) use borrowed Component Model resources; returned Lean closures own resources with explicit close. Callback values preserve copied aliases, active branches and independent storage. Recursive packages expose typed C helpers that convert finite values to WIT node tables. Every selected function receives an executable adapter; the separate Alpha resource/callback fixture keeps its narrower WIT path.

Ordinary [native PHP builds](../publish/php.md#build-an-ordinary-lean-project) expose checked functions, readonly records, arrays, Lists, [named copied variants](../publish/php.md#export-copied-variants), and exact `Brick\Math\BigInteger` values through Composer. Generated packages declare the pinned Brick Math dependency. [List parameters, results and fields](../evidence/php-native-lists-20260921.md) use consecutive-key PHP arrays on both source paths. [Copied aliases](../publish/php.md#export-named-copied-aliases) retain target values and preserve their names and chains in installed metadata and PHPDoc. They use the shared C adapter and automatic FFI loading. Parameters carry precise PHPDoc and use runtime checks to prevent weak-mode PHP coercion. Synchronous primitive, [acyclic structured](../publish/php.md#export-structured-callbacks) and [recursive callbacks](../publish/php.md#export-recursive-callbacks) accept PHP callables; returned `LeanClosure` objects are invokable and provide `close()` and `isClosed()`. This path covers NTS CLI; the Alpha Zend and PHP-Wasm profiles retain their separate adapters.

Ordinary [PHP-Wasm builds](../publish/php.md#build-an-ordinary-php-wasm-package) compile copied values, Lists and synchronous primitive, [acyclic structured](../publish/php.md#export-structured-callbacks) or [recursive callables](../publish/php.md#export-recursive-callbacks) for a separate wasm32 Zend adapter. [List inputs, results and fields](../evidence/php-wasm-lists-20260921.md) have installed checks on both source paths in Node and Chromium. `UInt32` and `Int64` use `Brick\Math\BigInteger` on this host, alongside `UInt64`, `Nat`, `Int` and 32-bit `USize`. Returned functions are invokable `LeanClosure` owners with explicit `close()`. Generated npm descriptors include Brick Math and register the shared runtime and component before PHP starts; the companion Composer ZIP supplies the same public PHP API. Installed startup and lazy-loading packages run in Node and Chromium with PHP 8.4.

PHP's [explicit ownership profile](../publish/php.md#export-resource-containing-values)
accepts resource leaves in records, variants, containers, finite recursive values
and synchronous callback payloads. Native Composer packages load their checked
leases and private native dependencies automatically. PHP-Wasm packages use a
separately compiled 32-bit Zend extension and shared runtime. Callback borrows
expire on return unless retained. Ordinary source and reviewed contracts can
select [consuming inputs](../publish/php.md#export-consuming-inputs) in both
transports. Both also support [owner-anchored function results](../php.md#owner-anchored-results).
Both transports support [methods, read-only properties and receiver-anchored
results](../publish/php.md#export-methods-and-properties). Callback-result
anchors and asynchronous delivery remain unfinished.

## Native Perl exports

The [native Perl backend](../publish/cpan.md) checks freshly elaborated declarations and the pinned Lean compiler's representations. It supports primitive values, finite acyclic copied records, arrays, Lists, options, results, binary products, configured identity resources, synchronous host callbacks, and returned Lean closures. [Lists](../evidence/perl-lists-20260921.md) use plain array references for inputs, results and fields on both source paths. [Copied aliases](../publish/cpan.md#export-named-copied-aliases) retain target values and preserve names and original targets in archive metadata and installed POD. Options use `undef` or `Some`, results use `Ok` or `Err`, and products use two-element array references. Unit uses `undef`; `Some(undef)` retains presence. [Structured callbacks](../publish/cpan.md#export-structured-callbacks) also accept arrays, Lists, options, results, products, acyclic records, variants and transparent aliases. [Recursive callbacks](../publish/cpan.md#export-recursive-callbacks-and-closures) also accept finite recursive records and variants, including aliases nested only in callback signatures. CODE references receive independent copies; returned Lean closures keep captured copies and support explicit `close()`. Its shared compiler report preserves documentation, source ranges and theorem references alongside the native types; the C compiler checks the adapter prototypes against Lean's emitted definitions.

Shared export configuration selects modules, optional exact exports, resources, closure arities and checked export contracts. The builder supports local modules, the pinned Lean standard library, and [locked Lake dependencies](../publish/cpan.md#build-with-locked-lake-dependencies), including generated public modules. Open generics, dependent signatures, asynchronous operations and retained host callbacks require further work. Unsupported native shapes fail before packaging.

Use the [Perl conversion table](../consume/perl.md#type-conversions) for position-specific installed coverage. The compiler supplies native types and declaration selection; npm's primitive frame is a separate ABI.

The [explicit ownership profile](../publish/cpan.md#export-resource-containing-values)
also admits resource leaves in records, variants, containers and finite recursive
values, including synchronous callback payloads. Returned wrappers own checked
leases; callback borrows expire on return unless retained. Ordinary-source and
reviewed-IR builds emit CPAN archives with an authenticated private GMP library.
Both prebuilt and XS-only installation work without Lean sources. Explicit
[consuming inputs](../consume/perl.md#consuming-inputs) and
[parameter-anchored results](../consume/perl.md#borrowed-results) preserve their
declared owner lifetimes. [Methods and properties](../consume/perl.md#methods-and-properties)
use nominal owners and preserve the original receiver or argument anchor.
Asynchronous delivery remains unsupported.

## Types understood by source analysis

The compiler-backed analyzer projects:

- `Unit`, `Bool`, `UInt8`, `UInt16`, `UInt32`, and `UInt64`;
- `Int8`, `Int16`, `Int32`, `Int64`, `Nat`, and `Int`;
- `USize` and `ISize`, with the compiled target's width;
- `Float32`, `Float`, `Char`, `String`, and `ByteArray`.

Nested arrays, Lists, copied records, variants, aliases, bounded recursive values, Option, Except, nested binary products and synchronous callbacks and returned functions with those payloads are supported. Configure `arities` to separate an export's arguments from those of its returned function. `IO`, `Task` and unsupported collection constructors produce diagnostics that retain their elaborated types for inspection. Analysis uses the pinned Nix or Docker engine and does not compile consumer adapters.

For resource-containing values, select `resources` and an explicit `ownedAggregates` policy. The analyzer then projects resource identities, owned records and variants, containers, recursive values and synchronous callbacks through the shared ownership model. Its schema-4 Binding IR records borrowed inputs and explicitly leased results. It also preserves explicit input-transfer decisions from ordinary configuration or a reviewed API. C packages compile those decisions into [owner-consuming calls](../consume/c.md#transferred-inputs); C++ packages use [rvalue references](../consume/cpp.md#transferred-inputs), Rust packages use [mutable references](../consume/rust.md#transferred-inputs), and the other implemented bindings consume checked resource leases ([Python](../consume/python.md#transferred-inputs), [Ruby](../consume/ruby.md#transferred-inputs), [C#](../consume/dotnet.md#consuming-inputs), [Java](../consume/java.md#consuming-inputs), [Kotlin](../consume/kotlin.md#consuming-inputs), [Perl](../consume/perl.md#consuming-inputs), [native PHP and PHP-Wasm](../php.md#consuming-inputs), [JavaScript/TypeScript](../javascript-typescript.md#consuming-inputs), [WIT/WASI](../consume/wit-wasi.md#consuming-inputs)). These profiles also preserve [owner-anchored borrowed results](../publish/c.md#anchor-a-result-to-an-input), including the [WIT/WASI Component Model path](../consume/wit-wasi.md#borrowed-results). C, C++, Rust, Python, Ruby, C#, Java, Kotlin, Perl, native PHP, PHP-Wasm, JavaScript/TypeScript and WIT/WASI also support [receiver-bound results](../publish/c.md#export-methods-and-properties).

For C, C++, Rust, Python, Ruby, C#, Java, Kotlin, Perl, native PHP,
JavaScript/TypeScript and WIT/WASI, a nested
[`callable.result` contract](../publish/c.md#anchor-a-callback-result-to-its-argument)
can borrow a callback's result from one of that callback's arguments. Argument
names are local to each callable. The selected argument's original owner
controls expiration; outer export parameters and receiver anchors cannot stand
in for callback arguments. PHP-Wasm still rejects callback-result anchors.
Rust callers pass a checked [`Value<T>` owner](../consume/rust.md#borrowed-callback-results),
Python callers pass a [`Value[T]` owner](../consume/python.md#callback-results-borrowed-from-an-argument),
Ruby callers pass a [`Value` owner](../consume/ruby.md#results-borrowed-from-a-callback-argument),
and C# callers pass a [`Value<T>` owner](../consume/dotnet.md#callback-results-borrowed-from-an-argument)
for the selected argument. Host replies may return the declared payload or its
whole owner; the bridge checks and converts either form before the callback ends.
WIT/WASI callers pass the selected argument's original result owner through the
generated C API; the bundled host validates it before and after the Component
Model call.

Schema-3 reviewed Binding IR can be validated without a compiler. Schema-4 ownership reviews are checked against freshly compiled Lean types, including resource identity, field order, callbacks and lifetimes. Builds [reconcile reviewed APIs](existing-package.md#compile-a-reviewed-contract) before compiling adapters. Combined builds require every selected profile to admit the same API; analysis alone does not establish target or installed-package support. The [consumer support contract](../consumer-support.v1.json) records those runtime checks.

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
