# C and C++ package evidence

## Result

The C package backend projects eligible canonical bundles into deterministic source or binary archives. Each archive carries generated headers, implementation source, runtime integration headers, pkg-config metadata, CMake package metadata, documentation, licenses, assurance records, provenance, and the selected canonical artifacts.

The backend does not run a C compiler, C++ compiler, Lean, Nix, Emscripten, CMake, pkg-config, or a linker. CMake, pkg-config, and the system C compiler run only after packaging as consumer validation.

The current Alpha bundle is not eligible for C publication because it contains no native component library. The C++ mapping also lacks a generated C++ projection. Both mappings fail before archive creation. Marking a C++ target eligible without adding generated C++ artifacts still returns `binding-artifacts-absent`.

## Eligible C source package

The successful fixture adds a reviewed `c-bindings` target to a copy of the canonical manifest. It keeps every artifact byte unchanged, selects all generated C files, declares an external shared-runtime adapter requirement, and updates the canonical identity.

The archive contains:

- `include/lean_alpha.h`, the direct public C API;
- `internal/lean_alpha_runtime.h`, the typed runtime adapter contract;
- `src/lean_alpha.c`, generated ownership and call wrappers;
- `lib/pkgconfig/lean-bridge-alpha.pc` with include paths, ABI version, and binding source location;
- `lib/cmake/LeanBridgeAlpha` package, version, and target files;
- generated documentation and the license;
- the canonical manifest, assurance records, SBOM, provenance, and core identity; and
- byte-identical copies of every artifact selected by the C mapping.

The CMake package exposes `LeanBridge::Alpha`. A source binding package attaches the generated C implementation as an interface source. A future canonical target containing a reviewed `.a`, `.so`, `.dylib`, `.dll`, or `.lib` artifact projects that binary into `lib` and exposes it as an imported target. Neither path rebuilds Lean.

## Reproducibility and tests

The archive writer sorts paths, fixes ownership and permissions, uses the canonical source date epoch, and writes fixed gzip metadata.

[`tests/c-family-package.test.mjs`](../../tests/c-family-package.test.mjs) verifies:

- the current C and C++ mappings fail with their recorded capability gaps;
- two empty output roots receive byte-identical C archives;
- the backend plan has no compiler, Lean, CMake, linker, or Emscripten command;
- pkg-config resolves the generated public and internal include paths;
- CMake finds `LeanBridgeAlpha`, compiles a clean consumer through `LeanBridge::Alpha`, and runs it;
- the archive carries generated sources, build-system discovery files, provenance, and assurance records;
- omitting one generated C file or its source runtime capability from the reviewed selection blocks packaging; and
- an eligible C++ target without generated C++ files remains blocked.

Run the focused gate:

```sh
node --test tests/c-family-package.test.mjs
```

The successful fixture proves deterministic C package layout and ordinary build-system discovery. It does not prove a C call into a native Lean component. C publication remains blocked until the canonical build includes the native component or runtime adapter. C++ publication additionally requires a generated C++ binding projection.
