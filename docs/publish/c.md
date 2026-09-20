# Build and publish C packages

Prepare C11 headers, native libraries, CMake and pkg-config metadata, then distribute the original archive through a release page or artifact server.

For ordinary-source builds, declare the library's [description, authors and URLs](../publishing.md#declare-package-metadata) once in `lean-bridge.exports.json`.

## Build an ordinary Lean project

Install Node 22, Lean 4.32.2, a C11 compiler, Make, m4, tar, xz, and `readelf` from binutils on Linux x86-64. Add a C++20 compiler if you also select `cpp`. Consumers need no Lean installation.

Use the [shared export configuration](../lean/existing-package.md#configure-exports) to select functions. The C/C++ adapters accept all 19 primitive types, arrays and acyclic records, including nested combinations. `Char` maps to a checked `uint32_t` code point in C and `char32_t` in C++. Concrete specializations use the same configuration. Both C and C++ accept synchronous primitive callbacks and returned closures. Resources and asynchronous signatures remain unsupported in these adapters; the build reports the rejected Lean declaration and location.

`Option`, `Except` and binary products also compile through both ordinary-source and reviewed-IR builds. They may contain supported primitives, arrays, records and each other, but not callbacks or resources. Other native targets and PHP-Wasm still reject these constructors. Select only C, C++ and/or npm for a combined compound-value release.

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

## Copied arrays and records

Arrays become typed spans with `data`, `length`, `owner` and `release` fields. Records become named C structs with their declared fields. Arrays can contain any admitted copied element, including strings, arbitrary integers, other arrays and records. Records can contain those same types. An empty Lean record has a zero-initialized placeholder byte in C.

Inputs borrow caller storage for the duration of the call. The adapter validates the complete input before calling Lean and ignores input ownership callbacks. Results own independent copies. In GMP packages, call the generated `<type>_init` for aggregate structs before their first use. This initializes every nested integer. Clear with `<type>_clear`; it releases storage and resets fields to initialized empty values. Successful calls replace initialized copied outputs. Packages without arbitrary integers retain zero-initialized structs and require clearing outputs before reuse. Repeated clear is safe. Never shallow-copy GMP values or owned results.

The 16 MiB per-call budget covers input and output payloads together, array slots and copied record storage. Array slots cost at least one native pointer each; output arrays also account for their ownership header. It is a conversion limit, not a limit on memory used by the Lean algorithm. Type nesting is limited to 32. Invalid input and conversion failures leave the caller's output slot unchanged; partially built outputs are released internally.

Compound structs use `has_value` plus `value` for options, `is_ok` plus `ok` and `error` for results, and `fst`/`snd` for products. Flags must be 0 or 1. Lean's `Except E T` maps to success type `T` and error type `E`. Only the active branch crosses into Lean; both fields must be initialized for cleanup. The conversion budget charges compound struct storage and the active payload. GMP packages also budget the public-to-private conversion. Returned inactive fields remain initialized and empty. `_clear` traverses both fields, including nested GMP integers. C++ maps these types to `std::optional`, tagged `Result` and `std::pair`; see the [consumer guide](../consume/cpp.md#options-results-and-products).

Lean generates the record constructors and field accessors used by the adapter. Consumers do not depend on Lean's object layout. See the [installed array and record acceptance](../evidence/native-c-copied-20260914.md) for nested structures, exact values and allocation-failure checks.

## Export callbacks and closures

For target `c`, ordinary source and reviewed contracts accept callbacks with one to sixteen primitive arguments and one primitive result. All nineteen primitives use the same C representation as copied values, including GMP `mpz_t` for `Nat`/`Int`, scalar-valued `Char`, and 64-bit `USize`/`ISize`.

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

These callable signatures do not admit arrays, records, nested callbacks, asynchronous delivery, or retained host functions. Copied arrays and records remain available outside callable signatures.

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
