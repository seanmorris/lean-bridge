# Lean Runtime and Generated Side-Module Spike

Status: verified for the exact scope below. Three Lean libraries, cross-library identity, bidirectional callback re-entry, startup/lazy/final-static composition, and both memory profiles pass. A separate acceptance gate now runs the browser profile through raw ESM, a module worker, Vite, Rollup, Webpack, and React Strict Mode.

Date: 2026-08-08 UTC.

## What was tested

The pinned Lean 4.32.2 sources were configured through their existing Emscripten CMake path with Emscripten 6.0.6. GMP, mimalloc, Lean multithreading, mmap, ccache, and nonessential installation targets were disabled for this first architecture probe.

The resulting `libleanrt.a` and a wasm32/LTO build of Lean's complete `Init` closure were linked only into an Emscripten `MAIN_MODULE=2`. Lean-authored Alpha, Beta, and Gamma modules were compiled independently by the pinned host Lean compiler to generated C, then linked without either archive as `SIDE_MODULE=2` artifacts. Beta and Gamma compile against Alpha's `.olean`, so all three use the same nominal `Box` type rather than relying on compatible layouts. Small C shims register each module's generated entry points into the main-owned registry. A tracked graph lock content-addresses all six Lean/shim inputs, pins their dependency order and runtime/patch identities, and drives both modes. Startup and lazy loading use the same three side binaries; final-static links the same locked generated sources into one non-dynamic application.

Alpha allocates a non-scalar Lean structure containing a `UInt32` and persistent `String`. Alpha, Beta, and Gamma each read that same object through independently generated code. The main bridge retains the object in a generation-safe registry, passes the resolved object through Beta's and Gamma's identity functions, checks that the Lean identity is unchanged, balances every consume and retain, and verifies the ownership counter returns to zero.

## Stock-source failures and admitted patches

The unmodified runtime build failed in two Emscripten stubs:

```text
event_loop.cpp: conflicting types for 'lean_uv_event_loop_alive'
system.cpp: conflicting types for 'lean_uv_os_get_group'
```

The header/generated ABI expects `uint8_t lean_uv_event_loop_alive()` and `lean_obj_res lean_uv_os_get_group(uint64_t gid)`. The Emscripten definitions used `lean_obj_res` and omitted `gid`, respectively. The minimal signature patch is SHA-256 `f867026310111fd4ec084eb88dd93afb03ad10959a6f33b91476870d18648190`.

Lean's Emscripten CMake branch also placed `-pthread` in its common settings before consulting `MULTI_THREAD`, so `MULTI_THREAD=OFF` still emitted shared-memory artifacts. Patch `a4fe93f423c1de73cfd1d42aefd22010290a56f0927dc7ef071a382376611bc4` makes that flag conditional on the existing option. It introduces no new option or runtime branch. A third build-only patch, `dea7a934b9812d93e5be1be2a39c9e9798d4287e55c3b9535b03574c48f31562`, lets the existing libuv external-project step copy an already pinned source tree rather than requiring a Git fetch in a network-disabled Nix builder. It does not change runtime code. The complete ordered, path-independent patch set is SHA-256 `743765bf566f43ec2f7b4eb84a85686880b3797efe83bf244d6fc7281e4f85a3`; build copies, graph contracts, and artifacts are keyed by Lean commit, patch set, and `browser` or `threaded` profile.

After the patch, all 34 runtime archive members compiled. The archives contain
1,123 defined-symbol records. Their profile-specific evidence is:

```text
browser:  1,060,184 bytes, sha256 923f1e36d5fc5fc535e4259d470ed9564efc7341ffadce434e882c9e93faa6dd
threaded: 1,108,496 bytes, sha256 9dadef87e7f865f664ebe2124e12b32124a9f779f1fafc2fc836c6a522bdf117
```

The audit uses the pinned emsdk LLVM tools; Debian LLVM 14 cannot read Emscripten LLVM 24 LTO bitcode.

## Real `Init`/IO closure

The pinned previous-stage Lean/Lake compiler builds only the `Init:static` facet through Lean's generated `stdlib.make`. That makefile exports `LEAN_CC=emcc`; invoking Lake directly was explicitly rejected after an audit showed that it silently produced x86-64 objects. The reproducible build supplies Wasm-exception, LTO, PIC, floating-point, and profile-matching thread flags. It extracts a representative LTO archive member, sends it through the pinned Emscripten target linker, and fails unless the result is a wasm32 object.

The resulting archives contain 601 members, including `initialize_Init` and
its runtime/meta initialization closures:

```text
browser:  22,621,442 bytes, sha256 49564fd3841536c1e6a23dec6309bbd16e22547d41d34f80a29edbd330157077
threaded: 22,662,910 bytes, sha256 810aafa876804e60387e3a26eff87146765670f8cdf9b184e4056ae89a9eefd7
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
are loaded. The Lean Alpha descriptor returns a native `Box` class whose opaque
registry token, underscore-prefixed ABI calls, runtime initialization, and
release call remain private. Consumers use `new alpha.Box(42)`, `box.read()`,
`box.identity()`, and `box.dispose()`. Runtime initialization is deferred until construction. Binding IR now generates the public projection, copied-value layout, and resource lifecycle plan. The private symbol map and capsule assembly remain POC inputs pending Lean frontend and package-pipeline generation.

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
  functions, with no private Lean runtime domain;
- the locked `MAIN_MODULE=2` export manifest makes every side-module function import available from main;
- no side module contains a Lean runtime or `Init` archive;
- main has no unresolved `lean_*`, `initialize_*`, `runtime_initialize_*`, or `meta_initialize_*` function import;
- final-static contains exactly one memory, table, `initialize_Init`, representative runtime symbols, registry symbol set, and copy of every Alpha/Beta/Gamma definition;
- browser and threaded memory growth succeeds, after which Alpha still allocates, reads, and releases a Lean object; and
- threaded lazy loading binds the side modules into the already-running shared memory and runtime;
- named dynamic and prelinked loads return the same frozen native API shape; and
- generated modules do not export `ccall` or `cwrap`. Remaining raw probes live under `tests/internal/abi` as lifecycle and profile instrumentation. Consumer assertions call projected native functions and classes.

Artifacts from this run:

| Profile and artifact | Bytes | SHA-256 |
|---|---:|---|
| browser startup main | 1,297,072 | `c9d625db5fae4f8c9ec602e4fb7aa3a572dda6c5c365426bbdcfc2dfbb1b3caf` |
| browser lazy main | 1,296,987 | `b8c6328d558f793a4847e6465f432c6d19602d56c01852237e7629b3417743b1` |
| browser final-static main | 1,300,218 | `a8da327507fce6a628f47dff7ec8107c9df399ac9aaaffdca094e13680c75d4f` |
| browser Alpha side module | 4,612 | `df3c7c6da8f919a3c0bb6748ec2a265841fa4ade4e69fdf9fed53e7f3f15beda` |
| browser Beta side module | 604 | `aaee59f1ec973e56275e46f7f7dab4f08642b0a4e0c088297a319c4f695071e8` |
| browser Gamma side module | 605 | `cff5bd84b30c64dd7ff2b199202f45f7b79c23936f51e3661bae1190eff096a5` |
| threaded startup main | 1,329,414 | `a73fa0f6293f57a1adca0eb23b26768370c8ed2c6af433c3d8a49f11e77be51d` |
| threaded lazy main | 1,329,329 | `dd7e539fd7641e8a0c4ab1b6f20d37002c14a4bb9044063be0de39b2a904e027` |
| threaded final-static main | 1,326,392 | `b326377ce2f899fe328aaaa6eced9bb40ebe2c31e24c5f2c960653526e53db35` |
| threaded Alpha side module | 4,802 | `694b29bd35bc374792385fcbe014221cdf76efe48599beeb8ca158e5bdfa7d82` |
| threaded Beta side module | 831 | `c677d1c7f1ff1057ac13678a0f04fe21b380f53b40893bf4b5ef45f20114415c` |
| threaded Gamma side module | 832 | `b4fe836032a02aa0b3427e1ab4ec082d53372626616253040baf4aa1c842c051` |

## Architectural consequences

`MAIN_MODULE=1` is unsuitable as the default because it preserves the entire dynamic symbol universe and pulled runtime subsystems whose Lean `Init` implementations were not linked. `MAIN_MODULE=2` plus a generated symbol-export manifest derived from the canonical side-module graph works for the narrow slice and makes symbol compatibility explicit.

The browser profile is now the default: `MULTI_THREAD=OFF`, no `-pthread`, one main-defined unshared memory, no SharedArrayBuffer requirement, and no dynamic-linking/pthreads or pthread/memory-growth warnings. Its startup main is 32,553 bytes smaller than the threaded equivalent in this narrow build. This removes cross-origin-isolation headers as a prerequisite for ordinary single-threaded browser consumption. [The browser acceptance record](browser-bundler-acceptance.md) covers real Chromium, worker, bundler, and React execution.

The explicit `threaded` profile sets `MULTI_THREAD=ON`, passes `-pthread` through the runtime, generated `Init`, side modules, and final link, and imports one shared memory. It retains Emscripten's warnings that dynamic linking with pthreads is experimental and that shared-memory growth may execute non-Wasm support code slowly. Browser deployments of this profile require SharedArrayBuffer availability and the corresponding cross-origin-isolation policy. Thread selection is therefore an application/runtime-profile decision, never a per-library choice; all libraries in one graph must use the same profile.

The real `Init` closure increases the current main artifact by approximately 1.14 MiB over the earlier narrow stub. That is paid once per application, not once per Lean library. Libraries that import `Std` or other roots will require their exact cross-compiled initialization closure in the main graph; this milestone proves `Init` and core `IO`, not every future standard-library profile.

For this three-library slice, browser final-static is 5,143 bytes smaller than the startup dynamic main plus its three side modules; threaded final-static is 9,148 bytes smaller. This is evidence for a packaging choice, not a general performance conclusion. Both modes expose the same native Alpha `Box` surface and satisfy the same cross-library identity test.

Compiler prefix maps normalize the source root to `/workspace`, normalize every
content-addressed runtime build directory to
`/workspace/build/lean-runtime/current`, and compile static capsule objects from
relative source paths. Clean browser and threaded rebuilds in an independent
`/tmp/lean-wasm-repro.*` checkout each produced byte-identical output for all
23 shipped and composition-evidence files. The complete x86-64 closure also
builds and tests inside Nix with fixed Lean, libuv, Emscripten, and Node inputs.
See [`capsule-graph.md`](capsule-graph.md).

## Reproduction

```sh
npm run build:lean-runtime
npm run test:lean-link-spike
npm run build:lean-link-spike:threaded
npm test
npm run test:reproducibility
npm run test:nix
```
