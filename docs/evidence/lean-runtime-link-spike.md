# Lean Runtime and Generated Side-Module Spike

Status: verified for the exact narrow scope below. Multiple Lean libraries, cross-library identity, and non-threaded browser packaging remain open.

Date: 2026-08-08 UTC.

## What was tested

The pinned Lean 4.32.2 sources were configured through their existing Emscripten CMake path with Emscripten 6.0.6. GMP, mimalloc, Lean multithreading, mmap, ccache, and nonessential installation targets were disabled for this first architecture probe.

The resulting `libleanrt.a` and a wasm32/LTO build of Lean's complete `Init` closure were linked only into an Emscripten `MAIN_MODULE=2`. A Lean-authored Alpha module was compiled by the pinned host Lean compiler to generated C, then linked without either archive as `alpha.so.wasm` with `SIDE_MODULE=2`. A small C shim registers Alpha's generated box/read functions into the main module. Both startup and lazy loading use the same side binary.

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

## Real `Init`/IO closure

The pinned previous-stage Lean/Lake compiler builds only the `Init:static` facet through Lean's generated `stdlib.make`. That makefile exports `LEAN_CC=emcc`; invoking Lake directly was explicitly rejected after an audit showed that it silently produced x86-64 objects. The reproducible build now supplies the same pthread, Wasm-exception, LTO, PIC, and floating-point flags as the target runtime. It extracts a representative LTO archive member, sends it through the pinned Emscripten target linker, and fails unless the result is a wasm32 object.

The resulting archive contains 601 members, including `initialize_Init` and its runtime/meta initialization closures:

```text
size: 22,653,090 bytes
sha256: ee0e77c0e33d476cbf52365bae955723f57ef43a5cb00ed6bbf36111c9dc93da
```

Main performs the actual Lean startup sequence once: `lean_initialize_runtime_module()`, `initialize_Init(1)`, successful `IO` result consumption, then `lean_io_mark_end_initialization()`. The state machine is cold → initializing → ready, failed, or shut down. Repeated initialization while ready succeeds without rerunning either initializer. Shutdown refuses while a retained handle exists, calls Lean's runtime finalizers only after the ownership counter reaches zero, and is terminal because generated module guards are intentionally not reset.

A POC-only Wasm test hook constructs a typed Lean `IO.Error` result before `initialize_Init` to exercise containment. That instance moves to the terminal failed state, never allocates through Alpha, never retries initialization, and cannot be shut down as though it were healthy. This hook is raw test instrumentation and is not eligible for generated public bindings.

## Link and runtime result

The behavioral tests pass:

- startup-linked Alpha allocates and releases a Lean object through the main runtime;
- lazy-loaded Alpha binds into the already-running main runtime and performs the same lifecycle;
- repeated initialization runs the real runtime/`Init` sequence exactly once;
- shutdown is rejected with a live handle, succeeds after release, finalizes the runtime, and forbids reinitialization; and
- an injected `IO.Error` poisons only that application instance and prevents Lean calls.

Both structural tests pass:

- the Emscripten application imports exactly one shared memory into the main Wasm module;
- the main Wasm module defines/exports exactly one indirect function table;
- Alpha imports `env.memory` and `env.__indirect_function_table` and defines/exports neither;
- Alpha imports its Lean RC/allocation support and bridge registration symbols from `env`;
- the locked `MAIN_MODULE=2` export manifest makes every Alpha function import available from main;
- Alpha contains no Lean runtime or `Init` archive; and
- main has no unresolved `lean_*`, `initialize_*`, `runtime_initialize_*`, or `meta_initialize_*` function import.

Artifacts from this run:

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| startup main | 1,317,406 | `46c5aa41210f632082fa70e74b289953c3577ab9cfa46ddd0b3a966f3efeebe4` |
| lazy main | 1,317,348 | `fc47739c48894dfa08ad2e8b10b07c3562599d7bcf6dbe3ff4af512263c7f0a7` |
| Alpha side module | 1,105 | `9334a0cc1ec37c9e6c78ad199247fb898b4ed6b8e5d3d03f1aad3d03faa3ec87` |

## Architectural consequences

`MAIN_MODULE=1` is unsuitable as the default because it preserves the entire dynamic symbol universe and pulled runtime subsystems whose Lean `Init` implementations were not linked. `MAIN_MODULE=2` plus a generated symbol-export manifest derived from the canonical side-module graph works for the narrow slice and makes symbol compatibility explicit.

The pinned Lean Emscripten CMake path unconditionally adds `-pthread`, even though this probe sets `MULTI_THREAD=OFF`. Consequently, Emscripten imports one shared memory into main, side modules import that same memory, dynamic linking plus pthreads is marked experimental, and memory growth carries an Emscripten performance warning. This conflicts with the desired boring browser default and is now a high-priority patch/configuration investigation, not a hidden implementation detail.

The real `Init` closure increases the current main artifact by approximately 1.14 MiB over the earlier narrow stub. That is paid once per application, not once per Lean library. Libraries that import `Std` or other roots will require their exact cross-compiled initialization closure in the main graph; this milestone proves `Init` and core `IO`, not every future standard-library profile.

## Reproduction

```sh
npm run build:lean-runtime
npm run test:lean-link-spike
```
