# Build and publish C packages

Prepare C11 headers, native libraries, CMake and pkg-config metadata, then distribute the original archive through a release page or artifact server.

For ordinary-source builds, declare the library's [description, authors and URLs](../publishing.md#declare-package-metadata) once in `lean-bridge.exports.json`.

## Build an ordinary Lean project

Install Node 22, Lean 4.32.2, a C11 compiler, Make, m4, tar, xz, and `readelf` from binutils on Linux x86-64. Add a C++20 compiler if you also select `cpp`. Consumers need no Lean installation.

Use the [shared export configuration](../lean/existing-package.md#configure-exports) to select functions. The C/C++ adapters accept all 19 primitive types, arrays and acyclic records, including nested combinations. `Char` maps to a checked `uint32_t` code point in C and `char32_t` in C++. Concrete specializations use the same configuration. Both C and C++ accept synchronous primitive callbacks and returned closures. Resource-containing C values require the [explicit ownership policy](#resource-containing-c-values) below. Asynchronous signatures remain unsupported; the build reports the rejected Lean declaration and location.

`Option`, `Except`, binary products and `List` also compile through both ordinary-source and reviewed-IR builds. They may contain supported primitives, arrays, records and each other, but not callbacks or resources. All seventeen consumer profiles have installed acceptance for these copied constructors. Check each target's guide for its host representation and toolchain requirements before selecting a combined release.

For a Lake project named `sample` at version `1.0.0`, select both native targets:

```sh
lean-bridge build --project /path/to/sample \
  --target c --target cpp --output /path/to/new-native-release
```

Lean compiles once for both targets. The builder compiles the shared private C adapter and checks the C++ header. When the C API uses `Nat` or `Int`, it also builds the pinned GMP dependency and a public `mpz_t` adapter. It assembles both archives without recompiling Lean. A failed target leaves no partial release directory.

The default archives are `archives/sample-1.0.0-c.tar.gz` and `archives/sample-1.0.0-cpp.tar.gz`. Override their coordinates under `targets.c` and `targets.cpp`:

```json
{
  "schemaVersion": 1,
  "modules": ["Sample"],
  "exports": ["Sample.increment"],
  "targets": {
    "c": { "name": "sample-c", "version": "2.0.0" },
    "cpp": { "name": "sample-cpp", "version": "2.0.0" }
  }
}
```

Package names do not rename the API. The source component determines `sample.h`, the `sample_` C prefix, `sample.hpp`, and the C++ namespace `lean_bridge::sample`. `native-release.json` records every archive and its SHA-256. The archive's `lean-bridge-package.json` records the header, libraries, compiler evidence, runtime identity and installation metadata. These are local integrity records, not signed publication receipts.

Each archive includes its component library, C adapter and matching Lean runtime. Loading the C library initializes Lean automatically; pkg-config and CMake locate the libraries. The tested public profile is Linux x86-64 with glibc 2.38 or newer. The builder rejects binaries requiring a newer glibc version than the declared floor. Lean and Lean Bridge license notices accompany the binaries; supply your library's license with the release as well.

Add `--target cpan` to produce Perl archives from that same native compilation. Add `--target npm` to also compile one Wasm component from the same captured source tree when the API fits [npm's supported shapes](../lean/export-decisions.md#start-with-the-runnable-npm-shapes), including nested arrays and acyclic copied records. Selecting npm for unsupported signatures rejects the combined build without partial output. Combined builds check source API agreement across profiles and put the native archives under `profiles/native/archives/`. Install the [npm](npm.md#build-npm-and-cpan-together) and [CPAN](cpan.md#build-an-ordinary-lean-project) tools only when selecting those targets. C-only builds do not invoke Perl.

## Resource-containing C values

For target `c`, the ownership-aware transport accepts resources inside arrays,
Lists, options, results, products, records, variants, aliases and bounded recursive
values. Select the resource types and their aggregate ownership policy explicitly:

```json
{
  "schemaVersion": 1,
  "modules": ["Owned"],
  "resources": ["Owned.Ticket"],
  "exports": ["Owned.newTicket", "Owned.serial", "Owned.echoRecord"],
  "ownedAggregates": {
    "ownership": "lease",
    "disposal": "required",
    "fallback": "queued-finalizer",
    "cycles": "reject"
  },
  "targets": { "c": { "name": "owned-archive", "version": "1.2.3" } }
}
```

These names come from the repository's
[owned aggregate fixture](../../tests/fixtures/onboarding/owned-aggregates/Owned.lean).
Build the project with `--target c`, or add targets whose guides document
resource-containing values, including [C++](cpp.md#resource-containing-values).
A reviewed version-4 contract supplies the exports, resource
selection and policy instead; its configuration retains only module authorization,
package metadata and target coordinates. Lean checks the reviewed types and
ownership decisions against fresh compiler output before generating the package.

The archive includes a public C11 header, the component, shared Lean runtime, GMP,
license notices, corresponding GMP source, and relocatable CMake/pkg-config files.
Consumers need neither Lean nor the author project. The package manifest uses
`schemaVersion: 3` and records `ownedValues` plus the call-scoped callback
capability; its README describes the generated
session/result API. Package names do not change the source-derived API prefix.

By default, each call borrows inputs and returns a typed view with an explicit result owner.
Consumers release that owner, rather than walking fields or clearing nested GMP
views. Returned Lean closures can capture these values and have typed call and
retain operations. Synchronous host callbacks can receive and return these values;
the same build includes their signature-specific descriptors and runtime adapters.
The [callback fixture](../../tests/fixtures/onboarding/owned-host-callbacks/Owned.lean)
includes `Bundle → Bundle`, recursive `Tree → Tree`, `Unit → Ticket` and
`Ticket → Bundle` callbacks. Export the desired declarations normally. No separate
callback build flag is required.

Host callbacks borrow the enclosing call's lifetime. The generated header identifies
signatures that require a typed recovery value if the host fails. The compiler
derives other recovery values from arguments and constructors; it never fabricates
a resource. Owner-anchored borrowed results remain unfinished. See
[C ownership and cleanup](../consume/c.md#resource-containing-values) and
[callback lifetimes](../consume/c.md#callbacks-containing-resources).

### Transfer input ownership

For a C package, add an explicit contract when a function should consume its
input owner. For example, add this `contracts` entry to the configuration above:

```json
{
  "contracts": {
    "Owned.echoRecord": {
      "parameters": [
        {
          "ownership": "transfer",
          "lifetime": { "scope": "call", "anchor": null }
        }
      ]
    }
  }
}
```

Keep `resources` and `ownedAggregates`. The compiler preserves the transfer
decision in the Binding IR. A reviewed version-4 API can state the same decision
directly. Transfer applies to resource-containing inputs and returned Lean closure
inputs; copied scalar inputs still use `copy`. Both `call` and `explicit` input
lifetime scopes are accepted, with no anchor.

Build with `--target c`, or select a combination of C, C++, Cargo, PyPI, RubyGems
and NuGet.
Other targets reject these transfer contracts, including a combined release
that selects an unsupported target. A failed build
leaves no partial release. This does not extend a host callback's lifetime or
transfer the arguments that Lean passes into a host callback.

The public function takes an owner slot beside each transferred argument. It
validates every input before consuming all selected owners, clears their slots
before calling Lean, and keeps them consumed on later failure. See
[the consumer rules](../consume/c.md#transferred-inputs). These packages use
manifest version 4 and `ownedValues` version 3. Borrow-only packages retain
manifest version 3 and their existing signatures.

## Copied arrays and records

Arrays become typed spans with `data`, `length`, `owner` and `release` fields. Records become named C structs with their declared fields. Arrays can contain any admitted copied element, including strings, arbitrary integers, other arrays and records. Records can contain those same types. An empty Lean record has a zero-initialized placeholder byte in C.

For example, add `Parcels.lean` to a Lake project named `parcels`:

```lean
namespace Parcels
structure Parcel where
  label : String
  counts : Array Nat
def reverse (value : Parcel) : Parcel :=
  { value with counts := value.counts.reverse }
end Parcels
```

Select `Parcels` in `modules` and `Parcels.reverse` in `exports`. Build with
`--target c --target cpp`. The [C caller](../consume/c.md#arrays-and-records)
uses a generated struct containing a span of `mpz_t`; the
[C++ caller](../consume/cpp.md#arrays-and-records) uses a struct containing
`std::vector<Nat>`.

Record field names become snake_case. C/C++ keywords gain a trailing underscore:
a Lean field named `char` becomes `char_`. Collisions after normalization reject
the build. C++ records provide field-by-field value equality; floating-point
fields retain ordinary C++ equality.

Inputs borrow caller storage for the duration of the call. The adapter validates the complete input before calling Lean and ignores input ownership callbacks. Results own independent copies. In GMP packages, call the generated `<type>_init` for aggregate structs before their first use. This initializes every nested integer. Clear with `<type>_clear`; it releases storage and resets fields to initialized empty values. Successful calls replace initialized copied outputs. Packages without arbitrary integers retain zero-initialized structs and require clearing outputs before reuse. Repeated clear is safe. Never shallow-copy GMP values or owned results.

The 16 MiB per-call budget covers input and output payloads together, array slots and copied record storage. Array slots cost at least one native pointer each; output arrays also account for their ownership header. It is a conversion limit, not a limit on memory used by the Lean algorithm. Type nesting is limited to 32. Invalid input and conversion failures leave the caller's output slot unchanged; partially built outputs are released internally.

Compound structs use `has_value` plus `value` for options, `is_ok` plus `ok` and `error` for results, and `fst`/`snd` for products. Flags must be 0 or 1. Lean's `Except E T` maps to success type `T` and error type `E`. Only the active branch crosses into Lean; both fields must be initialized for cleanup. The conversion budget charges compound struct storage and the active payload. GMP packages also budget the public-to-private conversion. Returned inactive fields remain initialized and empty. `_clear` traverses both fields, including nested GMP integers. C++ maps these types to `std::optional`, tagged `Result` and `std::pair`; see the [consumer guide](../consume/cpp.md#options-results-and-products).

Lean generates the record constructors and field accessors used by the adapter. Consumers do not depend on Lean's object layout. The [installed collection checks](../evidence/native-collections-20260921.md) cover both source paths, all nineteen primitive elements and fields, seven records, 24 fixed Array levels and failure cleanup.

## Named copied aliases

Concrete `abbrev` and type-valued `def` aliases retain their names and targets in
the compiler-checked contract. C exports `<prefix>_<snake_name>_t` typedefs, with
`_init` and `_clear` helpers for aggregate targets. C++ exports source-named
`using` declarations. Aliases reuse the target's storage and conversion rules;
GMP integer aliases still require initialized owning values.

Aliases can name supported primitives, copied records and nested containers.
Chains retain their contract identities. Reviewed IR must match the compiler's
names and targets exactly. Alias cycles, excessive nesting and collisions with
public functions or generated types fail before packaging. Generic, recursive,
and identity-bearing alias targets remain outside the current native
profile. See the [installed alias checks](../evidence/native-aliases-20260921.md).

## Copied tagged variants

Concrete, non-recursive Lean inductives use named C constructor tags and unions
of named payload fields. Empty constructors remain distinct. Payloads may contain
supported copied primitives, records, containers and other variants. Both
ordinary-source and compiler-checked reviewed builds accept these types.

Each variant provides `_init`, `_select` and `_clear`. Selection releases the old
payload and initializes the new one; consumers do not assign constructor numbers
or initialize union fields by hand. GMP packages initialize nested `mpz_t`
members. Generated Lean helpers construct and inspect each case without exposing
compiler object tags or field offsets.

Only the selected case crosses the boundary. The 16 MiB copy budget includes
the variant struct and active payload; type nesting remains limited to 32.
Malformed tags and conversion failures leave the output slot unchanged, and
partial results are released. Generated type, tag and selector names must be
distinct. C/GMP also rejects names that collide with its private C transport.

Choose `--target c`; adding `--target cpp` builds the C++ representation from the
same captured API. C packages without arbitrary integers need no GMP dependency.
See the [consumer example](../consume/c.md#tagged-variants) and
[installed plain C/C-GMP evidence](../evidence/c-variants-20260921.md).

## Export callbacks and closures

For target `c`, ordinary source and reviewed contracts accept callbacks with one to sixteen copied arguments and one copied result. All nineteen primitives use the same C representation as copied values, including GMP `mpz_t` for `Nat`/`Int`, scalar-valued `Char`, and 64-bit `USize`/`ISize`. Arrays, Lists, options, results, nested products, acyclic records, variants and transparent aliases also work as payloads.

```lean
namespace Sample
def applyTwice (value : UInt32) (callback : UInt32 → UInt32) : UInt32 :=
  callback (callback value)
def makeChooser (captured : String) : Bool → String → String :=
  fun useCaptured value => if useCaptured then captured else value
end Sample
```

Select both exports and set `"arities": { "Sample.makeChooser": 1 }` in an ordinary-source configuration. This leaves the final two arguments on the returned closure. For a reviewed contract, the outer parameter count supplies that decision; do not also set `arities`. Build with `--target c`. A combined build selecting an unsupported callable target rejects the complete request.

Host functions are borrowed for the synchronous call. Lean must not retain them for later use. Returned Lean closures have explicit leases and generated `_call`/`_dispose` functions. The public header supplies signature-specific callback names. See [C callback ownership](../consume/c.md#callbacks-and-returned-closures) and the [installed acceptance checks](../evidence/c-callables-20260918.md).

For example, the callback in this export can inspect or replace an entire row:

```lean
def editRow (row : Array (Option String))
    (edit : Array (Option String) → Array (Option String)) :=
  edit row
```

The [structured C checks](../evidence/c-structured-callables-20260924.md) exercise
mixed payloads and owned returned closures through installed archives. All
seventeen consumer profiles accept acyclic copied callback payloads. Recursive
callback values currently work in C, C++ and npm packages. Nested callback
identities, resources, asynchronous delivery and retained host functions remain
unsupported by the C-family adapters.

## Export recursive callbacks

Add `Structured.lean` to a Lake project named `structured` at version `1.0.0`:

```lean
namespace Structured
inductive Tree where
  | leaf (value : Nat)
  | branch (children : Array Tree)

def callRecursive (value : Tree) (callback : Tree → Tree) := callback value
def makeRecursive (captured : Tree) : Bool → Tree → Tree :=
  fun selected value => if selected then captured else value
end Structured
```

Select the exports and the returned closure's outer arity:

```json
{
  "schemaVersion": 1,
  "modules": ["Structured"],
  "exports": ["Structured.callRecursive", "Structured.makeRecursive"],
  "arities": { "Structured.makeRecursive": 1 },
  "targets": {
    "c": { "name": "structured", "version": "1.0.0" },
    "cpp": { "name": "structured", "version": "1.0.0" }
  }
}
```

```sh
lean-bridge build --project /path/to/structured \
  --target c --target cpp --output /path/to/new-structured-release
```

For a reviewed contract, use its outer parameter counts instead of `exports` and
`arities`. Lean compiles once for both archives. Consumers use
[C structs and bounded copy helpers](../consume/c.md#recursive-callbacks) or
[C++ variants and owned containers](../consume/cpp.md#recursive-callbacks).
GMP and Boost dependencies are packaged and linked automatically.

Host callbacks borrow the synchronous call; they must not escape. Returned Lean
closures can retain copied trees. The runtime rejects malformed values, cycles,
expired callbacks and foreign-thread closure calls. Resource identities and
callback identities inside copied aggregates still need an ownership contract.

## GMP dependency and redistribution

C packages exposing `Nat` or `Int` supply GMP 6.3.0 automatically. Producers compile the pinned source archive offline, run its upstream test suite, and include `gmp.h`, `libgmp.so.10`, source hashes, build settings, complete corresponding source and license notices. CMake and pkg-config link the supplied shared library. Consumers do not install GMP separately.

Keep the archive's `share/lean-bridge/` contents when redistributing it. `gmp.json` identifies the source and configure flags, `sources/gmp-6.3.0.tar.xz` contains the unmodified source, and `licenses/GMP-*` contains the LGPL/GPL notices. Extract the source, configure a separate build directory with the recorded flags (choose your own prefix-map path), then run `make` and `make check` to rebuild it. The shared library remains replaceable. See [GMP's copying terms](https://gmplib.org/manual/Copying).

GMP uses its default allocator. Allocation failure inside GMP aborts the process; the bridge does not install global allocation hooks. The bridge reports failure of its own conversion allocations and leaves initialized outputs unchanged. See [GMP allocation behavior](https://gmplib.org/manual/Custom-Allocation).

## Build the reviewed Alpha example

### Check the build inputs

The Alpha example uses a reviewed universal bundle containing its compiled native component and target metadata. An ordinary Lake project alone does not provide those inputs. Follow [existing-library preparation](../lean/existing-package.md) and the [target overview](../publishing.md) before adapting another package.

### Build the target package

From a Lean Bridge checkout, [build the example bundle](../contributing/testing.md#build-the-example-artifacts-as-a-maintainer). With that bundle at `build/consumer-universal-bundle`, use a new output directory:

```sh
node scripts/build-c-family-package.mjs --ecosystem c \
  --bundle build/consumer-universal-bundle --output build/publish-c
```

The builder emits `lean-bridge-alpha-0.0.0-c.tar.gz`. The package identity and version come from the bundle; change them upstream before generating a public candidate. The tested native runtime is x86-64 Linux with glibc 2.38 or newer.

## Verify installation

Run the complete [C consumer example](../consume/c.md) against the produced archive. It installs or links the generated public API without compiling Lean. Keep the platform requirements and verification result with the package.

## Distribute and recover

Use [archive distribution](archives.md#freeze-the-handoff) for checksum records, GitHub Releases, HTTPS hosting, download verification, and interrupted-upload recovery. A universal `c` target retains an archive; it does not upload it. Your release owner chooses the destination and approves the exact bytes.

The archive supplies its documented host integration. It does not register a package with Conan, vcpkg, an OCI registry, or another unimplemented package manager. [Signed Nix caches](nix.md) provide an additional channel for declared flake outputs.
