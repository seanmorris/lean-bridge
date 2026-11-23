# A genuinely pending Lean task in WebAssembly

This producer-side experiment addresses one question in VO #1223: can an ordinary npm consumer observe, cancel and drain a real Lean worker without blocking the JavaScript agent? A JavaScript Promise around a synchronous result would also pass a simple `await` test. Here the worker signals entry, waits on a separate Lean `IO.Promise`, and cannot finish until the host opens that gate.

[The Lean module](../../tests/fixtures/javascript-wasm-task-runtime/ThreadProbe.lean) starts the worker with `BaseIO.asTask`. A [C adapter](../../tests/fixtures/javascript-wasm-task-runtime/task-probe.c) runs the generated module initializer, then maps continuations over the worker-entry task and result task. Each continuation posts to the owner agent. The [package interface](../../tests/fixtures/javascript-wasm-task-runtime/index.mjs) settles the host Promise through the bridge's pending-operation registry. Cancellation rejects the public operation once; the worker retains its inputs until Lean actually completes. No host polling loop, timer-driven completion or blocking `Task.get` substitutes for that notification.

The [installed consumer](../../tests/fixtures/javascript-wasm-task-runtime/consumer.mjs) checks normal completion, cooperative cancellation, a worker that finishes despite cancellation, stale operations and shutdown while work is pending. The test also calls the two corrected temporary-path functions in the module's memory-backed filesystem. Its [runner](../../tests/helpers/javascript-wasm-threaded-task-installed.mjs) packs a private test package, installs its archive offline into an empty consumer, and runs the same calls in Node and Chromium. The browser requires shared memory and cross-origin isolation (COOP: `same-origin`; COEP: `require-corp`).

On 2026-11-23, four fresh Node 22.23.5 processes and one Chromium 156.0.8078.79 page each passed 21 checks, with one public resolution, three cancellations and zero remaining operations. A cancelled cooperative worker observed Lean's cancellation flag; a noncooperative worker still returned 13 to the drain step without changing its already-rejected host Promise.

An earlier replay intermittently exited Node with code 13 and an unsettled top-level await. An unresolved Promise alone does not hold the process open, and the Emscripten loader unrefs idle pool workers. The Node adapter now keeps a message port referenced only from admission through native drain, including the interval after public cancellation. The fresh processes must finish and exit on their own; a lingering port also fails the test.

## Reproduce

Start at the repository root with pinned Lean 4.32.2 source and host compiler, Emscripten 6.0.6, CMake, Make, npm, the repository's JS dependencies and Chromium. Use fresh writable scratch space. The source checkout must include `stage0/stdlib/Init`; the small Init archive below is compiled from its hash-checked bootstrap C. The helper records the archive digest, all five target-header digests and the runtime stamp beside it in `inputs.json`; the installed test checks them before linking. Do not substitute an archive from the unthreaded browser runtime.

```sh
export LEAN_WASM_LEAN_SOURCE=/absolute/path/to/lean4
export LEAN_WASM_HOST_LEAN_PREFIX=/absolute/path/to/lean-4.32.2
export LEAN_WASM_EMSDK=/absolute/path/to/emsdk
export LEAN_BRIDGE_CHROMIUM=/absolute/path/to/chromium
export LEAN_WASM_RUNTIME_PROFILE=threaded-task LEAN_WASM_RUNTIME_FACET=core
scratch=$(mktemp -d)
export LEAN_WASM_RUNTIME_CACHE="$scratch/runtime" EM_CACHE="$scratch/emcache"
export CMAKE_BUILD_PARALLEL_LEVEL=1 EMCC_CORES=1 BINARYEN_CORES=1
bash scripts/build-lean-runtime.sh
# For offline core builds set LEAN_WASM_LIBUV_SOURCE to the pinned, identity-marked
# libuv source tree before invoking the build (see scripts/build-lean-runtime.sh).
export LEAN_WASM_PROJECT_ROOT="$PWD"
source scripts/lean-runtime-config.sh
export LEAN_BRIDGE_JS_THREAD_CORE="$LEAN_WASM_RUNTIME_CACHE/$LEAN_WASM_RUNTIME_BUILD_ID+core"
node tests/helpers/javascript-wasm-task-probe-init.mjs "$LEAN_WASM_LEAN_SOURCE" \
  "$LEAN_BRIDGE_JS_THREAD_CORE" "$LEAN_WASM_EMSDK" "$scratch/init"
export LEAN_BRIDGE_JS_THREAD_INIT="$scratch/init/libProbeInit.a"
export LEAN_BRIDGE_JS_EMSDK="$LEAN_WASM_EMSDK" LEAN_BRIDGE_LEAN_PREFIX="$LEAN_WASM_HOST_LEAN_PREFIX"
npm run test:javascript-threaded-task-probe
```

## Why a separate runtime profile?

Pinned Lean `f3b06c705e6c85f5314019d5d3baab0fec5b580c` executes spawned work inline without a task manager; its promise implementation requires a manager. The ordinary browser profile builds with `MULTI_THREAD=OFF`. This probe initializes a real manager in a pthread-enabled module. Bringing in the real `Init.System.Promise` initializer also exposes a separate ABI problem:

- With the same final `emcc` command from the installed runner and baseline `threaded` core, `wasm-ld` reports function signature mismatches for `lean_io_create_tempfile` and `lean_io_create_tempdir`: `() -> i32` versus `(i32) -> i32`. Ignoring the warnings can leave a trapping call in a successful link.
- At that revision `stage0/stdlib/Init/System/IO.c` calls both externs with no arguments. `src/runtime/io.cpp` defines both with an unused world argument. A host adapter cannot change calls inside the compiler-generated Init module. The [two-line patch](../../patches/lean4-4.32.2-task-io-world.patch) corrects the definitions only; neither their filesystem behavior nor the Lean kernel changes. The final link uses `-Wl,--fatal-warnings`.
- The change is gated to `threaded-task`, whose patch-set identity differs from both existing profiles. For an upstream update, compare the generated calls to the definitions, try the strict link *without* the patch and run the installed Node/browser test. Drop the patch when those pass. The upstream change belongs in Lean's two extern definitions; if a future compiler intentionally retains the world argument, reassess that compiler and runtime as a pair. If they cannot be reconciled, keep this profile unavailable.

## What this does not ship

The experiment uses one outstanding worker per private instance, UInt32 payloads and a fixed shared heap. On close it drains the known task before retiring that instance's Emscripten pthread pool; it does not recycle or install a scheduler in a release runtime. A production generator must share the application's runtime, lift the declared result and error types, retain captured resources, and support multiple pending operations and orderly shutdown. This fixture does not admit arbitrary `taskExports`, host callbacks, iterators or cross-component tasks.

The existing shared runtime and composition graph are unchanged. No native binding, registry identity, consumer prerequisite or language-neutral IR changes. For assurance and reproducibility this experiment records its own profile and strict-link inputs; it is not a signed or Nix-built release. Publishing would first require the same manifest and graph checks as every other target. No special API is exposed to other languages or to tools that consume the existing metadata.
