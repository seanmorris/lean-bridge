# Ordinary Lean compilation for PHP-Wasm

VO1216 now compiles pure copied APIs from ordinary Lean sources into PHP-Wasm Zend extensions. The compiler emits a separate `php-wasm-copied-v1` model and receipt with 32-bit pointers. It uses Emscripten 3.1.68 and PHP 8.4.1 headers, matching PHP-Wasm 0.1.0.

## Compilation

`buildPhpWasmCopiedComponent` uses the same source capture, fresh elaboration and drift checks as native compilation. Lean emits a C function for every selected declaration and per-type constructors and projections for copied records. The target C compiler compares the generated prototypes against Lean's actual definitions. Static assertions check the pointer width, PHP integer width and PHP header version.

The metadata request still selects `native-library-v1` to obtain Lean's C-shape representation. That source-admission label does not identify a compiled binary. `createPhpWasmCopiedModel` constructs the 32-bit model from fresh metadata; no native ELF receipt or npm Wasm artifact enters this build.

The generated Zend extension contains the compiled Lean code, copied C adapter and PHP boundary. Only `get_module` and Emscripten loader/call helpers are exported. Lean declarations remain private, so separate packages can reuse module names without symbol interposition.

`buildPhpWasmCopiedRuntime` links the PHP-Wasm-specific Lean archives with the shared initialization broker and unsupported-filesystem shim. Its receipt binds the target archives, Lean headers, compiler files and resulting binary. Every component imports the PHP host's memory and function table and records the runtime identity it requires.

The artifact reader checks a closed file inventory, reconstructs the model, regenerates the Lean and Zend adapters, and checks the receipt against their identities. It rejects altered files, an unexpected runtime and native-width models.

## Executed acceptance

With the target archives and pinned SDKs prepared as described in [testing](../contributing/testing.md):

```sh
LEAN_BRIDGE_PHP_WASM_ORDINARY_TEST=1 \
  node --test --test-reporter=spec tests/php-wasm-ordinary.test.mjs
```

Willow and Aspen are independently compiled ordinary projects. Both use `SharedApi` as their Lean module and namespace, with different implementations, reversed record field orders, and different one-field record representations. Each exposes 44 functions covering all 16 copied primitives, arrays of each primitive, nested records and arrays, empty records, nullary functions and multiple arguments.

The suite compares builds from different source, output and runtime-header paths, checks that author sources remain unchanged, and copies the completed artifacts to a new location. Compiler prefix maps remove absolute build and runtime-header paths from the extensions. Original source and build paths become unavailable. A fresh Node process runs PHP-Wasm with no compiler commands on `PATH`.

PHP checks include 4,097-bit integers, 16,384-digit decimals, signed and unsigned extrema, exact low-word conversion, UTF-8 with NUL, arbitrary bytes, NaN, infinities, signed zero and Float32 rounding. Weak-mode callers still receive type and range errors. Oversized copied output fails, followed by successful record and scalar calls.

Twenty further PHP requests return the distinct answers from both components. A separate test-only Zend extension reads the production runtime broker and checks one runtime initialization, two component initializations, two attached components and zero live identities. The generated public APIs expose no runtime-inspection functions.

| Artifact | SHA-256 |
| --- | --- |
| Willow extension | `15ebe3e15d348ea04fec87293fd79fa83edf4853f94f4b866234640b12d4936b` |
| Aspen extension | `622e3c1b4bc959570dd92e64fe785bf47ef1497adf822be3a73282e032888ca9` |
| Shared runtime receipt | `cf6fd0c4430e142677d32ae69d2f0585c667c1fcabb4b26a43c4d68789b48c5c` |

Native regression checks pass through the extracted source pipeline. The Clover and Juniper Composer ZIP hashes remain unchanged from [native PHP acceptance](native-php-copied-20260915.md). Perl acceptance checks prebuilt and XS-only installation, resource and callback behavior, forged metadata, source/interface drift, cancellation and C-prototype disagreement.

## Remaining work

This milestone tests compiled artifacts loaded at PHP startup. It does not add ordinary PHP-Wasm to the public build CLI, create npm or Composer archives, or implement lazy loading. It rejects Lake native C inputs, resources, callbacks and other non-copied signatures. The existing Alpha package and native PHP paths remain separate.

The [following package milestone](php-wasm-packages-20260915.md) adds automatic shared-runtime loading, closed release receipts and installed npm/Composer startup acceptance. Public CLI integration and lazy loading remain open. Installed-tested coverage remains 656 cells; VO1216 remains open.
