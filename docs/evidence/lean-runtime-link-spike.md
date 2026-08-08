# Lean Runtime and Generated Side-Module Spike

Status: verified for the exact narrow scope below. Full `Init`/IO initialization, multiple Lean libraries, cross-library identity, and non-threaded browser packaging remain open.

Date: 2026-08-08 UTC.

## What was tested

The pinned Lean 4.32.2 sources were configured through their existing Emscripten CMake path with Emscripten 6.0.6. GMP, mimalloc, Lean multithreading, mmap, ccache, and nonessential installation targets were disabled for this first architecture probe.

The resulting `libleanrt.a` was linked only into an Emscripten `MAIN_MODULE=2`. A Lean-authored Alpha module was compiled by the pinned host Lean compiler to generated C, then linked without `libleanrt.a` as `alpha.so.wasm` with `SIDE_MODULE=2`. A small C shim registers Alpha's generated box/read functions into the main module. Both startup and lazy loading use the same side binary.

Alpha allocates a non-scalar Lean structure containing a `UInt32` and persistent `String`. The main bridge retains its raw object identity, reads it twice using explicit retain/consume balancing, then decrements the final reference and verifies its ownership counter returns to zero.

## Stock-source failure and admitted patch

The unmodified runtime build failed in two Emscripten stubs:

```text
event_loop.cpp: conflicting types for 'lean_uv_event_loop_alive'
system.cpp: conflicting types for 'lean_uv_os_get_group'
```

The header/generated ABI expects `uint8_t lean_uv_event_loop_alive()` and `lean_obj_res lean_uv_os_get_group(uint64_t gid)`. The Emscripten definitions used `lean_obj_res` and omitted `gid`, respectively. The minimal patch is SHA-256 `f867026310111fd4ec084eb88dd93afb03ad10959a6f33b91476870d18648190`. It is applied to a build copy keyed by the Lean commit and patch hash.

After the patch, all 34 runtime archive members compiled. The archive contains 1,123 defined-symbol records and has:

```text
size: 1,064,512 bytes
sha256: 278f91dae52a856fb8c51971de246797c3a94fae6ba68e8024e44eeacc145c05
```

The audit uses the pinned emsdk LLVM tools; Debian LLVM 14 cannot read Emscripten LLVM 24 LTO bitcode.

## Link and runtime result

Both behavioral tests pass:

- startup-linked Alpha allocates and releases a Lean object through the main runtime;
- lazy-loaded Alpha binds into the already-running main runtime and performs the same lifecycle.

Both structural tests pass:

- the Emscripten application imports exactly one shared memory into the main Wasm module;
- the main Wasm module defines/exports exactly one indirect function table;
- Alpha imports `env.memory` and `env.__indirect_function_table` and defines/exports neither;
- Alpha imports its Lean RC/allocation support and bridge registration symbols from `env`;
- the locked `MAIN_MODULE=2` export manifest makes every Alpha function import available from main;
- Alpha contains no Lean runtime archive.

Artifacts from this run:

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| startup main | 181,454 | `4cc5c9d40807f141ca69e604422c73b19b4912dda59db1453b730372e50fae7c` |
| lazy main | 181,396 | `45bb6e547883e5b1a1a65a13e15da682bc20a12ed99b9c1b261e03cf32e70d91` |
| Alpha side module | 1,105 | `9334a0cc1ec37c9e6c78ad199247fb898b4ed6b8e5d3d03f1aad3d03faa3ec87` |

## Architectural consequences

`MAIN_MODULE=1` is unsuitable as the default because it preserves the entire dynamic symbol universe and pulled runtime subsystems whose Lean `Init` implementations were not linked. `MAIN_MODULE=2` plus a generated symbol-export manifest derived from the canonical side-module graph works for the narrow slice and makes symbol compatibility explicit.

The pinned Lean Emscripten CMake path unconditionally adds `-pthread`, even though this probe sets `MULTI_THREAD=OFF`. Consequently, Emscripten imports one shared memory into main, side modules import that same memory, dynamic linking plus pthreads is marked experimental, and memory growth carries an Emscripten performance warning. This conflicts with the desired boring browser default and is now a high-priority patch/configuration investigation, not a hidden implementation detail.

The generated Alpha initializer references `initialize_Init`. This spike does not call it; main contains an explicit narrow stub solely for the module's unused initializer contract. Arbitrary generated modules and full runtime startup require a real Wasm build of Lean `Init` and remain unverified.

## Reproduction

```sh
npm run build:lean-runtime
npm run test:lean-link-spike
```
