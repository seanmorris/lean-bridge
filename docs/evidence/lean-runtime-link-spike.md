# Lean Runtime and Generated Side-Module Spike

Status: verified for the exact narrow scope below. Multiple Lean libraries, cross-library identity, and real browser/bundler packaging remain open; the browser-default memory profile itself is now non-threaded.

Date: 2026-08-08 UTC.

## What was tested

The pinned Lean 4.32.2 sources were configured through their existing Emscripten CMake path with Emscripten 6.0.6. GMP, mimalloc, Lean multithreading, mmap, ccache, and nonessential installation targets were disabled for this first architecture probe.

The resulting `libleanrt.a` and a wasm32/LTO build of Lean's complete `Init` closure were linked only into an Emscripten `MAIN_MODULE=2`. A Lean-authored Alpha module was compiled by the pinned host Lean compiler to generated C, then linked without either archive as `alpha.so.wasm` with `SIDE_MODULE=2`. A small C shim registers Alpha's generated box/read functions into the main module. Both startup and lazy loading use the same side binary.

Alpha allocates a non-scalar Lean structure containing a `UInt32` and persistent `String`. The main bridge retains its raw object identity, reads it twice using explicit retain/consume balancing, then decrements the final reference and verifies its ownership counter returns to zero.

## Stock-source failures and admitted patches

The unmodified runtime build failed in two Emscripten stubs:

```text
event_loop.cpp: conflicting types for 'lean_uv_event_loop_alive'
system.cpp: conflicting types for 'lean_uv_os_get_group'
```

The header/generated ABI expects `uint8_t lean_uv_event_loop_alive()` and `lean_obj_res lean_uv_os_get_group(uint64_t gid)`. The Emscripten definitions used `lean_obj_res` and omitted `gid`, respectively. The minimal signature patch is SHA-256 `f867026310111fd4ec084eb88dd93afb03ad10959a6f33b91476870d18648190`.

Lean's Emscripten CMake branch also placed `-pthread` in its common settings before consulting `MULTI_THREAD`, so `MULTI_THREAD=OFF` still emitted shared-memory artifacts. Patch `a4fe93f423c1de73cfd1d42aefd22010290a56f0927dc7ef071a382376611bc4` makes that flag conditional on the existing option. It introduces no new option or runtime branch. The ordered, path-independent patch set is SHA-256 `9dad2670a48daa972e5469673c5d6499785a8f186426c8d7b611ff40b9778bde`; build copies and artifacts are keyed by Lean commit, patch set, and `browser` or `threaded` profile.

After the patch, all 34 runtime archive members compiled. The archives contain
1,123 defined-symbol records. Their profile-specific evidence is:

```text
browser:  1,061,016 bytes, sha256 1f07813b37b2641d95840388c3ac5b6881838da1753cfa93121327d57b7e486e
threaded: 1,109,292 bytes, sha256 f981272e9b3f9ee9b420cbf6cbfad1486d840e116d87bbf0f1429ca58d1eb411
```

The audit uses the pinned emsdk LLVM tools; Debian LLVM 14 cannot read Emscripten LLVM 24 LTO bitcode.

## Real `Init`/IO closure

The pinned previous-stage Lean/Lake compiler builds only the `Init:static` facet through Lean's generated `stdlib.make`. That makefile exports `LEAN_CC=emcc`; invoking Lake directly was explicitly rejected after an audit showed that it silently produced x86-64 objects. The reproducible build supplies Wasm-exception, LTO, PIC, floating-point, and profile-matching thread flags. It extracts a representative LTO archive member, sends it through the pinned Emscripten target linker, and fails unless the result is a wasm32 object.

The resulting archives contain 601 members, including `initialize_Init` and
its runtime/meta initialization closures:

```text
browser:  22,621,510 bytes, sha256 9782f4ae402a8544e1223c5f36463fe36c0d658b54b15a082cb5fd1b4667dc64
threaded: 22,662,818 bytes, sha256 d8c18a6b6191b5260a6f4e4dc6686b4659b651ff382fc454cf25e9b042792738
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

The loader-facing tests also establish the intended native convention for this
POC. `await libraries.load(beta)` returns one frozen API object with `chain()`,
not Emscripten's dynamic-link handle. Concurrent calls share the same in-flight
operation and later calls return the same object. Only Beta and required Alpha
are loaded. The Lean Alpha descriptor returns a native `Box` class whose numeric
handle, underscore-prefixed ABI calls, runtime initialization, and release call
remain private; `new alpha.Box(42)`, `box.read()`, and `box.dispose()` are the
consumer surface. Runtime initialization is deferred until construction. The
descriptors are hand-authored POC stand-ins for the WP6-generated metadata and
bindings, not an accepted manual-wrapper architecture.

The structural and profile tests pass:

- direct Wasm section counting proves the browser main contains exactly one
  total memory, which it defines and exports as unshared and growable;
- direct section counting proves the threaded opt-in main contains exactly one
  total memory, which it imports as shared and growable;
- both main modules contain exactly one total indirect function table, which
  they define and export;
- Alpha imports `env.memory` and `env.__indirect_function_table` and defines/exports neither;
- Alpha imports its Lean RC/allocation support and bridge registration symbols from `env`;
- startup and lazy link maps in both profiles contain no `libleanrt.a` or
  `libInit.a` input and define exactly Alpha's `lean_link_alpha_box`,
  `lean_link_alpha_read`, and registration symbols—no private Lean runtime
  domain;
- the locked `MAIN_MODULE=2` export manifest makes every Alpha function import available from main;
- Alpha contains no Lean runtime or `Init` archive; and
- main has no unresolved `lean_*`, `initialize_*`, `runtime_initialize_*`, or `meta_initialize_*` function import;
- browser and threaded memory growth succeeds, after which Alpha still allocates, reads, and releases a Lean object; and
- threaded lazy loading binds the side module into the already-running shared memory and runtime.
- generated modules do not export `ccall`/`cwrap`; remaining `_bridge_*` probes
  are temporary internal lifecycle/profile instrumentation, while consumer
  assertions call the projected native functions and classes.

Artifacts from this run:

| Profile and artifact | Bytes | SHA-256 |
|---|---:|---|
| browser startup main | 1,289,819 | `9b08e7012ebb72beee18ef8318baea3ef3dd40427100077b0c211ec6df463688` |
| browser lazy main | 1,289,761 | `cfda66f2cb63c360ec7de947b84e86419cfd2b0a6651c5af6ad2d40ae565eeb4` |
| browser Alpha side module | 886 | `720bdc73fac8db0d1bb92ba47b551515c53aea97d7dc2201de4553a914de3af5` |
| threaded startup main | 1,325,357 | `86a437e22be501c5f29fa9345df4627b33e6d0a51d2a63339930943c3bc6709d` |
| threaded lazy main | 1,325,299 | `290fc30b07a3e24391a0b294584f2d2481b2b900af8fce6ad9289bc72f5da241` |
| threaded Alpha side module | 1,114 | `cc6a46f4d1415eae3099c77c6b055bbe98e5e11a6e1d458b350df2f6fbec0198` |

## Architectural consequences

`MAIN_MODULE=1` is unsuitable as the default because it preserves the entire dynamic symbol universe and pulled runtime subsystems whose Lean `Init` implementations were not linked. `MAIN_MODULE=2` plus a generated symbol-export manifest derived from the canonical side-module graph works for the narrow slice and makes symbol compatibility explicit.

The browser profile is now the default: `MULTI_THREAD=OFF`, no `-pthread`, one main-defined unshared memory, no SharedArrayBuffer requirement, and no dynamic-linking/pthreads or pthread/memory-growth warnings. Its startup main is 35,538 bytes smaller than the threaded equivalent in this narrow build. This removes cross-origin-isolation headers as a prerequisite for ordinary single-threaded browser consumption. Actual browser, worker, and bundler validation remains a later work package; this experiment ran under Node.

The explicit `threaded` profile sets `MULTI_THREAD=ON`, passes `-pthread` through the runtime, generated `Init`, side modules, and final link, and imports one shared memory. It retains Emscripten's warnings that dynamic linking with pthreads is experimental and that shared-memory growth may execute non-Wasm support code slowly. Browser deployments of this profile require SharedArrayBuffer availability and the corresponding cross-origin-isolation policy. Thread selection is therefore an application/runtime-profile decision, never a per-library choice; all libraries in one graph must use the same profile.

The real `Init` closure increases the current main artifact by approximately 1.14 MiB over the earlier narrow stub. That is paid once per application, not once per Lean library. Libraries that import `Std` or other roots will require their exact cross-compiled initialization closure in the main graph; this milestone proves `Init` and core `IO`, not every future standard-library profile.

## Reproduction

```sh
npm run build:lean-runtime
npm run test:lean-link-spike
npm run build:lean-link-spike:threaded
npm test
```
