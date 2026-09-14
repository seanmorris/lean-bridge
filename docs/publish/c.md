# Build and publish C packages

Prepare C11 headers, native libraries, CMake and pkg-config metadata, then distribute the original archive through a release page or artifact server.

## Build an ordinary Lean project

Install Node 22, Lean 4.32.2, a C11 compiler, and `readelf` from binutils on Linux x86-64. Add a C++20 compiler if you also select `cpp`. Consumers need no Lean installation.

Use the [shared export configuration](../lean/existing-package.md#configure-exports) to select pure functions with copied parameters and results. The C/C++ adapters accept all 16 primitive types, arrays and acyclic records, including nested combinations. Concrete specializations use the same configuration. Resources, callbacks, effects and asynchronous signatures remain unsupported; the build reports the rejected Lean declaration and location.

For a Lake project named `sample` at version `1.0.0`, select both native targets:

```sh
lean-bridge build --project /path/to/sample \
  --target c --target cpp --output /path/to/new-native-release
```

Lean compiles once for both targets. The builder compiles one C adapter, checks the C++ header, then assembles the archives without recompiling Lean. A failed target leaves no partial release directory.

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

Add `--target cpan` to produce Perl archives from that same native compilation. For primitive-only APIs, add `--target npm` to also compile one Wasm component from the same captured source tree. npm does not yet accept arrays or records; selecting it for those signatures rejects the combined build without partial output. Combined builds check source API agreement across profiles and put the native archives under `profiles/native/archives/`. Install the [npm](npm.md#build-npm-and-cpan-together) and [CPAN](cpan.md#build-an-ordinary-lean-project) tools only when selecting those targets. C-only builds do not invoke Perl.

## Copied arrays and records

Arrays become typed spans with `data`, `length`, `owner` and `release` fields. Records become named C structs with their declared fields. Arrays can contain any admitted copied element, including strings, arbitrary integers, other arrays and records. Records can contain those same types. An empty Lean record has a zero-initialized placeholder byte in C.

Inputs borrow caller storage for the duration of the call. The adapter validates the complete input before calling Lean and ignores input ownership callbacks. Results own independent copies. Zero-initialize result structs and call the generated `<type>_clear` before reusing or discarding them. Clearing an array releases its nested elements; clearing a record releases its fields. Repeated clear is safe. Do not shallow-copy an owned result and clear both copies.

The 16 MiB per-call budget covers input and output payloads together, array slots and copied record storage. Array slots cost at least one native pointer each; output arrays also account for their ownership header. It is a conversion limit, not a limit on memory used by the Lean algorithm. Type nesting is limited to 32. Invalid input and conversion failures leave the caller's output slot unchanged; partially built outputs are released internally.

Lean generates the record constructors and field accessors used by the adapter. Consumers do not depend on Lean's object layout. See the [installed array and record acceptance](../evidence/native-c-copied-20260914.md) for nested structures, exact values and allocation-failure checks.

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
