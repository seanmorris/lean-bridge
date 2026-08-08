# Lean Runtime and Generated Side-Module Spike

Status: verified for the exact narrow scope below. Three Lean libraries, cross-library identity, startup/lazy/final-static composition, and both memory profiles pass. JavaScript callbacks/re-entry and real browser/bundler packaging remain open.

Date: 2026-08-08 UTC.

## What was tested

The pinned Lean 4.32.2 sources were configured through their existing Emscripten CMake path with Emscripten 6.0.6. GMP, mimalloc, Lean multithreading, mmap, ccache, and nonessential installation targets were disabled for this first architecture probe.

The resulting `libleanrt.a` and a wasm32/LTO build of Lean's complete `Init` closure were linked only into an Emscripten `MAIN_MODULE=2`. Lean-authored Alpha, Beta, and Gamma modules were compiled independently by the pinned host Lean compiler to generated C, then linked without either archive as `SIDE_MODULE=2` artifacts. Beta and Gamma compile against Alpha's `.olean`, so all three use the same nominal `Box` type rather than relying on compatible layouts. Small C shims register each module's generated entry points into the main-owned registry. A tracked graph lock content-addresses all six Lean/shim inputs, pins their dependency order and runtime/patch identities, and drives both modes. Startup and lazy loading use the same three side binaries; final-static links the same locked generated sources into one non-dynamic application.

Alpha allocates a non-scalar Lean structure containing a `UInt32` and persistent `String`. Alpha, Beta, and Gamma each read that same object through independently generated code. The main bridge then passes one retained reference through Beta's and Gamma's identity functions, checks that the returned pointer is unchanged, balances every consume/retain, and verifies the ownership counter returns to zero.

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
browser:  1,061,060 bytes, sha256 1df56cc60fe8d17ece7541dc733d3cb2649315495e58bf88603f4b9b01020176
threaded: 1,109,340 bytes, sha256 d169ac24e70d6b993b9e79f80047b7b32db6e69821d2340ee77b2e1a640bcdde
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

Main performs the actual Lean startup sequence once: `lean_initialize_runtime_module()`, `initialize_Init(1)`, registered library initializers, successful `IO` result consumption, then `lean_io_mark_end_initialization()`. The state machine is cold → initializing → ready, failed, or shut down. Alpha's real initializer runs through this one registry. Beta and Gamma explicitly declare no initializer because their POC identity/read definitions have no initialization work; retaining their generated dependency initializers exposed an unresolved side-to-side `initialize_Alpha` limitation in Emscripten's startup link. A production graph initializer must order and resolve nontrivial transitive initializers rather than enabling undefined-symbol stubs. Repeated initialization while ready succeeds without rerunning either initializer. Shutdown refuses while a retained handle exists, calls Lean's runtime finalizers only after the ownership counter reaches zero, and is terminal because generated module guards are intentionally not reset.

A POC-only Wasm test hook constructs a typed Lean `IO.Error` result before `initialize_Init` to exercise containment. That instance moves to the terminal failed state, never allocates through Alpha, never retries initialization, and cannot be shut down as though it were healthy. This hook is raw test instrumentation and is not eligible for generated public bindings.

## Link and runtime result

The behavioral tests pass:

- startup-linked Alpha/Beta/Gamma read and preserve one Lean object through the main runtime;
- requesting lazy Gamma recursively loads Beta then Alpha exactly once before performing the same cross-library lifecycle;
- final-static composition preserves the same value, identity, initialization count, and ownership baseline;
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
- Alpha, Beta, and Gamma each import `env.memory` and `env.__indirect_function_table` and define/export neither;
- every side module imports its Lean RC/allocation support and bridge registration symbols from `env`;
- startup and lazy link maps in both profiles contain no `libleanrt.a` or
  `libInit.a` input and define exactly that library's declared `lean_link_*`
  functions—no private Lean runtime domain;
- the locked `MAIN_MODULE=2` export manifest makes every side-module function import available from main;
- no side module contains a Lean runtime or `Init` archive;
- main has no unresolved `lean_*`, `initialize_*`, `runtime_initialize_*`, or `meta_initialize_*` function import;
- final-static contains exactly one memory, table, `initialize_Init`, representative runtime symbols, registry symbol set, and copy of every Alpha/Beta/Gamma definition;
- browser and threaded memory growth succeeds, after which Alpha still allocates, reads, and releases a Lean object; and
- threaded lazy loading binds the side modules into the already-running shared memory and runtime; and
- generated modules do not export `ccall`/`cwrap`; remaining `_bridge_*` probes
  are temporary internal lifecycle/profile instrumentation, while consumer
  assertions call the projected native functions and classes.

Artifacts from this run:

| Profile and artifact | Bytes | SHA-256 |
|---|---:|---|
| browser startup main | 1,289,844 | `20545285cf10b6690213f8cb34460e667098c8ac1e9a90b1926427fcf6c839d2` |
| browser lazy main | 1,289,759 | `ad6b73edca8493cbaedff3f854a6513253f92f8f0dfe44be4b1d6f9740fbe5b6` |
| browser final-static main | 1,288,402 | `6590d3ae0db82f76738d28e11459317107b0c5d22febb3f6d35ce04af492784a` |
| browser Alpha side module | 1,135 | `6825fc4b0411315d6fe4338e25124054c96e4e8c531ce8df0c497942ea67441a` |
| browser Beta side module | 713 | `7f36961d6ee36765e5ff926a94f6a41375fd151e5fb61f28ebc46c0c1c2af252` |
| browser Gamma side module | 714 | `8dd69c40e3373355ff3779b9e5844b0dd1924af052013710ea6cfd4a87bc089a` |
| threaded startup main | 1,323,826 | `f04eb6bd5bf67f0c640794fd05799665b834cfab93732d73f869eb1ecece4f6b` |
| threaded lazy main | 1,323,741 | `4c77cb594467f7d722d680f072c1d983c2b44f2aea2db2b76d7303cfc638cd34` |
| threaded final-static main | 1,316,000 | `ca7decb961454bded809a3ddd1a39ff2bf029249925ba45272f04e13da3a7396` |
| threaded Alpha side module | 1,356 | `00e2291d30e84b1f0f85bbc5d56345d8f419158370c66580e1310530c6656e4a` |
| threaded Beta side module | 941 | `d0efd8912bdcf9387857d31e645fa2a0ae5bc1031f2f1f894579d859a3ee9405` |
| threaded Gamma side module | 942 | `19cb369ff0b7c07968e7c90fa9c9849903d0215abd418cf0d7a296ef2cdca982` |

## Architectural consequences

`MAIN_MODULE=1` is unsuitable as the default because it preserves the entire dynamic symbol universe and pulled runtime subsystems whose Lean `Init` implementations were not linked. `MAIN_MODULE=2` plus a generated symbol-export manifest derived from the canonical side-module graph works for the narrow slice and makes symbol compatibility explicit.

The browser profile is now the default: `MULTI_THREAD=OFF`, no `-pthread`, one main-defined unshared memory, no SharedArrayBuffer requirement, and no dynamic-linking/pthreads or pthread/memory-growth warnings. Its startup main is 33,982 bytes smaller than the threaded equivalent in this narrow build. This removes cross-origin-isolation headers as a prerequisite for ordinary single-threaded browser consumption. Actual browser, worker, and bundler validation remains a later work package; this experiment ran under Node.

The explicit `threaded` profile sets `MULTI_THREAD=ON`, passes `-pthread` through the runtime, generated `Init`, side modules, and final link, and imports one shared memory. It retains Emscripten's warnings that dynamic linking with pthreads is experimental and that shared-memory growth may execute non-Wasm support code slowly. Browser deployments of this profile require SharedArrayBuffer availability and the corresponding cross-origin-isolation policy. Thread selection is therefore an application/runtime-profile decision, never a per-library choice; all libraries in one graph must use the same profile.

The real `Init` closure increases the current main artifact by approximately 1.14 MiB over the earlier narrow stub. That is paid once per application, not once per Lean library. Libraries that import `Std` or other roots will require their exact cross-compiled initialization closure in the main graph; this milestone proves `Init` and core `IO`, not every future standard-library profile.

For this three-library slice, browser final-static is 4,004 bytes smaller than the startup dynamic main plus its three side modules; threaded final-static is 11,065 bytes smaller. This is evidence for a packaging choice, not a general performance conclusion. Both modes expose the same native Alpha `Box` surface and satisfy the same cross-library identity test.

Compiler prefix maps now normalize the source root to `/workspace`, and static
capsule objects compile from relative source paths. A clean browser rebuild in
an independent `/tmp/lean-wasm-repro.*` checkout produced byte-identical output
for all 23 shipped and composition-evidence files. See
[`capsule-graph.md`](capsule-graph.md). The threaded artifact hashes are locked
and verified in `/app`; a second-root threaded build remains a production
hardening check.

## Reproduction

```sh
npm run build:lean-runtime
npm run test:lean-link-spike
npm run build:lean-link-spike:threaded
npm test
npm run test:reproducibility
```
