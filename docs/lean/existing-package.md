# Adapt an existing Lean library

Start with a Lake project that already builds. Choose the functions an application needs, check their types against the target backend, and package that public API. Supported ordinary declarations need no Lean Bridge annotation.

## Check the source project

Keep the library's source and proof history. Work on a branch, inspect `lean-toolchain`, and use the compiler selected by the project to run its existing build and tests. The current bridge builders require Lean 4.32.2; a library pinned to another version needs a checked migration before packaging.

Review the library's public declarations, imported modules, and dependency versions. The [target guide](../publishing.md#choose-the-package-ecosystem) identifies the build input each backend currently accepts. Both [npm/WASM](../publish/npm.md#build-with-locked-lake-dependencies) and [native/CPAN](../publish/cpan.md#build-with-locked-lake-dependencies) builds accept locked Lean dependencies, including relative local packages and cached Git checkouts at full commit pins. They also compile [declared C inputs](#declare-c-link-inputs) and [generated Lean/C sources](#generate-lean-and-c-sources). Prebuilt native libraries and reviewed foreign-function contracts remain part of the [cross-language authoring work](../architecture/cross-language-authoring.md#stages).

## Choose the application API

Identify the operations and types the downstream application will call. Decide which values are copied, which retain identity, which inputs have constraints, and how callers receive errors and asynchronous results. [Export decisions](export-decisions.md) describes those choices and links every consumer language's conversion table.

Inspect source declarations without rewriting the project:

```sh
lean-bridge analyze --project /path/to/library --json --progress none
```

Read `proposedExports`, diagnostics, and adapter questions. The command uses the pinned Nix or Docker engine to compile fresh Lean interfaces, resolve aliases and inferred types, and extract the selected public API. Unsupported declarations retain their compiler types and source positions in the report. Resolve them with export selection or a supported Lean wrapper.

Analysis leaves the original checkout unchanged. A dependency-free Lake project needs no lockfile; dependencies and configured [generators](#generate-the-public-entry-module) require a reviewed `lake-manifest.json`. The engine runs declared generators against captured inputs before analyzing generated public modules. It does not build consumer adapters or packages.

For a schema-3 reviewed Binding IR, `analyze` validates the document without invoking Lean and reports `existing-validated`. A schema-4 ownership review goes through fresh compilation and is compared with the source API, including resource identities, field order, callback signatures and lifetimes. Ordinary `ownedAggregates` configuration uses that same compiler-backed ownership projection. Missing backends and compiler errors never fall back to source-scanned signatures.

Prefer a small host-facing API with explicit input and result types. If you add wrapper functions, keep their behavior connected to the existing implementation and check the relevant theorems again. Do not erase a precondition merely to fit a host type. The [first component](first-component.md) is a complete supported npm example you can inspect as an existing library without recreating its files.

## Configure exports

Add optional `lean-bridge.exports.json` at the project root. This example selects one function from the `Selections` module:

```json
{
  "schemaVersion": 1,
  "modules": ["Selections"],
  "exports": ["First.bump"]
}
```

Replace those names with your library's module and fully qualified declarations. Omit `exports` to discover the public functions in the selected modules; omit `modules` to inspect all local modules. An empty selection, unknown name, or export outside the selected modules is an error. Unselected declarations remain visible in source discovery without contributing export collisions or adapter questions.

Analysis and ordinary builds read the same selection and include the configuration in the source identity. `arities` selects the number of arguments an export receives before returning a callable value; npm and native builds support it. `resources` selects identity-bearing Lean types; `ownedAggregates` supplies the explicit policy for containers that retain them. Target-specific package settings live under `targets`, using package target names such as `npm`, `pypi`, `cargo`, or `cpan`. A backend rejects a configured setting it does not implement; declaring a target does not select it for a build.

Ordinary npm builds send source and module selection to the engine without host-authored types or adapters. Lean resolves notation, type aliases, and inferred return types. Automatic discovery excludes private and protected declarations, type aliases, projections, and compiler-generated helpers. Explicitly selected unsupported declarations fail. The resulting bundle records `metadata/lake-entry-exports.json`; target compilation must reproduce that metadata before linking.

Native CPAN uses the same [compiler report](../architecture/elaborated-export-metadata.md) with its native type projection. Its prepared package includes `metadata.json` with documentation, source locations, resolved native types and theorem references. The native receipt binds that report to the compiled library. Public `analyze` also uses the native type metadata when `ownedAggregates` is selected, and returns a schema-4 Binding IR for owned values and synchronous callbacks. This metadata profile describes compiler types; it does not select a binary architecture or package target.

The npm builder accepts shared module/export selection, `arities`, `specializations`, `contracts`, `generators`, `targets.npm.name`, and `targets.npm.version`. The CPAN projection also accepts `resources`, `arities`, `targets.cpan.module`, and `targets.cpan.version`. [Ordinary C/C++ builds](../publish/c.md#build-an-ordinary-lean-project) accept the shared configuration for pure copied primitive signatures and use `targets.c.name`/`version` and `targets.cpp.name`/`version`. C-only builds do not require CPAN settings or Perl tools. [PHP-Wasm](../publish/php.md#build-an-ordinary-php-wasm-package) separates `targets.php-wasm.npm.name`/`version` from `targets.php-wasm.composer.name`/`version`. Repeat `--target` to combine supported targets from one captured source tree, with one compilation per ABI. The [staged implementation](../architecture/cross-language-authoring.md) tracks the remaining type-family decisions. A reviewed Binding IR owns its export decisions; only `modules`, package metadata, generators and target settings can accompany it.

### Compile a reviewed contract

Keep exactly one `.binding-ir.json` file in the source project: schema 3 for copied values, or schema 4 for explicit aggregate ownership. Select its source entry modules explicitly in `lean-bridge.exports.json`:

```json
{
  "schemaVersion": 1,
  "modules": ["Shop.Pricing"],
  "targets": {
    "pypi": { "name": "shop-pricing", "version": "1.0.0" }
  }
}
```

```sh
lean-bridge build --project . --target pypi --output ./build/reviewed-release
```

The review selects exact Lean declarations through `source.declaration` and `lean:<declaration>` IDs. A finite specialization instead uses `lean:<specialization-name>` and keeps the generic declaration in `source.declaration`. Lake resolves the selected modules and their dependencies; a declaration's namespace does not determine its source module. Lean compiles fresh interfaces, and the builder compares the review with the resulting API before generating adapters. Component identity, declaration names, parameter and result types, nominal record identities, field order, ownership, effects and failure behavior must agree.

For a schema-3 finite specialization, put the closed choice in the declaration's `source.extensions["lean-lang.org/specialization"]`:

```json
{
  "name": "Shop.keepText",
  "declaration": "Shop.keep",
  "types": ["String"],
  "application": "(@_root_.Shop.keep.{0} (@_root_.String))"
}
```

This example describes `Shop.keep {α : Type} (value : α) : α` with `α` fixed to `String`. The declaration ID is `lean:Shop.keepText`; its parameter and result use the concrete string type. Use the application that fresh Lean elaboration produces for that source and toolchain. The compiler receives only the public name, source declaration and closed type names. The builder compares the expected application, including resolved instances, against fresh metadata; it never executes application text from the review. Changing a valid type choice changes the API, so the concrete signature and authenticated review must agree with that choice.

The same [name and count rules](#export-concrete-specializations) apply as for ordinary configuration. Keep `specializations` out of the accompanying configuration: the review owns those decisions. The [installed reviewed-specialization checks](../evidence/reviewed-specializations-20261008/receipt.json) cover ten specializations and one ordinary export in C, C++ and npm with strict TypeScript. Each run reproduces the archives in two author roots, removes the author files and installs offline. The separate [checked Subtype archive](../evidence/reviewed-subtype-20261008/receipt.json) covers twelve reviewed exports in C, C++ and npm with strict TypeScript, including two specializations of one generic with different constructors and a zero-argument refined result.

For an alias of a closed generic record, put its origin in the record type's `source.extensions["lean-lang.org/instantiation"]`:

```json
{
  "structure": "Shop.Box",
  "arguments": [{ "kind": "primitive", "name": "nat" }]
}
```

This describes `abbrev NatBox := Box Nat` when `Shop.Box` is a generic structure. Keep the record's identity as `lean:Shop.NatBox` and describe its concrete fields. The builder compares the origin, argument order, field types and alias identity with fresh Lean metadata. The origin does not select a compilation or supply executable Lean text. A review can combine these records with finite function specializations.

Each origin has one to sixteen closed arguments, with nesting at most 32. Arguments may be copied primitives, containers or named aliases, records and variants from the review. This admission rejects recursive origins, resources, callbacks and refinements reachable from the arguments or record fields. Phantom arguments still participate in validation even when no field uses them. See the [independent review and acceptance tests](../../tests/reviewed-instantiations.test.mjs) for direct records, namespaced aliases and specialized exports.

Native targets and PHP-Wasm accept reviewed pure copied primitives, arrays and immutable records. Native targets include C, C++, .NET, Java/Kotlin, Perl, native PHP, Python, Ruby, Rust and WIT/WASI. All targets support nineteen primitives, including `Char`, `USize` and `ISize`. Platform integers use the compiled target's width: 32 bits for npm/PHP-Wasm and 64 bits for native/WIT packages. Native and PHP-Wasm also support these primitives in copied arrays and record fields; npm, C, C++, Python, Rust, C#, Java, Kotlin, Ruby, Perl, native PHP, PHP-Wasm and WIT/WASI also support nested arrays, acyclic copied records, tagged Option/Except values and nested binary products. npm, C, C++, Python, Rust, C#, Java, Kotlin, Ruby, Perl, native PHP, PHP-Wasm and WIT/WASI also support `List` on both source paths. Documentation and argument names may differ from the compiler's defaults and are retained in the generated Binding IR. Host export names must match.

All seventeen consumer profiles also compile reviewed synchronous callbacks and returned Lean closures whose arguments and result use these nineteen primitives. The callback contract must specify repeated invocation (`many`), same-agent re-entry, deferred self-disposal, value delivery, and the native callback failure policy. Host callbacks are borrowed for the call; returned closures carry explicit leases. The review's outer parameter count determines the arity of an export returning a closure. Do not duplicate that decision in the configuration. The compiler checks both the outer export and the remaining callable signature before linking. See the installed checks for [npm](../evidence/npm-callables-20260919.md), [C++](../evidence/cpp-callables-20260919.md), [C](../evidence/c-callables-20260918.md), [Perl](../evidence/perl-callables-20260918.md), [Python](../evidence/python-callables-20260918.md), [Ruby](../evidence/ruby-callables-20260919.md) and [Rust](../evidence/rust-callables-20260919.md).

Targets `c`, `cpp`, `cargo`, `pypi`, `rubygems`, `nuget`, `maven`, `cpan`, `php-native`, `php-wasm` and `wit-wasi` also compile structured callback and closure payloads: arrays, Lists, options, results, products, acyclic records, variants and transparent aliases. [C](../publish/c.md#export-callbacks-and-closures) uses typed views and cleanup functions; [C++](../publish/cpp.md#export-copied-callback-payloads) and [Rust](../publish/cargo.md#structured-callback-values) use owned value types and scoped cleanup. [Python](../publish/pypi.md#structured-callback-values) uses owned tuples and generated value classes, with precise callback and closure annotations. [Ruby](../publish/rubygems.md#structured-callback-values) uses copied Arrays and generated frozen value classes, with blocks or callable objects. [C#](../publish/nuget.md#structured-callback-values) uses typed arrays, records, `Option`/`Result` values and `Func` delegates. [Java and Kotlin](../publish/maven.md#structured-callback-values) use typed functional interfaces and their own copied value classes, with `AutoCloseable` returned closures. [Perl](../publish/cpan.md#export-structured-callbacks) uses CODE references, plain array references and generated constructor classes, with copied callback values and closable returned functions. Host callbacks remain call-scoped borrows and returned closures remain explicit leases. npm accepts those copied payloads and finite recursive values, with plain objects and arrays plus generated TypeScript types. Native PHP, PHP-Wasm and WIT/WASI also accept these acyclic copied payloads. All seventeen profiles also accept finite recursive callback values, including [WIT/WASI](../publish/wit-wasi.md#export-recursive-callbacks).

Schema-3 reviewed builds reject resources and callbacks inside copied containers. Resource-containing values require a schema-4 contract and an ownership-aware target. Both versions reject defaults, optional arguments, asynchronous operations, author-supplied compiler evidence and assurance claims. Do not combine a review with `exports`, `resources`, `ownedAggregates`, `arities`, `specializations` or `contracts` in the configuration.

Use the same source project for npm or PHP-Wasm, with the target coordinates from the [npm](../publish/npm.md) and [PHP](../publish/php.md) guides. For an API admitted by all three profiles:

```sh
lean-bridge build --project . --target npm --target php-native --target php-wasm \
  --output ./build/reviewed-multi-release
```

The builder compiles once per ABI, checks that each profile used the same reviewed input and source API, and creates the output directory only after every target succeeds. The combined API can use supported copied values or synchronous callables with finite copied payloads. npm containers and callables can share a component. Options, results, products, Lists, concrete copied aliases and non-recursive tagged variants can target npm, C, C++, Python, Rust, C#, Java, Kotlin, Ruby, Perl, native PHP, PHP-Wasm and WIT/WASI. The builder does not silently omit reviewed declarations. Source-configured closure arities still require separate target builds.

Recursive copied values have installed acceptance across all seventeen consumer
profiles. [Recursive-value coverage](export-decisions.md#start-with-the-runnable-npm-shapes) and the
[type conversion tables](../reference/types.md) distinguish copied inputs,
results and fields from recursive callback payloads. Both groups have installed
checks across npm, C, C++, Python, Rust, Ruby, Perl, C#, Java, Kotlin, native PHP,
PHP-Wasm and WIT/WASI.

Native and PHP-Wasm models and compilation receipts retain the review's raw file, source hash and semantic hash alongside fresh compiler evidence. npm retains the review in its source-intent request and `metadata/lake-entry-exports.json`; target compilation must reproduce that report, and packaging repeats the source/contract checks. Package receipts bind these artifacts through their recorded hashes. A signature disagreement returns `reviewed-ir-source-mismatch`; an unsupported review decision returns `reviewed-ir-build-unsupported`. Unsupported source types retain the target's compiler diagnostics. None produces a release. Compiler-free `analyze` validates the document only; it does not establish source agreement.

### Describe the downstream packages

Add a shared `package` object for the library's description, authors, homepage and repository. Ordinary npm, native and PHP-Wasm builds all use it. The [package metadata guide](../publishing.md#declare-package-metadata) lists the fields and their mapping to each ecosystem. Keep target names and versions under `targets`; descriptive metadata does not select build targets or replace export decisions.

### Export concrete specializations

For npm and every native target, select concrete versions of a generic function without adding wrappers to the Lean library. Given this definition in `Library.lean`:

```lean
universe u
def Library.echo {α : Type u} (value : α) : α := value
```

Configure the exported names and their type arguments in `lean-bridge.exports.json`:

```json
{
  "schemaVersion": 1,
  "modules": ["Library"],
  "exports": ["Library.echoNat", "Library.echoText"],
  "specializations": [
    { "name": "Library.echoNat", "declaration": "Library.echo", "types": ["Nat"] },
    { "name": "Library.echoText", "declaration": "Library.echo", "types": ["String"] }
  ]
}
```

Lean checks each application and the build compiles two concrete functions. The generated TypeScript API is:

```ts
export declare function echoNat(arg0: bigint): bigint;
export declare function echoText(arg0: string): string;
```

Use the usual `analyze`, `build --target npm`, and `publish --target npm --dry-run` commands. Consumers call the named functions from the installed package; they supply no Lean type arguments. The runtime remains an automatic npm dependency.

For Perl, use `build --target cpan`. The generated functions are `echo_nat` and `echo_text` in your configured `targets.cpan.module`. Consumers pass the usual [Perl values](../consume/perl.md#type-conversions), including `Math::BigInt` for `Nat`; they supply no type arguments. See the [CPAN specialization example](../publish/cpan.md#export-a-specialized-closure).

The other native targets name the concrete functions in their usual style: `library_echo_nat` in C, `lean_bridge::library::echo_nat` in C++, `echo_nat` in Python, Rust and Ruby, `Api.EchoNat` in C#, `Api.echoNat` in Java and Kotlin, `LeanLibrary\echo_nat` in native PHP and `echo-nat` in WIT. Each package exposes only the concrete names; the open declaration is absent. The [installed checks](../evidence/native-specializations-20261006.md) cover implicit type arguments, explicit type arguments, Lean-selected instance dictionaries, and alias type arguments including an alias of `Array UInt32`, for these targets. A type argument that instantiates a generic variant is rejected for native targets with the `unsupported-native-type` diagnostic naming the specialization; define a concrete variant instead. A type argument that instantiates a generic structure, such as `Pair UInt32 String`, is rejected with the same diagnostic when nothing names it; name it with an abbrev and it becomes an alias-named record, as [described below](#name-instantiations-of-generic-structures).

Each entry needs a new fully qualified `name`, an existing public `declaration` in the selected modules, and one to eight `types`. Types are closed Lean constant names, including aliases, in leading parameter order. Expressions such as `Array UInt32` are not configuration syntax; define a named Lean alias for a constructed type. Lean resolves universe levels and any instance binders immediately following that type prefix. Remaining arguments and results must fit the selected profile: [supported copied types for npm](export-decisions.md#start-with-the-runnable-npm-shapes), or the existing [native Perl types](../consume/perl.md#type-conversions) for CPAN. Native `resources` still identifies source types. Native `arities` uses the new specialization name and counts runtime arguments after type and instance arguments have been resolved.

The file accepts at most 128 specializations. Names cannot duplicate each other, shadow existing declarations, or refer to another specialization. When `exports` is present, include every configured specialization name. Without `exports`, discovery includes the concrete names and omits their unspecialized source functions; other public functions still need supported signatures.

Missing instances, unresolved types, dependent runtime inputs, effects and admitted implementations stop the build. Analysis loads Lean's built-in class and instance indexes without executing package initializers. The metadata retains the exact compiler application, original declaration, documentation and theorem references. Target compilation must reproduce that metadata before linking. Public `analyze` continues to use the scalar profile; use the CPAN build to check native-only signatures. Specialization emits separately named concrete functions, without generic host-language overload dispatch.

### Name instantiations of generic structures

A generic structure such as `structure Pair (α β : Type)` or a universe-polymorphic `structure Box (α : Type u)` can appear in an export only through a transparent alias that fixes every argument:

```lean
abbrev NatBox := Box Nat
abbrev WordPair := Pair String Nat
abbrev Boxes := List NatBox

def bump (value : NatBox) : NatBox := ⟨value.value + 1, value.count + 1⟩
```

The alias is the record's name in every host: npm declares `interface NatBox`, C declares `library_nat_box`, C++ declares `struct NatBox`. Lean instantiates each field's type and the constructor at the alias's arguments and universes. `Box Nat` and `Box String` under two aliases have different fields. Two aliases of the same application, such as `NatBox` and `NatBoxAgain`, keep separate names and the same layout. Host assignability follows the host language: TypeScript interfaces with the same fields are interchangeable. The Binding IR records each alias's origin as the `lean-lang.org/instantiation` extension, including the structure and resolved arguments.

An application that is not named by an alias, in a signature or as an argument of another instantiation (`Box (Box Nat)` needs an alias for the inner box), stops the build with `name this instantiation of a generic structure with an abbrev`. Fields whose runtime type depends on a value, propositions as arguments, and arguments that carry a resource, a callback or a refinement anywhere inside them (`Box (Fin 10)`, `Tag (Option (Fin 10))`, or a record whose field is refined) are rejected at the source. [Inherited records](#export-inherited-records) preserve parent subobjects. [Checked records](#export-a-record-with-proof-fields) have a separate constructor-checked mapping for erased proof fields and closed `Nat` indices. An argument that no field carries (a phantom parameter) is admitted: the package still carries the nominal type it names, reachable only through the instantiation. Generic variants still require a [specialization](#export-concrete-specializations), and refined fields inside an instantiated record follow the [refinement matrix](#refinement-support-by-target).

The [installed checks](../evidence/generic-record-specializations-20261007.md) cover Node/TypeScript, C, C++, Python 3.11 and 3.12, Rust, Ruby, C#, Java, Kotlin, native PHP, WIT/WASI and all four pinned Perl ABIs. They exercise direct record exports and nine configured specializations over record aliases, separate namespaces, lists and options.

The [browser run](../evidence/generic-record-browser-20261008/receipt.json) also covers Array-valued fields, the nine specializations and separate namespaces in Chromium, Firefox and WebKit. Each page, React production/strict and worker execution performs 1025 checks and 1023 rejection checks. The harness verifies the installed descriptor, served Wasm hashes, React cleanup, worker shutdown and recovery after a failed asset request. It removes author/build files before installation and serves only the bundled deployment. [PHP-Wasm direct-record checks](../evidence/php-wasm-generic-records-20261007/receipt.json) are separate: those twelve executions do not include configured function specializations or Array-valued fields. Reviewed generic-record signatures remain unmeasured by these runs.

### Export inherited records

Lean Bridge keeps Lean's constructor and projection layout for copied inherited records. A parent subobject becomes a nested field, not a set of flattened host fields. Lean decides the layout when parents overlap; the bridge checks that the constructor accepts the projected field types in that order.

For a generic parent, give its closed instantiation one alias in the compiled source closure:

```lean
namespace Library

structure Base (α : Type) where
  value : α

structure Child (α : Type) extends Base α where
  count : Nat

abbrev NatBase := Base Nat
abbrev NatChild := Child Nat

def increment (child : NatChild) : NatChild :=
  { child with value := child.value + 1 }

end Library
```

The `NatChild` boundary shape has `toBase : NatBase` and `count : Nat`. In JavaScript, its input is `{ toBase: { value: 4n }, count: 2n }`. Both aliases retain their own generic-structure origin in the Binding IR; a phantom type argument remains part of that origin even when no field stores it.

Parent discovery considers public, safe, universe-free aliases in the project's compiled modules and imported captured dependencies. It excludes unimported modules. No matching alias, or several aliases for the same parent, produces a source diagnostic. A field whose type explicitly names an alias needs no discovery and keeps that identity even when another equal alias exists.

The compiler builds the parent-alias index once per request when needed, with a limit of 65,536 declarations. Exceeding that limit refuses declarations that need discovery; unrelated exports remain available. Value-dependent runtime fields and recursive generic records remain unsupported. Proof-bearing records require the separate [checked-record mapping](#export-a-record-with-proof-fields); inheritance acceptance does not establish that combination. The [source checks](../../tests/generic-inheritance.test.mjs) cover parent aliases, universe instances, imported dependencies, ambiguity and the discovery limit; [plain inheritance checks](../../tests/inherited-records.test.mjs) also cover overlapping parents and a checked `Fin` field inside a parent.

The [installed inheritance evidence](../evidence/inherited-records-20261008/receipt.json)
covers ordinary-source C/C++ and Node packages with those nested parent fields.
The generic fixture checks three direct exports over six closed aliases, including
universe and phantom arguments. C performs 2011 checks, C++ 2007 and Node 1005 checks
plus 1006 rejections; the installed declarations also pass strict TypeScript.
Separate plain-inheritance C/C++ packages each pass 2010 checks for single, multiple,
multilevel and overlapping parents, including a parent `Fin 10` field. The packages
reproduce across two builds and install offline after author/build deletion.
These runs do not establish browser or reviewed inheritance, other native hosts,
or configured generic function specializations over inherited records.

### Declare export contracts

Use `contracts` to require specific ownership, lifetimes, refinement policies or boundary effects. Each key names an exact exported declaration or configured specialization. Lean checks the decisions against the compiled signature and the selected adapter. A mismatch stops the build before linking.

For the `Library.echo` definition above, this configuration requires a copied `UInt32` argument and result:

```json
{
  "schemaVersion": 1,
  "modules": ["Library"],
  "exports": ["Library.echoWord"],
  "specializations": [
    { "name": "Library.echoWord", "declaration": "Library.echo", "types": ["UInt32"] }
  ],
  "contracts": {
    "Library.echoWord": {
      "parameters": [{ "ownership": "copy", "lifetime": null }],
      "result": { "ownership": "copy", "lifetime": null, "refinement": "reject" },
      "effects": []
    }
  }
}
```

Each contract needs at least one of `parameters`, `result`, `effects` or `receiver`. Omitted decisions keep the adapter's existing rules. If supplied, `parameters` covers every runtime argument in order, including a selected receiver, after specialization and configured closure arity. The file accepts at most 128 contracts. When `exports` is present, every contract key must appear there; otherwise it must name an export discovered by Lean.

| Value at the boundary | Supported ownership and lifetime |
| --- | --- |
| npm primitive arguments and results | `"copy"`, `null` |
| CPAN primitive values, copied arrays and copied records | `"copy"`, `null` |
| CPAN resource argument; any supported callback argument | `"borrow"`, `{ "scope": "call", "anchor": null }` |
| CPAN resource result; any supported Lean closure result | `"lease"`, `{ "scope": "explicit", "anchor": null }` |

npm leases use `dispose()` or `Symbol.dispose`. Perl, Python and Ruby leases use the generated object's lifetime and `close` operation; Python supports `with` blocks; Ruby supports `with { |closure| ... }`. Rust uses thread-confined `LeanClosure` values with `Drop` and `close`; C uses explicit `_dispose` functions. A call-scoped borrow does not let Lean retain a host callback after the call. See the closure examples for [C](../publish/c.md#export-callbacks-and-closures), [CPAN](../publish/cpan.md#export-a-specialized-closure), [PyPI](../publish/pypi.md#export-callbacks-and-closures), [RubyGems](../publish/rubygems.md#export-callbacks-and-closures) and [Cargo](../consume/rust.md#callbacks-and-returned-lean-closures).

`effects` must match the adapter's boundary effects: `[]` for the current scalar and native APIs without callback arguments, or `["host-call", "fails"]` when an argument is a callback. Order does not matter. These labels describe the host-call protocol, not memory allocation inside Lean or a proof that arbitrary function bodies are pure. Returned `IO`, `EIO`, `Task` and other unsupported actions still fail signature checking.

`refinement: "reject"` refuses refined values, including refinements nested inside containers, records, variants, aliases, recursive types, and callback signatures. It never erases a `Fin` bound or `Subtype` predicate.

### Export bounded integers

Ordinary-source npm packages support `Fin n` as a parameter or result, including inside `Array`, `List`, `Option`, pairs, `Except`, copied record and variant fields, container aliases, and finite recursive values. The bound must reduce to a closed natural-number literal. No constructor setting is needed: Lean Bridge reads the bound from Lean and generates the checks.

```lean
namespace Library

def reverseDigits (values : Array (Fin 10)) : Array (Fin 10) := values.reverse

end Library
```

The installed JavaScript package accepts `bigint` values:

```js
import { reverseDigits } from "my-library";

console.log(reverseDigits([0n, 9n])); // [9n, 0n]
reverseDigits([10n]); // Throws: each value must be below 10.
```

Generated JavaScript checks every constrained element. Compiled Lean checks again before constructing proof-carrying values or calling the source function; invalid input leaves the runtime usable. Empty arrays and lists of `Fin 0`, and `Option.none`, are valid even though no individual `Fin 0` value exists. Bounds larger than a machine word remain exact.

For a record containing a bounded value and a container alias:

```lean
abbrev Digits := Array (Fin 10)

structure Packet where
  digit : Fin 10
  digits : Digits

def echoPacket (value : Packet) : Packet := value
```

The consumer passes `{ digit: 9n, digits: [0n, 9n] }`. Every constrained field is checked, including fields reached through aliases and recursive constructors. A record with a `Fin 0` field has no valid value, but `Option.none` of that record is valid. The adapter never fabricates a default inhabitant.

Synchronous callbacks and returned closures also preserve `Fin` bounds, including bounds in copied fields, aliases, and nested containers:

```lean
def transformDigit (f : Fin 10 → Fin 10) (value : Fin 10) : Fin 10 := f value
```

The JavaScript consumer calls `transformDigit(value => (value + 1n) % 10n, 9n)`. A reply of `10n` fails the bound check. The compiled adapter checks replies independently of the JavaScript wrapper, and later valid calls still work. Returned closures check their arguments and keep their usual `dispose()` lifecycle. Nominal `Fin` values and callbacks can share one component.

Callback recovery must have a valid Lean result while the call unwinds. Positive `Fin` bounds provide zero; empty arrays and lists, absent options, and inhabited variant branches can provide recovery values without constructing their elements. A callback or returned-closure result with no finite recovery value, such as bare `Fin 0` or a record requiring `Fin 0`, is rejected at build time. `Option (Fin 0)` and `Array (Fin 0)` results are accepted, but only absent or empty values can cross the boundary. The callback error is reported to the caller, not returned as a successful fallback value.

Native refinements and `Subtype` constraints inside callback signatures remain unsupported. This installed-package evidence covers Node JavaScript and TypeScript; browser profiles are not yet audited for refined callbacks.

#### Bounded integers in native packages

Ordinary-source native packages support `Fin n` as a top-level parameter or result, including through transparent aliases. The bound must reduce to a closed natural-number literal, and bounds wider than a machine word stay exact:

```lean
namespace Library

abbrev Slot := Fin 300

def mirror (value : Fin 10) : Fin 10 := ⟨9 - value.val, by omega⟩
def twice (value : Slot) : Nat := value.val * 2

end Library
```

Each target passes these values in the type it uses for `Nat`. An argument at or above its bound fails the call, and the error message names the parameter and bound, for example `arg0 is not below its Fin 10 bound`. Exported parameters are named `arg0`, `arg1` and so on.

| Target | Value type | Argument at or above the bound |
| --- | --- | --- |
| `c` | GMP `mpz_t` | `INVALID_ARGUMENT` status |
| `cpp` | `boost::multiprecision::cpp_int` | `Error` with the `INVALID_ARGUMENT` status |
| `cargo` | `BigUint` | `Err(Error::Native { code: 1, .. })` |
| `pypi` | `int` | `LeanBridgeError` with status 1 |
| `rubygems` | `Integer` | `RangeError` |
| `nuget` | `System.Numerics.BigInteger` | `ArgumentException` |
| `maven` | `java.math.BigInteger` | `IllegalArgumentException` |
| `php-native` | `Brick\Math\BigInteger` | `LeanBridgeError` with code 1 |
| `wit-wasi` | `list<u32>` limbs | Wasmtime call error |
| `cpan` | `Math::BigInt` | `die` with the message |

Each package checks the bound before it calls Lean, and outputs and caller data are left unchanged. The compiled Lean adapter checks each bound again before it constructs `Fin`, so code that calls the exported adapter symbol directly cannot skip the check. Every input to a `Fin 0` parameter is rejected, and later valid calls still work. A negative value keeps the target's existing `Nat` error. Generated API documentation and package READMEs state each bound, except C and C++ headers.

Installed checks cover [C and C++](../evidence/native-fin-20261005.md) and [Rust, Ruby, .NET, Java, Kotlin, native PHP and WIT/WASI](../evidence/native-fin-hosts-20261006.md). [Python wheels](../evidence/python-refinements-20261007/receipt.json) have installed scalar checks on Python 3.11 and 3.12, plus container and checked Subtype consumer checks.

`Fin` is also checked inside `Array`, `List` and `Option` at parameters and results, including nested combinations such as `Array (Option (Fin 10))` and aliases such as `abbrev Digits := Array (Fin 10)`. The bundled adapter checks every present element before Lean is called. An empty array or `none` is valid even for `Fin 0`. Generated documentation writes element bounds as `arg0[*] < 10` and present option values as `arg0? < 10`. CPAN's XS checks use typed accessors and name the failing element, for example `arg0[2]? is not below its Fin 10 bound`. [Reviewed CPAN container packages](../evidence/reviewed-perl-containers-20261007/receipt.json) have installed results on four ABIs; ordinary-source container and Subtype acceptance remains pending.

Native generators also check `Fin` inside pairs, `Except`, plain record and variant fields, and combinations of those shapes with containers. [Product](../evidence/native-fin-products-20261007/receipt.json), [Array-of-product](../evidence/native-fin-product-arrays-20261007/receipt.json) and [nominal-field](../evidence/native-fin-records-20261007/receipt.json) packages have ordinary and reviewed C/C++ installed results. Other native hosts await installed acceptance for these signatures. Refined generic, recursive and callback-bearing nominal types remain rejected. Native callbacks with refined signatures are not yet supported. See the target matrix below for reviewed Binding IR and PHP-Wasm status.

### Export a record with proof fields

The compiler has a checked-record mapping for C, C++ and npm. Installed-package acceptance for this mapping is pending. The [fixture](../../tests/fixtures/onboarding/checked-records/CheckedRecords.lean) and [checks](../../tests/checked-records.test.mjs) cover records whose proofs constrain their payload fields:

```lean
namespace CheckedRecords

structure Interval where
  lo : Nat
  hi : Nat
  ordered : lo ≤ hi

def mkInterval (lo hi : Nat) : Option Interval :=
  if h : lo ≤ hi then some ⟨lo, hi, h⟩ else none

def width (value : Interval) : Nat := value.hi - value.lo

end CheckedRecords
```

Select a checked constructor at each input site in `lean-bridge.exports.json`:

```json
{
  "schemaVersion": 1,
  "modules": ["CheckedRecords"],
  "exports": ["CheckedRecords.width"],
  "contracts": {
    "CheckedRecords.width": {
      "parameters": [{
        "ownership": "copy",
        "lifetime": null,
        "refinement": { "constructor": "CheckedRecords.mkInterval" }
      }],
      "result": { "ownership": "copy", "lifetime": null }
    }
  }
}
```

The constructor must take the payload fields by their exact names, order and types, then return `Option` of the exact record. Lean checks its safety and selected-module dependencies. A constructor can normalize accepted values. Selecting different constructors for two parameters of the same record changes each parameter's behavior.

The host passes only payload fields, such as `{ lo: 3n, hi: 10n }` in JavaScript. The private adapter receives a typed payload mirror without the `ordered` proof. It calls `mkInterval` before calling `width`; `none` rejects the call. It never constructs an unchecked `Interval` or supplies a substitute proof. Native public validation and the adapter each own a fresh conversion. A Lean-produced result already has its proofs, so the adapter returns only its payload and needs no constructor selection at that result site.

Closed natural-number indices use aliases such as `abbrev Triple := Sized 3`, where `Sized` stores `data : Array Nat` and a proof `data.size = n`. A checked constructor takes `data` and returns `Option Triple`. The host record has only `data`; the index `3` remains in authenticated type metadata. A package can export only `Nat → Triple` without having a checked input anywhere.

For a reviewed API, record erased proof names in the type's `lean-lang.org/erased-proofs` extension, and select `{ "kind": "checked-record", "constructor": "CheckedRecords.mkInterval" }` in the declaration's parameter refinement. A closed `Nat` index appears as `{ "kind": "value", "type": { "kind": "primitive", "name": "nat" }, "value": "3" }` in `lean-lang.org/instantiation`. The [independent review fixture](../../tests/helpers/checked-record-fixture.mjs) shows the complete form. Fresh Lean must reproduce the payload layout, erased names, indices and selected constructor. Configuration contracts cannot override a review.

This mapping currently requires a nonempty, closed copied payload at a top-level parameter or result. Nested checked records, value-dependent runtime fields, recursive checked records, other index kinds, callbacks and other target packages remain unsupported. npm uses private ABI 8 for its proof-free carriers. Those implementation checks do not establish installed C/C++ or JavaScript/TypeScript acceptance.

### Export a checked Subtype

For a top-level `Subtype` parameter or result, provide a total Lean function that checks a host value and returns the exact subtype:

```lean
namespace Library

abbrev Small := { value : UInt32 // value < 10 }

def checkedSmall (value : UInt32) : Option Small :=
  if bound : value < 10 then some ⟨value, bound⟩ else none

def echoSmall (value : Small) : Small := value

end Library
```

Name that constructor at every refined boundary site:

```json
{
  "schemaVersion": 1,
  "modules": ["Library"],
  "exports": ["Library.echoSmall"],
  "contracts": {
    "Library.echoSmall": {
      "parameters": [{
        "ownership": "copy",
        "lifetime": null,
        "refinement": { "constructor": "Library.checkedSmall" }
      }],
      "result": {
        "ownership": "copy",
        "lifetime": null,
        "refinement": { "constructor": "Library.checkedSmall" }
      },
      "effects": []
    }
  }
}
```

Lean Bridge verifies the fully qualified constructor instead of trusting its name. It must belong to a selected module, take one explicit value of the subtype's exact base type, and return `Option` of the exact subtype. Its selected-module dependencies cannot be unsafe, partial, foreign, or replaced with `implemented_by` code.

Ordinary-source npm packages accept top-level parameters and results over primitive bases, including heap-backed `Nat`, `Int`, `String`, and `ByteArray`. These exports can share a package with arrays, records, recursive values, callbacks, and returned closures. For example, an export may take a checked nonempty string alongside a callback; an empty string rejects before that callback runs. JavaScript and TypeScript use the base type's normal representation. Compiled Lean calls the constructor before the exported function; `none` rejects the host call, while `some` supplies the proof-carrying value. A result is already a Lean subtype and is projected through `.val` at the generated boundary. Rejected inputs release decoded arguments and leave the runtime available for subsequent calls. Subtype refinements inside fields, containers, or callback signatures remain unsupported.

The native targets `c`, `cpp`, `pypi`, `cargo`, `rubygems`, `nuget`, `maven`, `php-native` and `wit-wasi` accept the same top-level primitive-base sites with the same constructor checks. The host passes the base value; the bundled adapter validates every argument's structure and every `Fin` bound first, then runs each checked constructor through an exported validator before the exported function runs, so a rejected value fails the call with the host's invalid-argument error naming the parameter and constructor, for example `arg0 was rejected by Library.checkedSmall`, and no caller data or output changes. A valid call runs the constructor twice (once in the validator, once in the adapter that builds the proof-carrying value) and the exported function once; the exported function receives the constructed value, so a normalizing constructor such as `fun value => some ⟨min value 100, _⟩` changes what it sees. Results are projected through `.val`. Generated documentation names each constructor, for example `arg0 checked by Library.checkedSmall`. CPAN packages run the same exported validators from the generated XS, after every `Fin` bound and before the guarded adapter or the exported function, with the same message; their installed acceptance is not yet recorded. See the [installed checks](../evidence/native-subtype-20261007.md).

In a schema-3 reviewed API, describe a `Subtype` with its primitive transport type and name its constructor in the declaration's `source.extensions["lean-lang.org/refinements"]`. For a checked `Nat` parameter returning an ordinary `Nat`:

```json
{
  "parameters": [{ "kind": "subtype", "constructor": "Library.checkedEven" }],
  "result": null
}
```

Keep `lean-bridge.exports.json` limited to modules and target package settings. The review supplies each constructor; configuration `contracts` cannot override it. Analysis, build and target recompilation retain the same selection, and fresh Lean checks the constructor and exported signature. A specialization uses its public export name, so two specializations of one generic can choose different constructors. Changing to another valid constructor is an API change, including when it normalizes accepted inputs. [Installed reviewed Subtype checks](../evidence/reviewed-subtype-20261008/receipt.json) cover C, C++ and Node JavaScript/strict TypeScript. Other reviewed hosts and browser profiles remain pending.

#### Refinement support by target

"Installed" records executed package consumers. "Generated; pending" means the compiler admits the shape but its installed acceptance is not recorded. "Native" means the targets that share the C-family adapter: `c`, `cpp`, `pypi`, `cargo`, `rubygems`, `nuget`, `maven`, `php-native` and `wit-wasi`. PHP-Wasm's Fin support applies only to plain copied packages; its installed combinations are listed below the table.

| Site | npm (Node and browser) | Native | `cpan` | `php-wasm` | Reviewed Binding IR |
| --- | --- | --- | --- | --- | --- |
| `Fin n` parameter or result | Installed | Installed | Installed | Nested only; bare scalar pending | Installed: npm, browser and native hosts including CPAN. PHP-Wasm: nested only; bare scalar pending |
| `Fin n` inside `Array`, `List`, `Option` | Installed | Installed | Reviewed installed; ordinary pending | Nested products/fields only; direct containers pending | Installed: npm, browser and native hosts including CPAN. PHP-Wasm: nested products/fields only; direct containers pending |
| `Fin n` inside pairs and `Except` | Installed | C/C++ installed; other hosts pending | Generated; pending | Installed, both source routes | Installed: npm, browser, C/C++ and PHP-Wasm; other hosts pending |
| `Fin n` inside `Array` of pairs and `Except` | Generated; separate installed run pending | C/C++ installed | Generated; pending | Generated; pending | C/C++ installed; other hosts pending |
| `Fin n` in record or variant fields | Node installed; browser pending | C/C++ installed; other hosts pending | Generated; pending | Installed, both source routes | C/C++ and PHP-Wasm installed; other native hosts pending |
| `Fin n` in callbacks and closures | Node installed; browser pending | C/C++ safe directions installed; other hosts pending | Rejected | Rejected | Bounds validated; fresh-Lean and installed acceptance pending |
| `Subtype` parameter or result over a primitive | Installed | Installed | Generated; installed acceptance pending | Rejected | C/C++ and Node installed; other profiles pending |
| `Subtype` elsewhere, or without a checked constructor | Rejected at the source | Rejected at the source | Rejected | Rejected | Rejected |
| Record with erased proof fields and a checked input constructor | Generated; installed acceptance pending | C/C++ generated; other hosts rejected | Rejected | Rejected | C/C++ and npm generated; installed acceptance pending |

Reviewed `Fin` signatures describe the erased `Nat` transport and exact bounds in `source.extensions["lean-lang.org/refinements"]`. Aliases, records and variants keep their field constraints in `lean-lang.org/nominal-refinements`. Fresh Lean metadata must match every constraint, including nested bounds and parameter/result positions. A missing, invented or changed bound fails with `reviewed-ir-source-mismatch`. Reviewed parameter names remain in host error messages.

A reviewed callback puts its parameter/result bounds on the callback definition's `lean-lang.org/refinements` extension. Those bounds participate in its `Callback...` identity, just as they do in compiler output. Record and variant payloads retain their nominal field bounds. The review checks tree shape and exact bounds without adding them to the compiler's export selection; reconciliation compares the fresh compiler contract. Empty decisions, unknown keys and callback `Subtype` decisions are rejected. Unrefined callback identities remain unchanged. Fresh-Lean and installed reviewed callback acceptance are pending.

Installed reviewed scalar and container reports cover [C/C++](../evidence/reviewed-fin-20261007/receipt.json), [Python and Rust scalar](../evidence/reviewed-scalar-hosts-20261007/receipt.json), [managed/PHP/Ruby/WIT scalar](../evidence/reviewed-scalar-rollout-20261007/receipt.json), [the other native container hosts](../evidence/reviewed-fin-hosts-20261007/receipt.json), and CPAN [scalar](../evidence/reviewed-perl-scalar-20261007/receipt.json) and [containers](../evidence/reviewed-perl-containers-20261007/receipt.json). They record two-root reproduction, source-free consumers and each local runtime floor. C and Perl reports include dispatch counters; C++ and private host libraries do not imply separate counters. Reviewed nominal fields have C/C++ installed acceptance; the other native hosts remain pending. Reviewed `Subtype` constructors now supply the compiler selection; installed acceptance remains pending. Reviewed callback acceptance is separate from these results.

C and C++ packages check `Fin` arguments of a returned Lean closure before invoking it, including bounds inside structural containers, plain records and variants. They also preserve bounded values that Lean produces as closure results or host-callback arguments. A returned closure rejects an argument at or above its bound with `INVALID_ARGUMENT`; C++ throws `Error`. The Lean adapter independently constructs each `Fin` from a decidable proof and returns `none` on rejection. It never substitutes a default Fin. `Fin 0` rejects every value. Ordinary C/C++ host callbacks can return Fin inside a shape with a Fin-free failure value, such as `Option (Fin 5)` or `Array (Fin 5)`. The C wrapper checks bounds before conversion; Lean independently reconstructs bounded values from decidable proofs. A rejected reply preserves the first error, suppresses later host callbacks and leaves the caller's output unchanged. Lean may continue internally with a typed Fin-free placeholder, so this is not a rollback guarantee. Bare Fin replies, replies whose selected failure constructor requires a Fin, callback Subtype, checked records, nested callbacks and refined ordinary arguments beside callbacks remain rejected. Reviewed host replies need separate installed acceptance. Other native targets require their own adapters.

The [ordinary-source C/C++ installed run](../evidence/native-fin-callbacks-20261008/receipt.json) records 297 C checks and 283 C++ checks against source-free, offline installations, with byte-identical packages from two author roots. C dispatch counters distinguish the public lease entry, checked Lean adapter and source body: a rejected public call enters the public function but not the adapter or source; a rejected direct adapter call enters the adapter but not the source. Valid and recovery calls advance the corresponding counters. C++ dispatch was not measured. This local run uses glibc 2.36; reviewed contracts, other native hosts and release-floor acceptance remain separate.

The [ordinary-source browser callback run](../evidence/browser-callback-fin-20261008/receipt.json) executes fourteen exports in Chromium, Firefox and WebKit pages, React production/strict effects and dedicated workers. Each of the twelve contexts records 409 checks and 894 rejected calls. These cover host replies, returned closures, nested containers and nominal or recursive fields, including `Fin 0`, recovery after rejection and closure disposal. The checks distinguish public JavaScript rejection from compiled-adapter rejection and verify the installed WebAssembly bytes served by the page. Author sources and build staging are removed before offline installation. This run does not measure dispatch or establish reviewed-browser or native host-reply acceptance.

The [ordinary PHP-Wasm Fin run](../evidence/php-wasm-fin-20261008/receipt.json) and [independently reviewed run](../evidence/reviewed-php-wasm-fin-20261008/receipt.json) cover pairs, active `Except` branches and copied record/variant fields. Tested compositions include `List (Option (Fin 3 × Except (Fin 2) Nat))`, arrays and lists of refined records, optional variants, and products/results containing records and variants. They do not execute bare top-level Fin or direct Array/List/Option (Fin n) exports, and do not establish every possible container combination or a separate Array-of-products run. Each complete fixture runs in twelve modes: eight Node embedded/Composer combinations and four Chromium bundled combinations, with startup/lazy loading and weak/strict PHP callers. The product fixture performs 2039 checks per execution and the record fixture 2053. Packages reproduce across two author roots and run after removal of source/build files. Fin 0 rejection, active-branch checks, caller immutability and recovery remain in the callers. The reviewed run also compiles the independent contracts with fresh Lean and rejects altered bounds. Both runs use Node 22.23.3, Chromium 154.0.8037.57 and PHP 8.4.1 on wasm32. Source dispatch is unmeasured; checked Subtype, refined callbacks and graph/owned refinement transports remain separate work.

The npm column covers Node JavaScript and strict TypeScript. [Ordinary and reviewed Fin acceptance](../evidence/reviewed-fin-npm-20261007/receipt.json) also runs scalar and nested structural signatures in Chromium, Firefox and WebKit pages, React effects and dedicated workers. Browser nominal-field and callback cases remain separate. Top-level `Subtype` browser checks are in the earlier [browser acceptance](../evidence/npm-browser-refinements-20261007.md). The compiled npm adapter rejects an out-of-bound top-level `Fin` or a rejected `Subtype` before the typed wrapper or source runs; direct calls through the package-internal runtime cannot obtain a default value ([scalar Fin rejection](../evidence/npm-scalar-fin-rejection-20261007.md)).

Native source rejections name the declaration in `native-elaboration-unsupported`. Readers without a checked adapter reject refined metadata with `native-refinements-unsupported`. PHP-Wasm keeps checked Subtype and packages combining Fin with graph, owned or callable transports rejected. A consumer that does not declare checked support cannot read a verified refined component (`native-refinements-unavailable`). Python's [installed CI reports](../evidence/python-refinements-20261007/receipt.json) cover scalar and container `Fin`, top-level checked `Subtype`, and finite function specializations. Local acceptance does not establish a hosted CI result for a later revision.

C, C++, Rust, Python, Ruby, C#, Java, Kotlin and Perl packages support [explicit input transfers](../publish/c.md#transfer-input-ownership) for resource-containing values and returned Lean closures. [Native PHP and PHP-Wasm](../php.md#consuming-inputs), [JavaScript/TypeScript](../javascript-typescript.md#consuming-inputs) and [WIT/WASI](../consume/wit-wasi.md#consuming-inputs) also consume checked resource leases. Ordinary configuration and reviewed APIs preserve those decisions through compiler analysis.

C, C++, Rust, Python, Ruby, C#, Java, Kotlin, Perl, native PHP, PHP-Wasm, JavaScript/TypeScript and WIT/WASI packages accept [function results anchored to an input owner](../publish/c.md#anchor-a-result-to-an-input). Use `"ownership": "borrow"` with a `"parameter"` lifetime and an anchor such as `"arg0"`. The anchor must be an existing non-copied, non-transferred input.

C, C++, Rust, Python, Ruby, C#, Java, Kotlin, Perl, native PHP, PHP-Wasm, JavaScript/TypeScript and WIT/WASI builds also accept `"receiver": "method"` or `"receiver": "property"`, selecting
the first Lean runtime argument. It must be a declared resource or an owned
record or variant; a property takes no additional arguments. A receiver-bound
result uses `"scope": "receiver", "anchor": "receiver"`. Parameter anchors keep
their original runtime indices, so `"arg1"` names the argument after the
receiver. See [the receiver configuration](../publish/c.md#export-methods-and-properties)
and the [C++](../publish/cpp.md#export-methods-and-properties),
[Rust](../publish/cargo.md#export-methods-and-properties),
[Python](../publish/pypi.md#export-methods-and-properties),
[Ruby](../publish/rubygems.md#export-methods-and-properties),
[C#](../publish/nuget.md#export-methods-and-properties),
[Java/Kotlin](../publish/maven.md#export-methods-and-properties),
[Perl](../publish/cpan.md#export-methods-and-properties),
[native PHP and PHP-Wasm](../publish/php.md#export-methods-and-properties) and
[JavaScript/TypeScript member APIs](../publish/npm.md#export-methods-and-properties).
WIT/WASI exposes [typed functions with the receiver first](../publish/wit-wasi.md#export-methods-and-properties), preserving the member kind, owner and original parameter anchors.
C, C++, Rust, Python, Ruby, C#, Java, Kotlin, Perl, native PHP,
JavaScript/TypeScript and WIT/WASI accept
[callback-result anchors](../publish/c.md#anchor-a-callback-result-to-its-argument).
Configure them inside `callable.result`; argument names are local to that
callback, and the selected argument's original owner controls expiration.
Python's [publisher guide](../publish/pypi.md#anchor-a-callback-result-to-its-argument)
shows the nested contract and its checked `Value[T]` consumer argument.
Ruby uses the same contract with a checked `Value`; its
[publisher guide](../publish/rubygems.md#anchor-a-callback-result-to-its-argument)
also describes thread exit and host reply conversion.
C# uses a checked `Value<T>` argument and typed `CallbackResult<T>` host replies;
see the [NuGet guide](../publish/nuget.md#anchor-a-callback-result-to-its-argument).
WIT/WASI uses an original result-owner argument and validates the anchor on both
sides of the Component Model call; see the
[WIT publisher guide](../publish/wit-wasi.md#anchor-a-callback-result-to-an-argument).
PHP-Wasm callback-result anchors, `{ "constructor": "Library.checked" }` and additional effect labels still
require their [type-family implementation](../architecture/cross-language-authoring.md#stages).

Analysis and both builders bind contracts into the compiler request and source identity. Target compilation checks them again. Generated Binding IR records them under `lean-lang.org/export-contract` for inspection without adding proof claims. Public `analyze` uses the scalar profile; check native-only contracts with a build for their supported consumer target.

### Select modules in a custom source directory

For a locked project with a custom Lake `srcDir`, put the Lean module name in `modules`. For example, a library with `srcDir = "lean-src"` and `lean-src/Shop/Api.lean` selects `"Shop.Api"`, not `"lean-src.Shop.Api"`. Package and library source directories can be combined, and directory names may contain spaces or hyphens. Keep source files inside the captured project.

Planning locates a unique file ending in the selected module's path without evaluating Lake. Multiple matching files are an error. During compilation, Lake must resolve that name to the exact selected file; a different owner or path stops the build. Other root files remain captured, but only the selected modules and their actual import closure compile. The [custom-layout acceptance tests](../evidence/lake-root-layouts-20260911.md) cover npm and CPAN builds.

### Declare C link inputs

In a locked project, declare a C translation unit as a Lake `input_file` and reference it from the owning library's `moreLinkObjs`. For example, these entries in `lakefile.toml` associate `native/support.c` with `MyLibrary`:

```toml
[[input_file]]
name = "bridge_support"
path = "native/support.c"

[[lean_lib]]
name = "MyLibrary"
moreLinkObjs = ["bridge_support"]
```

Use your existing library entry rather than adding a second one with the same name. Keep the C file and its project headers inside the captured package. A library can also reference an input owned by a direct declared dependency. The Lake resolver reads the input declaration without executing a custom build target.

The builder compiles each selected C file once per native or WASM profile. It asks the selected compiler for every included file, checks captured source hashes, and records the compiler, header, and object identities. It rechecks those inputs after compilation and linking. System and Lean headers must belong to the selected toolchain or runtime.

C source files may be captured inputs or outputs of a [declared text generator](#generate-lean-and-c-sources). `.o` files, static archives, `extern_lib` targets, and extra compiler/linker flags remain unsupported. Selected Lean calls to `@[extern]` or `@[implemented_by]` functions still fail the implementation-contract check; declaring a C input does not approve a foreign implementation. The [C-input acceptance record](../evidence/lake-c-inputs-20260911.md) separates compilation evidence from foreign-call support.

### Generate Lean and C sources

For locked npm and CPAN builds, declare a pure Lean text generator in `lean-bridge.exports.json`. Keep the generator's modules and input files in the captured package. List each output explicitly, using package-relative `.lean`, `.c`, or `.h` paths that do not already exist in the captured source tree:

```json
{
  "schemaVersion": 1,
  "modules": ["MyLibrary"],
  "exports": ["MyLibrary.value"],
  "generators": [{
    "name": "table",
    "profile": "lean-text-v1",
    "module": "TableGenerator",
    "declaration": "TableGenerator.generate",
    "inputs": [{ "name": "value", "path": "data/value.txt" }],
    "arguments": [],
    "outputs": [{ "name": "lean", "path": "generated/Generated.lean" }]
  }]
}
```

Define `tools/TableGenerator.lean` with this function signature. The input array contains the declared names and UTF-8 file contents; the second array contains the literal arguments. Return one named text value for each declared output:

```lean
def TableGenerator.generate (inputs : Array (String × String))
    (_args : Array String) : Except String (Array (String × String)) := do
  let some (_, raw) := inputs[0]? | .error "missing value"
  let value := raw.trimAscii.toString
  .ok #[("lean", s!"def Generated.value : UInt32 := {value}\n")]
```

For this example, put `17` in `data/value.txt`. Associate the recipe with a Lake target and select it from the application library's `needs`. These entries in `lakefile.lean` use a separate tool library so the generator does not depend on its own output:

```lean
import Lake
open Lake DSL
package example

target table _pkg : Unit := do
  pure (Job.pure ())

lean_lib TableGenerator where
  srcDir := "tools"
lean_lib Generated where
  srcDir := "generated"
lean_lib MyLibrary where
  needs := #[.packageTarget .anonymous `table]
```

Lean Bridge invokes the checked `TableGenerator.generate` function, not the custom target's build body. The placeholder target above supplies its name; retain your normal generation body if you also use the target with `lake build`. This example uses a captured `MyLibrary.lean` to expose the generated value:

```lean
import Generated
namespace MyLibrary
def value : UInt32 := Generated.value
end MyLibrary
```

Create and review the project's `lake-manifest.json` during normal Lake development, then use the usual npm or CPAN build command. The builder selects the required recipes, runs them in private staging, re-resolves generated imports, and compiles the resulting application. Unused recipes do not execute. A dependency-owned recipe must belong to the current package or a direct declared dependency. Generated C files still need an `input_file` and a `moreLinkObjs` reference; merely listing a C output does not select it for linking.

Recipes cannot supply shell commands, environment overrides, prebuilt interfaces, or arbitrary compiler flags. Tools must have captured modules and pure checked implementations. Generated imports cannot introduce another generator after selection. The generated-source JSON handoff is limited to 64 MiB; each output is also limited to 8 MiB, and each generator to 16 MiB total output.

The build records output bytes, generator receipts, source origins, and compiler identities separately from the original snapshot. npm bundles and CPAN distributions retain `lake-generated-sources.json`. Consumers install and call compiled code without running the generator. See the [installed-package acceptance record](../evidence/lake-generated-packages-20260912.md).

### Generate the public entry module

The generator can produce the selected API module itself. Keep `modules: ["MyLibrary"]` and `exports: ["MyLibrary.value"]` in the configuration above, but change the recipe's output path to `generated/MyLibrary.lean`. Emit its public declaration directly:

```lean
def TableGenerator.generate (inputs : Array (String × String))
    (_args : Array String) : Except String (Array (String × String)) := do
  let some (_, raw) := inputs[0]? | .error "missing value"
  let value := raw.trimAscii.toString
  .ok #[("lean", s!"def MyLibrary.value : UInt32 := {value}\n")]
```

Keep the package, target, and tool library from the previous example. Replace its two application libraries with:

```lean
lean_lib MyLibrary where
  srcDir := "generated"
  needs := #[.packageTarget .anonymous `table]
```

Do not supply a captured `MyLibrary.lean` or `generated/MyLibrary.lean` alongside this recipe. The selected module must have one source candidate and one root-owned producer. Lake confirms that the generated path belongs to the selected library. Captured and generated entry modules can share one `modules` selection.

Run the usual npm or CPAN build command. Omit `exports` if every public function in the selected modules should be exported. npm's host planner records only the original capture and module intent. The engine generates source, compiles fresh interfaces, and asks Lean for the declarations and their types before creating adapters. Type aliases and inferred result types resolve through Lean. npm accepts primitives, concrete copied aliases, nested arrays and Lists, copied records and variants, Option, Except, nested binary products, [bounded recursive copied values](../javascript-typescript.md#recursive-values) and synchronous callbacks with primitive or copied payloads. Copied containers and callables can share one component. CPAN retains its native signature checks.

The npm bundle includes `metadata/lake-entry-exports.json`. Its compilation plan binds that record's hash and the generated-source handoff. The record includes compiler-resolved structural types, binders, documentation, source ranges and direct theorem references. Target compilation must reproduce it from fresh interfaces, including private/server sidecars, before linking. The original source snapshot remains unchanged. A supplied Binding IR cannot replace the generated API's compiler metadata. See the [generated-entry acceptance record](../evidence/lake-generated-entries-20260912.md) and [metadata contract](../architecture/elaborated-export-metadata.md).

### Choose an npm package name

Use [npm package settings](../publish/npm.md#choose-the-npm-name-and-version) to publish under a name or scope you own without renaming the Lean library. Omitted settings use the component's name and version. The build seals those choices with the source; changing them requires a new candidate.

### Configure native Perl exports

The [Perl target guide](../publish/cpan.md#build-an-ordinary-lean-project) contains a complete shared-configuration example. The native compiler checks freshly elaborated interfaces before generating XS. Public analysis accepts the npm copied-value shapes, synchronous primitive and structured callables and configured closure arities. Resources require a native build.

## Choose downstream languages

| Application language | Build and publish | Install and call |
| --- | --- | --- |
| JavaScript and TypeScript, including browsers, React, and workers | [npm](../publish/npm.md) | [JavaScript and TypeScript](../javascript-typescript.md) |
| Python | [PyPI](../publish/pypi.md) | [Python](../consume/python.md) |
| Rust | [Cargo](../publish/cargo.md) | [Rust](../consume/rust.md) |
| C | [C packages](../publish/c.md) | [C](../consume/c.md) |
| C++ | [C++ packages](../publish/cpp.md) | [C++](../consume/cpp.md) |
| C# / .NET | [NuGet](../publish/nuget.md) | [.NET](../consume/dotnet.md) |
| Java and Kotlin | [Maven](../publish/maven.md) | [Java](../consume/java.md), [Kotlin](../consume/kotlin.md) |
| Ruby | [RubyGems](../publish/rubygems.md) | [Ruby](../consume/ruby.md) |
| Perl | [CPAN](../publish/cpan.md) | [Perl](../consume/perl.md) |
| PHP, native and PHP-Wasm | [Composer and npm](../publish/php.md) | [PHP](../php.md) |
| WIT / WASI | [Component distribution](../publish/wit-wasi.md) | [WIT / WASI](../consume/wit-wasi.md) |

Use [signed Nix caches](../publish/nix.md) to distribute prepared packages and their dependency closures. Nix is a delivery channel, not another application language.

## Check proofs and package the library

Run the library's tests and [strict proof checks](proofs-and-assurance.md#check-the-theorem), then review and commit the source intended for the release. Keep proof checking separate from the analyzer's recorded theorem relationships.

Complete the [target-specific setup](setup.md) and follow [your target's build and publication guide](../publishing.md). Check the resulting package from a separate application using only its generated public API. A [local archive handoff](../publish/local-handoff.md) can test installation before any registry upload.

For multiple languages, check each target's accepted inputs and build path. A successful npm build does not produce a Python wheel or PHP extension. Give consumers the completed package, its version and platform requirements, and the matching [installation guide](../consume.md).
