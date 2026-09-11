# Build and publish C++ packages

Prepare C++20 wrappers, C bindings, native libraries, and CMake metadata, then distribute the original archive through a release page or artifact server.

## Check the build inputs

The Alpha example uses a reviewed universal bundle containing its compiled native component and target metadata. An ordinary Lake project alone does not provide those inputs. Follow [existing-library preparation](../lean/existing-package.md) and the [target overview](../publishing.md) before adapting another package.

## Build the target package

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
