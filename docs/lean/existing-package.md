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

An explicit reviewed Binding IR takes a separate analysis path: `analyze` validates the document without invoking Lean. Native, npm, PHP-Wasm and combined builds can [check a reviewed API against its source](#compile-a-reviewed-contract). Missing backends and compiler errors never fall back to source-scanned signatures.

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

Analysis and ordinary builds read the same selection and include the configuration in the source identity. `arities` selects the number of arguments an export receives before returning a callable value; npm and native builds support it. `resources` remains a native configuration decision. Target-specific package settings live under `targets`, using package target names such as `npm`, `pypi`, `cargo`, or `cpan`. A backend rejects a configured setting it does not implement; declaring a target does not select it for a build.

Ordinary npm builds send source and module selection to the engine without host-authored types or adapters. Lean resolves notation, type aliases, and inferred return types. Automatic discovery excludes private and protected declarations, type aliases, projections, and compiler-generated helpers. Explicitly selected unsupported declarations fail. The resulting bundle records `metadata/lake-entry-exports.json`; target compilation must reproduce that metadata before linking.

Native CPAN uses the same [compiler report](../architecture/elaborated-export-metadata.md) with its native type projection. Its prepared package includes `metadata.json` with documentation, source locations, resolved native types and theorem references. The native receipt binds that report to the compiled library. Public `analyze` checks the npm copied-value and synchronous primitive callable shapes; resources require the native projection.

The npm builder accepts shared module/export selection, `arities`, `specializations`, `contracts`, `generators`, `targets.npm.name`, and `targets.npm.version`. The CPAN projection also accepts `resources`, `arities`, `targets.cpan.module`, and `targets.cpan.version`. [Ordinary C/C++ builds](../publish/c.md#build-an-ordinary-lean-project) accept the shared configuration for pure copied primitive signatures and use `targets.c.name`/`version` and `targets.cpp.name`/`version`. C-only builds do not require CPAN settings or Perl tools. [PHP-Wasm](../publish/php.md#build-an-ordinary-php-wasm-package) separates `targets.php-wasm.npm.name`/`version` from `targets.php-wasm.composer.name`/`version`. Repeat `--target` to combine supported targets from one captured source tree, with one compilation per ABI. The [staged implementation](../architecture/cross-language-authoring.md) tracks the remaining type-family decisions. A reviewed Binding IR owns its export decisions; only `modules`, package metadata, generators and target settings can accompany it.

### Compile a reviewed contract

Keep exactly one schema-3 `.binding-ir.json` file in the source project. Select its source entry modules explicitly in `lean-bridge.exports.json`:

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

The review selects exact Lean declarations through `source.declaration` and `lean:<declaration>` IDs. Lake resolves the selected modules and their dependencies; a declaration's namespace does not determine its source module. Lean compiles fresh interfaces, and the builder compares the review with the resulting API before generating adapters. Component identity, declaration names, parameter and result types, nominal record identities, field order, ownership, effects and failure behavior must agree.

Native targets and PHP-Wasm accept reviewed pure copied primitives, arrays and immutable records. Native targets include C, C++, .NET, Java/Kotlin, Perl, native PHP, Python, Ruby, Rust and WIT/WASI. All targets support nineteen primitives, including `Char`, `USize` and `ISize`. Platform integers use the compiled target's width: 32 bits for npm/PHP-Wasm and 64 bits for native/WIT packages. Native and PHP-Wasm also support these primitives in copied arrays and record fields; npm, C, C++, Python, Rust, C#, Java, Kotlin, Ruby, Perl, native PHP and PHP-Wasm also support nested arrays, acyclic copied records, tagged Option/Except values and nested binary products. Documentation and argument names may differ from the compiler's defaults and are retained in the generated Binding IR. Host export names must match.

All seventeen consumer profiles also compile reviewed synchronous callbacks and returned Lean closures whose arguments and result use these nineteen primitives. The callback contract must specify repeated invocation (`many`), same-agent re-entry, deferred self-disposal, value delivery, and the native callback failure policy. Host callbacks are borrowed for the call; returned closures carry explicit leases. The review's outer parameter count determines the arity of an export returning a closure. Do not duplicate that decision in the configuration. The compiler checks both the outer export and the remaining callable signature before linking. See the installed checks for [npm](../evidence/npm-callables-20260919.md), [C++](../evidence/cpp-callables-20260919.md), [C](../evidence/c-callables-20260918.md), [Perl](../evidence/perl-callables-20260918.md), [Python](../evidence/python-callables-20260918.md), [Ruby](../evidence/ruby-callables-20260919.md) and [Rust](../evidence/rust-callables-20260919.md).

Reviewed builds still reject defaults, optional arguments, resources, callbacks inside copied containers, non-primitive callback arguments/results, retained host callbacks, asynchronous operations, producer or source extensions and supplied assurance claims. Do not combine a review with `exports`, `resources`, `arities`, `specializations` or `contracts` in the configuration.

Use the same source project for npm or PHP-Wasm, with the target coordinates from the [npm](../publish/npm.md) and [PHP](../publish/php.md) guides. For an API admitted by all three profiles:

```sh
lean-bridge build --project . --target npm --target php-native --target php-wasm \
  --output ./build/reviewed-multi-release
```

The builder compiles once per ABI, checks that each profile used the same reviewed input and source API, and creates the output directory only after every target succeeds. The combined API can use copied primitives, arrays, acyclic records or primitive callables. npm containers and callables require separate components. Options, results and products can target npm, C, C++, Python, Rust, C#, Java, Kotlin, Ruby, Perl, native PHP and PHP-Wasm; WIT/WASI does not yet admit them. The builder does not silently omit reviewed declarations. Source-configured closure arities still require separate target builds.

Native and PHP-Wasm models and compilation receipts retain the review's raw file, source hash and semantic hash alongside fresh compiler evidence. npm retains the review in its source-intent request and `metadata/lake-entry-exports.json`; target compilation must reproduce that report, and packaging repeats the source/contract checks. Package receipts bind these artifacts through their recorded hashes. A signature disagreement returns `reviewed-ir-source-mismatch`; an unsupported review decision returns `reviewed-ir-build-unsupported`. Unsupported source types retain the target's compiler diagnostics. None produces a release. Compiler-free `analyze` validates the document only; it does not establish source agreement.

### Describe the downstream packages

Add a shared `package` object for the library's description, authors, homepage and repository. Ordinary npm, native and PHP-Wasm builds all use it. The [package metadata guide](../publishing.md#declare-package-metadata) lists the fields and their mapping to each ecosystem. Keep target names and versions under `targets`; descriptive metadata does not select build targets or replace export decisions.

### Export concrete specializations

For npm, CPAN, C or C++, select concrete versions of a generic function without adding wrappers to the Lean library. Given this definition in `Library.lean`:

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

Each entry needs a new fully qualified `name`, an existing public `declaration` in the selected modules, and one to eight `types`. Types are closed Lean constant names, including aliases, in leading parameter order. Expressions such as `Array UInt32` are not configuration syntax; define a named Lean alias for a constructed type. Lean resolves universe levels and any instance binders immediately following that type prefix. Remaining arguments and results must fit the selected profile: [supported copied types for npm](export-decisions.md#start-with-the-runnable-npm-shapes), or the existing [native Perl types](../consume/perl.md#type-conversions) for CPAN. Native `resources` still identifies source types. Native `arities` uses the new specialization name and counts runtime arguments after type and instance arguments have been resolved.

The file accepts at most 128 specializations. Names cannot duplicate each other, shadow existing declarations, or refer to another specialization. When `exports` is present, include every configured specialization name. Without `exports`, discovery includes the concrete names and omits their unspecialized source functions; other public functions still need supported signatures.

Missing instances, unresolved types, dependent runtime inputs, effects and admitted implementations stop the build. Analysis loads Lean's built-in class and instance indexes without executing package initializers. The metadata retains the exact compiler application, original declaration, documentation and theorem references. Target compilation must reproduce that metadata before linking. Public `analyze` continues to use the scalar profile; use the CPAN build to check native-only signatures. Specialization emits separately named concrete functions, without generic host-language overload dispatch.

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

Each contract needs at least one of `parameters`, `result` or `effects`. Omitted decisions keep the adapter's existing rules. If supplied, `parameters` covers every runtime argument in order, after specialization and configured closure arity. The file accepts at most 128 contracts. When `exports` is present, every contract key must appear there; otherwise it must name an export discovered by Lean.

| Value at the boundary | Supported ownership and lifetime |
| --- | --- |
| npm primitive arguments and results | `"copy"`, `null` |
| CPAN primitive values, copied arrays and copied records | `"copy"`, `null` |
| CPAN resource argument; any supported callback argument | `"borrow"`, `{ "scope": "call", "anchor": null }` |
| CPAN resource result; any supported Lean closure result | `"lease"`, `{ "scope": "explicit", "anchor": null }` |

npm leases use `dispose()` or `Symbol.dispose`. Perl, Python and Ruby leases use the generated object's lifetime and `close` operation; Python supports `with` blocks; Ruby supports `with { |closure| ... }`. Rust uses thread-confined `LeanClosure` values with `Drop` and `close`; C uses explicit `_dispose` functions. A call-scoped borrow does not let Lean retain a host callback after the call. See the closure examples for [C](../publish/c.md#export-callbacks-and-closures), [CPAN](../publish/cpan.md#export-a-specialized-closure), [PyPI](../publish/pypi.md#export-callbacks-and-closures), [RubyGems](../publish/rubygems.md#export-callbacks-and-closures) and [Cargo](../consume/rust.md#callbacks-and-returned-lean-closures).

`effects` must match the adapter's boundary effects: `[]` for the current scalar and native APIs without callback arguments, or `["host-call", "fails"]` when an argument is a callback. Order does not matter. These labels describe the host-call protocol, not memory allocation inside Lean or a proof that arbitrary function bodies are pure. Returned `IO`, `EIO`, `Task` and other unsupported actions still fail signature checking.

`refinement: "reject"` keeps unsupported refined types rejected; it does not erase a `Fin` bound or a `Subtype` predicate. The schema also recognizes `{ "constructor": "Library.checked" }`, transferred ownership, anchored lifetimes and additional effect labels. Current adapters reject those choices. They require the [corresponding type-family implementation](../architecture/cross-language-authoring.md#stages), not a configuration override.

Analysis and both builders bind contracts into the compiler request and source identity. Target compilation checks them again. Generated Binding IR records them under `lean-lang.org/export-contract` for inspection without adding proof claims. Public `analyze` uses the scalar profile; native-only contracts must be checked with the CPAN build.

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

Run the usual npm or CPAN build command. Omit `exports` if every public function in the selected modules should be exported. npm's host planner records only the original capture and module intent. The engine generates source, compiles fresh interfaces, and asks Lean for the declarations and their types before creating adapters. Type aliases and inferred result types resolve through Lean. npm accepts primitives, nested arrays, acyclic copied records, Option, Except, nested binary products and synchronous primitive callables. Copied containers and callables cannot share one component yet. CPAN retains its native signature checks.

The npm bundle includes `metadata/lake-entry-exports.json`. Its compilation plan binds that record's hash and the generated-source handoff. The record includes compiler-resolved structural types, binders, documentation, source ranges and direct theorem references. Target compilation must reproduce it from fresh interfaces, including private/server sidecars, before linking. The original source snapshot remains unchanged. A supplied Binding IR cannot replace the generated API's compiler metadata. See the [generated-entry acceptance record](../evidence/lake-generated-entries-20260912.md) and [metadata contract](../architecture/elaborated-export-metadata.md).

### Choose an npm package name

Use [npm package settings](../publish/npm.md#choose-the-npm-name-and-version) to publish under a name or scope you own without renaming the Lean library. Omitted settings use the component's name and version. The build seals those choices with the source; changing them requires a new candidate.

### Configure native Perl exports

The [Perl target guide](../publish/cpan.md#build-an-ordinary-lean-project) contains a complete shared-configuration example. The native compiler checks freshly elaborated interfaces before generating XS. Public analysis accepts the npm copied-value shapes, synchronous primitive callables and configured closure arities. Resources require a native build.

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
