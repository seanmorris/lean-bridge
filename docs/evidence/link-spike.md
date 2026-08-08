# Emscripten Main/Side Module Link Spike

Status: verified architecture evidence for a C-level linking mechanism; not yet evidence that the full Lean runtime or Lean-generated objects support the same profile.

Date: 2026-08-08 UTC.

Toolchain: Emscripten 6.0.6 from the pinned project-local emsdk. See [the toolchain inventory](toolchain-inventory.md).

## Question

Can independently compiled WebAssembly side modules initialize against one Emscripten main module, resolve symbols across modules, register callable function pointers in the main module's table, mutate shared application state, and load either at startup or recursively on demand?

## Experiment

`poc/link-spike/alpha.c` and `beta.c` are compiled independently with `SIDE_MODULE=2`. `main.c` is compiled with `MAIN_MODULE=2`. Alpha registers its entry point with main. Beta depends on main and calls Alpha indirectly through the main registry. Constructors provide observable initialization order and shared-state mutations.

The startup profile supplies both side modules to the final main link. The lazy profile starts with only main, then resolves Beta's descriptor recursively, loads Alpha before Beta, and deduplicates both modules by descriptor identity. This mirrors the PHP-Wasm name-to-asset and recursive dependency shape at a deliberately small scale.

## Result

Both Node tests pass. In both profiles, constructor mutations produce counter value `3030`; Alpha and Beta are visible from the main registry; Beta calls Alpha successfully; and subsequent calls mutate the same main-owned counter. Loading Beta a second time leaves the loader at two modules and does not rerun constructors.

Every emitted module passes `wasm-tools validate`. `wasm-objdump` records show the main module defining and exporting one memory and one indirect function table. Side modules carry `dylink.0` metadata and unresolved main-module functions; their registered entry points are resolved into the application's dynamic-linking domain.

## Reproduction

```sh
npm run test:link-spike
```

Generated binaries, object dumps, and SHA-256 files are intentionally ignored under `build/link-spike/`; the build script regenerates them from pinned inputs.

## What this does not prove

- The side modules contain C probes, not Lean-generated code.
- No Lean object has crossed a library boundary yet.
- The Lean reference-counting heap and runtime initialization have not yet been exercised.
- The experiment does not validate static-profile parity, browser bundlers, lifecycle registries, callbacks, or 50-library scaling.
- Emscripten's dynamic-linking implementation and generated JavaScript loader remain trusted boundaries.

The next falsification step is to build the pinned Lean runtime for Emscripten, place it only in the main module, compile runtime-free Lean library objects as side modules, and repeat the structural and behavioral checks.
