# Build and publish Perl packages

Prepare a `LeanBridge::Runtime` distribution and one generated distribution per Lean component. Each component declares the runtime dependency and checks its exact native identity when loaded.

Set the library's description, authors and URLs in the shared [package metadata](../publishing.md#declare-package-metadata). CPAN emits them in `META.json` and retains them in the installation's `MYMETA` files. Without a declaration, the component uses `Author not declared` and no repository URL.

Component archives retain [source-library and dependency notices](../publishing.md#retain-library-and-dependency-licenses) separately from Lean Bridge's MIT license. Set [shared license terms](../publishing.md#declare-license-terms) in `package.license`. The component uses CPAN's exact license mapping when available and `unknown` otherwise, retaining the complete expression in `x_spdx_expression`. Installation preserves it in `MYMETA.json`.

## Build an ordinary Lean project

Use the native Perl row in [author setup](../lean/setup.md): Node 22, Lean 4.32.2, a C compiler, and the selected Perl interpreters. This path does not use the npm Wasm runtime. Add the shared `lean-bridge.exports.json` at the Lean project root:

```json
{
  "schemaVersion": 1,
  "modules": ["Workshop"],
  "resources": ["Workshop.Counter"],
  "arities": {
    "Workshop.makeAdder": 1,
    "Workshop.keepCallback": 1,
    "Workshop.newRunner": 1
  },
  "targets": {
    "cpan": {
      "module": "LeanBridge::Workshop",
      "version": "0.001"
    }
  }
}
```

This example names declarations from the Workshop acceptance project. Replace them with your own. `resources` selects heap-identity types instead of copied records. `arities` distinguishes a function returning a closure from a function taking more arguments. An optional `exports` array selects exact public declarations; otherwise public definitions in the selected modules are discovered and checked. Unsupported exports fail before packaging.

Module and export selection belong to the [shared author configuration](../lean/existing-package.md#configure-exports). Only the package name and CPAN version belong under `targets.cpan`.

Build on x86-64 Linux with glibc 2.38 or newer:

```sh
lean-bridge build --project /path/to/project --target cpan --output /path/to/new-release
```

`LEAN_BRIDGE_LEAN_PREFIX` can select the installed Lean 4.32.2 toolchain. Set `LEAN_BRIDGE_PERLS` to a JSON array of absolute interpreter paths to include several prebuilt ABIs. The build compiles the Lean component once and reuses it for every XS variant. With no override it uses `perl` from `PATH`.

The Nix entry point supplies the pinned upstream toolchain:

```sh
nix run .#perl-build-engine -- --project /path/to/project --output /path/to/new-release
```

The output contains `native/runtime`, `native/component`, prepared distributions under `packages`, and the two `.tar.gz` files and checksum receipts under `archives`. `native-release.json` records the component, runtime, Binding IR and archive identities. The native profile is `native-library-v1`; it does not alter the WebAssembly side-module ABI.

For APIs that also fit npm's primitive profile, [select npm and CPAN together](npm.md#build-npm-and-cpan-together). The combined build uses one captured source tree and exposes both package sets only after their source APIs agree. Its CPAN archives live under `profiles/native/archives/`. Keep a CPAN-only build for native records, arrays, resources and callbacks.

### Export a specialized closure

The native builder accepts the shared [finite specialization configuration](../lean/existing-package.md#export-concrete-specializations). For example, define a generic function in `Library.lean`:

```lean
universe u
def Library.makeAdder {α : Type u} [Add α] (base : α) : α → α :=
  fun value => base + value
```

Select its concrete type and give the resulting export an arity:

```json
{
  "schemaVersion": 1,
  "modules": ["Library"],
  "exports": ["Library.makeWordAdder"],
  "specializations": [
    { "name": "Library.makeWordAdder", "declaration": "Library.makeAdder", "types": ["UInt32"] }
  ],
  "arities": { "Library.makeWordAdder": 1 },
  "contracts": {
    "Library.makeWordAdder": {
      "parameters": [{ "ownership": "copy", "lifetime": null }],
      "result": { "ownership": "lease", "lifetime": { "scope": "explicit", "anchor": null } },
      "effects": []
    }
  },
  "targets": { "cpan": { "module": "LeanBridge::Library", "version": "0.001" } }
}
```

Lean resolves the `Add UInt32` instance. The arity belongs to the configured name, `Library.makeWordAdder`, and counts only runtime arguments. Here it preserves the returned closure after `base`. Build with the usual CPAN command, install both prepared distributions, then call:

```perl
use LeanBridge::Library;

my $add_seven = LeanBridge::Library::make_word_adder(7);
print $add_seven->call(35), "\n"; # 42
$add_seven->close;
```

The contract requires a copied argument and a returned closure lease. An export taking a resource or callback instead uses `"ownership": "borrow"` with `"lifetime": { "scope": "call", "anchor": null }`. Callback arguments also require `["host-call", "fails"]` when `effects` is declared; returning a Lean closure alone does not. Lean and package staging check these requirements against the implemented adapter. Declaring a transfer, retained host callback, anchored borrow or checked refinement constructor currently fails. See the [complete contract rules](../lean/existing-package.md#declare-export-contracts).

Specializations can also use named aliases for supported copied arrays, records, resources and callbacks. Existing ownership rules still apply: a resource inside a copied array or record requires an explicit ownership policy, and callbacks inside copied containers require a retention policy. Those shapes remain rejected. The metadata records the concrete application and its original declaration; native compilation reproduces that report after compiling the adapter and before linking.

### Compile a reviewed callable API

CPAN builds also accept a [reviewed Binding IR](../lean/existing-package.md#compile-a-reviewed-contract) containing synchronous primitive or acyclic copied-value callbacks and returned closures. Put export signatures, call-scoped callback borrows and explicit closure leases in that document. A returned closure's outer parameter count supplies the compiler arity. Keep `exports`, `arities` and `contracts` out of `lean-bridge.exports.json` when a review is present. The builder checks the review against fresh Lean metadata before emitting native code.

### Export structured callbacks

Add `Structured.lean`:

```lean
namespace Structured
structure Payload where
  text : String
  rows : Array (Option String)
  count : Nat
  nested : Option (Except String (UInt64 × Unit))

def callArray (value : Array (Option String))
    (transform : Array (Option String) → Array (Option String)) :=
  transform value

def makeRecord (value : Payload) (captured : Bool) (next : Payload) :=
  if captured then value else next
end Structured
```

Select the exports and keep `makeRecord` as a returned closure:

```json
{
  "schemaVersion": 1,
  "modules": ["Structured"],
  "exports": ["Structured.callArray", "Structured.makeRecord"],
  "arities": { "Structured.makeRecord": 1 },
  "targets": { "cpan": { "module": "LeanBridge::Structured" } }
}
```

Build with the ordinary CPAN command above. Install the runtime and component
archives, then run the [Perl example](../consume/perl.md#structured-callback-values).
The arity of one means `make_record($payload)` returns a closure whose `call`
method takes a Boolean and another payload. Captured and returned mutable
values own independent copies.

The same adapter supports acyclic arrays, Lists, options, results, binary
products, records, variants and copied aliases inside callback signatures.
Callbacks remain synchronous call-scoped borrows; returned Lean closures
remain explicit leases. Recursive callback payloads, retained host callbacks,
asynchronous delivery and resources hidden inside copied aggregates remain
unsupported. Both source paths have
[installed CPAN checks](../evidence/perl-structured-callables-20260925.md).

### Build with locked Lake dependencies

Keep the reviewed `lake-manifest.json` beside `lean-toolchain`. Supply each local path dependency at its recorded relative path and each Git checkout in the lock's package cache directory, normally `.lake/packages/<name>`. Git pins must contain the full commit hash. Install Git so the builder can verify the cached commit, tree, and file contents. The build does not fetch packages or update the lock.

For a project with a lock, the native builder captures the root project and every locked dependency, including inherited entries. It stages those inputs privately, evaluates the captured Lake configuration, and uses Lean's import parser to resolve module ownership and compilation order. It compiles imported dependency modules from source before extracting the selected public API from fresh interfaces. Existing `.lake` build caches do not supply compiled interfaces.

Both `lakefile.toml` and `lakefile.lean` work. Root and dependency libraries may use custom source directories; a Git subdirectory package can use sibling source files inside its captured checkout. Select actual Lean module names in the shared configuration, as described under [custom source directories](../lean/existing-package.md#select-modules-in-a-custom-source-directory). Dependency toolchains must match Lean 4.32.2.

This build path supports Lean dependencies and [declared C inputs](../lean/existing-package.md#declare-c-link-inputs). Each selected C file compiles once for `native-library-v1` and is reused across the package's XS variants. `native-component.json` records its compiler, include closure, and object hashes under `nativeCompilation`. See the [C-input acceptance record](../evidence/lake-c-inputs-20260911.md).

Locked builds also accept [declared `lean-text-v1` generators](../lean/existing-package.md#generate-lean-and-c-sources). The native builder runs selected pure tools and compiles their Lean/C/header outputs once before projecting XS variants. `native/component/lake-generated-sources.json` records their bytes and receipts, and the CPAN archive includes the same file. Installed Perl users do not run Lean, Lake, or the generator. See the [generated-package acceptance](../evidence/lake-generated-packages-20260912.md).

The [selected public module may itself be generated](../lean/existing-package.md#generate-the-public-entry-module). Declare its module name and exact root-owned output path, with no captured file at that path. The builder generates it, resolves its imports, and extracts the selected API from freshly compiled interfaces. Aliases and inferred result types resolve through Lean. `sourceIdentity.request.exportModules` records the public roots separately from the compiled dependency closure. See the [generated-entry acceptance](../evidence/lake-generated-entries-20260912.md).

Missing pins, changed Git inputs, ambiguous modules, package overrides, symlinks, undeclared custom targets, prebuilt native libraries, precompiled modules, and extra compiler/linker flags fail explicitly. Reviewed foreign-function contracts still need builder support.

`native/component/native-component.json` records the dependency snapshot and Lake resolution under `sourceIdentity.lakeDependencies`. Their hashes bind the locks, source files, compiler, resolver, and Lake library to the component model; `sourceIdentity.modules` records each freshly compiled interface hash. A dependency edit during compilation rejects the output. Review these identities when comparing relocated builds.

Lake configuration and Lean elaboration execute code. Private staging keeps normal builds out of the author tree; it is not an operating-system sandbox for hostile source. Use an isolated build environment for projects you do not trust.

## Export options, results and products

Add these definitions to `Compounds.lean`:

```lean
namespace Compounds
def classify (value : Option (Option Unit)) : UInt32 :=
  match value with
  | none => 0
  | some none => 1
  | some (some ()) => 2
def result_nat (value : Except Nat Nat) : Except Nat Nat :=
  match value with
  | .ok value => .error value
  | .error error => .ok error
def tuple_nat (value : Nat × Nat) : Nat × Nat :=
  (value.2, value.1)
end Compounds
```

Select `Compounds` in `modules` and its three functions in `exports`. Set `targets.cpan.module` to `LeanBridge::Compounds` and choose a decimal component version, then use the ordinary build command above. The [consumer example](../consume/perl.md#options-results-and-products) calls this API through the installed module.

Perl uses `undef` or `Some` for options, distinct `Ok` and `Err` wrappers for results, and two-element array references for binary products. Constructors appear under the component namespace when needed; record or resource names that collide with them are rejected before linking. All nineteen primitives work inside these copied types, including `Math::BigInt`, Unit, Unicode strings and octet strings. Fields and arrays may contain compounds.

Native input/output conversion shares a 16 MiB copied-value budget, with a maximum schema depth of 32 for acyclic schemas. [Recursive values](#export-recursive-values) use a bounded graph adapter. Compounds work in [callback arguments and results](#export-structured-callbacks). Resources and callbacks cannot be nested in copied values. Both ordinary source and compiler-checked reviewed contracts have [installed CPAN evidence](../evidence/perl-compounds-20260920.md).

## Export copied tagged variants

Select concrete, non-recursive Lean inductives through the ordinary export
configuration or a reviewed contract. Lean checks the source constructors and
payloads before generation. No Perl-specific variant configuration is required.

Each family becomes a Perl package with named constructor classes, such as
`Signal::Data`. Constructors take named fields, reject duplicate or mismatched
field sets, and expose payload accessors. The native adapter checks exact case
classes, rejects tied constructor hashes, and pins all fields before child
conversion can invoke Perl. Generated Lean helpers construct and inspect the
active payload without exposing runtime constructor numbers or object offsets.

Payloads can contain all nineteen primitives and supported copied containers,
records and other admitted variants. Constructors and payloads remain mutable;
the bridge copies their contents at each call. Generic, indexed,
proof-bearing, callable and identity-bearing payloads are not admitted by this
copied profile. Recursive families use the [recursive adapter](#export-recursive-values).
Names that collide with Perl object methods or phase hooks such
as `BEGIN` and `END` reject before compilation.

Use the [consumer example](../consume/perl.md#tagged-variants). The build compiles
Lean once for all selected Perl interpreters and produces a matching XS binary
for each ABI. Combined native variant builds can select CPAN, C, C++, Python,
Rust, .NET, JVM and Ruby when every selected target accepts the full API.
The [installed variant record](../evidence/perl-variants-20260921.md) covers both
source paths, all four pinned Perl ABIs and failure cleanup.

## Export arrays and records

Add `Parcels.lean`:

```lean
namespace Parcels
structure Parcel where
  label : String
  counts : Array Nat
def reverse (value : Parcel) : Parcel :=
  { value with counts := value.counts.reverse }
end Parcels
```

Select `Parcels` in `modules`, `Parcels.reverse` in `exports`, and set
`targets.cpan.module` to `LeanBridge::Parcels`. Build with the CPAN command above.
Leave `Parcel` out of `resources` to publish it as a copied record. The
[consumer example](../consume/perl.md#arrays-and-records) constructs a generated
`Parcel` containing a plain array reference of `Math::BigInt` values.

All nineteen primitives compose with copied arrays and records. Empty and
single-field structures keep their named classes; nested arrays and records
preserve field meaning and independent returned storage. Field names that would
replace Perl constructors, object methods or phase hooks fail before linking.
The copied-value budget is 16 MiB per call and schema nesting is limited to
32 levels. The [installed collection checks](../evidence/perl-collections-20260921.md)
cover both source paths and all four pinned Perl ABIs. Recursive copied types
use the [recursive adapter](#export-recursive-values). Resources hidden inside
copied fields require an ownership contract and remain unsupported.

## Export Lists

Add this definition to `Lists.lean`:

```lean
namespace Lists
def reverse_uint32 (values : List UInt32) : List UInt32 := values.reverse
end Lists
```

Select `Lists` in `modules`, `Lists.reverse_uint32` in `exports`, and set
`targets.cpan.module` to `LeanBridge::Lists`. Build with the ordinary CPAN command
above. No List-specific configuration is required. The [consumer example](../consume/perl.md#lists)
calls the installed package with a plain array reference.

Copied Lists work in parameters, results and record fields on both source paths.
They retain order, duplicates and nesting with all nineteen primitives, arrays,
options, results, products and acyclic records. Typed Lean helpers convert Lists
without inspecting cons-cell layouts. The [installed record](../evidence/perl-lists-20260921.md)
covers all four pinned Perl ABIs, independent output storage, malformed inputs,
copy limits, exceptions during conversion and recovery. Lists also work as
[callback arguments and results](#export-structured-callbacks). Copied resource
identities remain unsupported.

## Export named copied aliases

Add `Scores.lean`:

```lean
namespace Scores
abbrev Count := UInt32
abbrev Values := List Count
def increment_all (values : Values) : Values := values.map (· + 1)
end Scores
```

Select `Scores` in `modules`, `Scores.increment_all` in `exports`, and set
`targets.cpan.module` to `LeanBridge::Scores`. Build with the CPAN command
above. No alias-specific configuration is required. The
[consumer example](../consume/perl.md#named-copied-aliases) calls the installed
function with an array reference.

Concrete copied aliases retain their names, original targets and chains in
the package's `binding-manifest.json` and generated POD. Parameter, result
and record-field documentation preserves the original contract types. Perl
callers use target values, without new packages or wrapper classes. Target
ranges, exact integers, Unicode, branch presence, independent copies and
existing limits still apply.

An independently reviewed contract must retain the same aliases and references;
replacing every alias with its target does not reproduce the source API.
Copied alias targets also work in [callback signatures](#export-structured-callbacks).
Generic aliases and identity-bearing alias targets require further work. The
[installed acceptance record](../evidence/perl-aliases-20260921.md) covers both
source paths and all four pinned Perl ABIs.

## Export recursive values

Add `RecursiveDemo.lean`:

```lean
namespace RecursiveDemo
inductive Tree where
  | leaf (value : UInt32)
  | next (child : Tree)
def wrap (value : Tree) : Tree := .next value
end RecursiveDemo
```

Select the export in `lean-bridge.exports.json`:

```json
{
  "schemaVersion": 1,
  "modules": ["RecursiveDemo"],
  "exports": ["RecursiveDemo.wrap"],
  "targets": { "cpan": { "module": "LeanBridge::RecursiveDemo" } }
}
```

Use the ordinary CPAN build command above. The builder selects the recursive
adapter from the compiled type graph; it does not need a public C target or
Perl-specific type declarations. A reviewed contract can describe the same
finite graph with named references. Keep its declarations separate from the
shared configuration, as in [reviewed contracts](../lean/existing-package.md#compile-a-reviewed-contract).

The generated module provides `Tree::Leaf` and `Tree::Next` classes under
`LeanBridge::RecursiveDemo`. The [consumer example](../consume/perl.md#recursive-values)
constructs a leaf, calls `wrap`, and changes the independent returned copy.
Mutually recursive copied families, records, aliases and nested containers use
the same adapter. No runtime constructor numbers enter the public API.

Each call limits conversion to depth 128, 262,144 nodes and 16 MiB of native
copied data, with a separate 16 MiB conversion-storage allowance. Cycles,
malformed values and over-limit copies reject. These limits do not bound the
whole Perl heap or Lean's working memory. Recursive callback signatures and
resource-containing aggregates remain unsupported.

The [recursive acceptance record](../evidence/perl-recursive-packages-20260923.md)
records independent builds, source-free installations, failure cleanup and
execution of the exact author and consumer examples.

## Verify the release candidate

Before publication:

1. Build twice in independent directories and compare archive and native-library digests.
2. Run the installed consumer suite for threaded and nonthreaded Perl 5.36.3 and 5.38.2. Exercise `prebuilt-only`, `auto`, and `build-xs`.
3. Verify that prebuilt installation invokes no compiler and that fallback compiles XS only. Missing headers, corrupt artifacts and runtime mismatches must fail.
4. Run the warmed installed benchmark. Compare with direct C calls into the same Lean library; report conversion and callback costs separately from scalar calls.
5. Review generated POD, `META.json`, `MANIFEST`, native input inventories and the install receipts. Archive assembly must have no compiler access.

The repository's [Perl acceptance matrix](../contributing/testing.md#perl-packages) uses checksummed Perl source releases. The compatibility versions do not replace your organization's supported-Perl security policy.

For a local handoff, distribute both archives and `package-set-receipt.json` with its SHA-256 sidecar. That receipt checks local consistency; authenticate the publisher's bytes separately. No registry account or namespace reservation is needed to test installation. See [Perl consumption](../consume/perl.md).

## Shared runtime versions

The builder finishes every selected runtime XS variant before preparing components. It derives the runtime's version from the complete prepared payload: native libraries and headers, Perl modules, XS sources and binaries, build helper, platform floor, notices, metadata, and archive implementation. The packing identity also records Node/zlib/ICU versions, platform, architecture and default collation locale. Archive assembly requires that recorded environment and the fixed timestamp; consumer installation does not. Unchanged payloads in the same packing environment produce the same version and archive bytes. Changing a component's API, name, license or version does not change the shared runtime. See the [runtime packing audit](../evidence/runtime-packing-identities-20260916.md).

The generated runtime version uses `0.002`, a fixed-width decimal encoding of its SHA-256 identity, and a final `1`. Treat the whole value as a string and copy it from the package receipt. Do not shorten it, convert it to a floating-point number, or choose it manually. `lib/LeanBridge/Runtime.pm`, `META.json`, the payload manifest and the archive filename contain the same version.

Each component requires `== <runtime version>` in both the configure and runtime phases. `MYMETA.json` retains those exact requirements. Configuration, XS compilation and module loading reject a different installed runtime version; the native/binding identity checks remain in place. Libraries used together must select the same completed runtime package. Rebuilding only XS during installation does not change that package version. [CPAN version requirements](https://metacpan.org/pod/CPAN::Meta::Spec#Version-Ranges)

Runtime versions identify content, not release chronology. PAUSE's main index requires non-decreasing module versions, so a new payload can be absent from that index even after a successful upload. Publish the exact runtime archive's author path and checksum with each component release. Retain that archive, and test installation by its exact URL or local filename before the component. Clients can query historical versions, but a latest-only mirror is insufficient. [PAUSE indexing rules](https://pause.perl.org/pause/query?ACTION=pause_operating_model), [cpanm version selection](https://metacpan.org/pod/cpanm)

## Publish to CPAN

Create a [PAUSE account](https://pause.perl.org/pause/query?ACTION=request_id) and verify ownership or co-maintainer permission for **every public package namespace** in the distributions. Do not upload the example names as your own product. New namespaces acquire an owner on first upload; existing ones require permission. Review the [PAUSE operating model](https://pause.perl.org/pause/query?ACTION=pause_operating_model) before selecting names.

Upload the reviewed runtime archive first through PAUSE's **Upload a file to CPAN** form. Review its indexing report and confirm the exact archive is available, then upload the component archive. Reuse an already published runtime only after verifying its archive digest. Use the exact candidate bytes; do not run another build during upload. PAUSE distributes uploaded files to CPAN mirrors and checks indexing permissions. [PAUSE publication guide](https://pause.perl.org/pause/query?ACTION=pause_04about)

Choose a new component version for every component release. A decimal version such as `0.001` is a normal release; an underscore version such as `0.001_01` marks a developer release. The generated module, metadata and archive filename must agree on the component version. The shared runtime uses the content-derived version above. The generated metadata distinguishes testing from stable releases. [Perl version documentation](https://perldoc.perl.org/version)

This backend creates archives; `lean-bridge publish` does not currently upload to PAUSE. A CI upload job needs a separately approved PAUSE credential and destination. Keep credentials out of source files, build receipts and logs. No publication is performed by the build or consumer CI.

## Download and consume the published bytes

Download each archive from the exact author path reported by PAUSE. Compare its SHA-256 digest with the reviewed receipt, then install the runtime followed by the component in a clean local Perl library using `cpanm`. Confirm that the installed runtime satisfies the component's exact requirement and run the documented application.

If a CPAN client finds no compatible prebuilt XS, it may compile the supplied XS using the consumer's Perl development environment. It may not replace or rebuild the Lean runtime or component library. A failed hash or runtime check is a release problem, not a reason to bypass verification.

## Recover an interrupted publication

Check PAUSE's upload and indexing reports before retrying. Download an existing archive and compare it with the reviewed digest. If the bytes arrived but indexing failed, resolve namespace permissions with the responsible owner; rebuilding does not fix permission failures.

Do not replace different bytes under the same release version. Correct the source or metadata, choose a new version, rebuild, and repeat the installed checks. Keep runtime and component versions independent, preserve the original records, and verify that consumers resolve the intended runtime before announcing the release.

### Publish Perl packages to CPAN

The package-manager recipe above remains available at this address. Return to [target selection](../publishing.md) or [consumer installation](../consume.md).
