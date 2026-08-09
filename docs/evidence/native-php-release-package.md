# Native PHP Release Package Evidence

Status: one package manifest now produces the compiled Zend extension, one process-owned Lean runtime library, the generated Composer package, normalized generated C sources, binding reflection, assurance metadata, and release hashes. Two clean output roots are byte-identical. The same build entry point succeeds as the `php-native-package` flake output.

## Package input

`poc/lean-link-spike/bindings/php-native.package.json` is the complete build input contract for the Alpha package. It locks:

- the package and component identity;
- the Binding IR file hash and semantic hash;
- the Lean source path, hash, module, and initializer;
- x86-64 Linux, PHP NTS, and shared runtime ABI 1;
- every installed artifact path; and
- the source date epoch.

The JSON schema closes every object. The loader also rejects absolute paths, parent traversal, unknown fields, file hash drift, semantic hash drift, source hash drift, unsupported targets, and a package identity that does not match the component.

## Build graph

`scripts/build-php-native-package.mjs` performs one manifest-driven build:

1. validate the package manifest and its source identities;
2. generate the Composer package, Zend adapter, C transport, native component provider, and shared runtime broker from the Binding IR;
3. build the pinned PIC Lean runtime and matching `Init` archive;
4. compile the component's Lean source;
5. link the runtime once as `liblean_bridge_native.so`;
6. compile the generated Zend extension against that shared object;
7. strip debug data and replace temporary runtime paths with `$ORIGIN/..`;
8. install the Composer files, binaries, normalized generated build sources, and metadata; and
9. emit a release manifest and sorted SHA-256 inventory.

The build copies pinned Lean source into a writable isolated tree before CMake runs. Compiler prefix maps replace build and source paths. The linker omits build IDs, the final extension has a relative runtime search path, and the builder normalizes file timestamps.

## Installed layout

```text
lib/
  liblean_bridge_native.so
  php/lean_alpha.so
share/
  php/component/
    composer.json
    src/
    stubs/
    reflection.json
    assurance.json
    binding-manifest.json
  lean-bridge/
    package-input.json
    binding-ir.json
    zend-manifest.json
    native-runtime-manifest.json
    sources/
      runtime/
      extension/
    release-manifest.json
    sha256.txt
```

The extension names `liblean_bridge_native.so` in its ELF dependency table and finds it relative to the extension. The extension does not contain another Lean runtime.

## Consumer gate

`tests/php-native-package.test.mjs` loads PHP with no default configuration and only the packaged extension. Composer discovers the native transport. The test calls generated PHP classes and functions directly. It adds no wrapper layer.

The executed consumer verifies:

- extension and Binding IR version metadata through reflection;
- readonly typed copied values, byte sequences, and typed arrays without JSON;
- canonical resource identity;
- PHP callbacks invoked by Lean;
- a returned Lean closure used as an invokable PHP object;
- callback exception cause preservation and subsequent runtime use;
- deterministic close and the generated disposed-resource exception; and
- zero live identities after cleanup.

The test also starts PHP's development server and sends two sequential requests to the same process. Both requests report the same runtime instance, one runtime initialization, one component initialization, and zero live identities after request work closes.

## Reproducibility gate

The test builds the package into two separate temporary roots, enumerates every file, and compares every byte. The comparison covers 48 files, including both native binaries, the generated runtime, Zend, component-provider, and Lean C sources, Composer sources, stubs, documentation, reflection, assurance data, source identities, generator manifests, and release hashes.

The unified PHP release gate also executes the same semantic corpus through native Zend and both PHP-Wasm profiles. [The release gate evidence](php-release-gate.md) records the artifact coverage, manifest hashes, and semantic observation hash.

The local release fixture currently emits a 14,030,976 byte shared runtime and a 67,024 byte Zend extension. Compiler and system library differences can change those numbers across target profiles. Byte identity is required within one locked target profile.

`nix build .#php-native-package` runs the same builder with pinned Lean 4.32.2 source, PHP 8.2, Clang 17, libuv, OpenSSL, and build tools. The verified Nix output contains a 13,753,112 byte shared runtime and a 64,944 byte extension. Its release manifest records PHP module API 20220829, the Lean commit, runtime configuration hash, compiler version, libuv version, thread policy, and every payload hash.

## Current boundary

The package targets x86-64 Linux and non-thread-safe PHP. It depends on the target profile's system libraries. ZTS, AArch64, registry publication, signed provenance, and independent third-party rebuild attestations remain open release work.
