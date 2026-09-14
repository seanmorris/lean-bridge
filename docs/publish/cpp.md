# Build and publish C++ packages

Prepare C++20 wrappers, C bindings, native libraries, and CMake metadata, then distribute the original archive through a release page or artifact server.

## Build an ordinary Lean project

Use the [ordinary C/C++ build](c.md#build-an-ordinary-lean-project) with `--target cpp`. Select `--target c --target cpp` to produce both archives from one native compilation. The author needs Node 22, Lean 4.32.2, C11 and C++20 compilers, and binutils on Linux x86-64; consumers need only their C++ toolchain and the prepared archive.

The generated namespace follows the source component. A project named `sample` produces `sample.hpp` and functions in `lean_bridge::sample`. Fixed-width integers use exact-width C++ types, `String` becomes `std::string`, and `ByteArray` becomes `std::vector<uint8_t>`. `Nat` and `Int` use exact little-endian `uint32_t` limb vectors; `Int` also carries a sign. Unit parameters use `std::monostate`, and Unit results return `void`.

C++ arrays use `std::vector<T>` and records use generated structs with owned fields. Both can nest. `Array Bool` uses `std::vector<bool>`; its packed storage is converted to the C API's individual Boolean values. Empty records use empty C++ structs. The [copied-value rules](c.md#copied-arrays-and-records) define the shared budget and nesting limit.

C++ results own their data. Scoped input views keep nested buffers alive through the call. Generated wrappers free intermediate C results on success and exceptions, including allocation failures partway through a nested result. Invalid UTF-8 or an exceeded copy budget raises the generated `Error` with the underlying status and code. C++ allocation failures propagate as `std::bad_alloc`. The [type conversion table](../consume/cpp.md#type-conversions) records installed coverage by position.

Set `targets.cpp.name` and `targets.cpp.version` in `lean-bridge.exports.json` to choose archive coordinates. The package includes the C API, native libraries, matching runtime, CMake and pkg-config metadata. C++ does not require a separately installed C package or Lean runtime.

## Build the reviewed Alpha example

### Check the build inputs

The Alpha example uses a reviewed universal bundle containing its compiled native component and target metadata. An ordinary Lake project alone does not provide those inputs. Follow [existing-library preparation](../lean/existing-package.md) and the [target overview](../publishing.md) before adapting another package.

### Build the target package

From a Lean Bridge checkout, [build the example bundle](../contributing/testing.md#build-the-example-artifacts-as-a-maintainer). With that bundle at `build/consumer-universal-bundle`, use a new output directory:

```sh
node scripts/build-c-family-package.mjs --ecosystem cpp \
  --bundle build/consumer-universal-bundle --output build/publish-cpp
```

The builder emits `lean-bridge-alpha-0.0.0-cpp.tar.gz`. The package identity and version come from the bundle; change them upstream before generating a public candidate. The tested native runtime is x86-64 Linux with glibc 2.38 or newer.

## Verify installation

Run the complete [C++ consumer example](../consume/cpp.md) against the produced archive. It installs or links the generated public API without compiling Lean. Keep the platform requirements and verification result with the package.

## Distribute and recover

Use [archive distribution](archives.md#freeze-the-handoff) for checksum records, GitHub Releases, HTTPS hosting, download verification, and interrupted-upload recovery. A universal `cpp` target retains an archive; it does not upload it. Your release owner chooses the destination and approves the exact bytes.

The archive supplies its documented host integration. It does not register a package with Conan, vcpkg, an OCI registry, or another unimplemented package manager. [Signed Nix caches](nix.md) provide an additional channel for declared flake outputs.
