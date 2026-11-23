# A genuinely pending Lean task in WebAssembly

This producer-side experiment addresses one question in VO #1223: can an ordinary npm consumer observe, cancel and drain a real Lean worker without blocking the JavaScript agent? A JavaScript Promise around a synchronous result would also pass a simple `await` test. Here the worker signals entry, waits on a separate Lean `IO.Promise`, and cannot finish until the host opens that gate.

[The Lean module](../../tests/fixtures/javascript-wasm-task-runtime/ThreadProbe.lean) starts the worker with `BaseIO.asTask`. A [C adapter](../../tests/fixtures/javascript-wasm-task-runtime/task-probe.c) runs the generated module initializer, then maps continuations over the worker-entry task and result task. Each continuation posts to the owner agent. The [package interface](../../tests/fixtures/javascript-wasm-task-runtime/index.mjs) settles the host Promise through the bridge's pending-operation registry. Cancellation rejects the public operation once; the worker retains its inputs until Lean actually completes. No host polling loop, timer-driven completion or blocking `Task.get` substitutes for that notification.

The [installed consumer](../../tests/fixtures/javascript-wasm-task-runtime/consumer.mjs) checks normal completion, cooperative cancellation, a worker that finishes despite cancellation, stale operations and shutdown while work is pending. The test also calls the two corrected temporary-path functions in the module's memory-backed filesystem. Its [runner](../../tests/helpers/javascript-wasm-threaded-task-installed.mjs) packs a private test package, installs its archive offline into an empty consumer, and runs the same calls in Node and Chromium. The browser requires shared memory and cross-origin isolation (COOP: `same-origin`; COEP: `require-corp`).

On 2026-11-23, four fresh Node 22.23.5 processes and one Chromium 156.0.8078.79 page each passed 21 checks, with one public resolution, three cancellations and zero remaining operations. A cancelled cooperative worker observed Lean's cancellation flag; a noncooperative worker still returned 13 to the drain step without changing its already-rejected host Promise.

An earlier replay intermittently exited Node with code 13 and an unsettled top-level await. An unresolved Promise alone does not hold the process open, and the Emscripten loader unrefs idle pool workers. The Node adapter now keeps a message port referenced only from admission through native drain, including the interval after public cancellation. The fresh processes must finish and exit on their own; a lingering port also fails the test.

The [runtime-owned observer](../../src/backends/javascript/task-notification.c) takes a borrowed Lean task and an opaque token, not a host function or a result codec. The [JavaScript dispatcher](../../src/runtime/wasm-task-notifications.mjs) belongs to one Wasm instance. It never reuses a token or runs a subscriber twice. The consumer replay also attached two subscriptions to one already-finished Lean task; neither reentered the subscribing call. This brought each of the four Node runs and the Chromium run to 22 checks.

A further shutdown check opens an instance with **only** those two subscriptions, then immediately closes it. There is no ordinary pending job to keep the workers alive. Closing waits until both notifications run before terminating the pool. The dispatcher's idle promise includes a handler already on the stack and any new subscriptions it registers.

## Two packages, one task manager

The shared variant installs three different npm archives: the threaded runtime, a producer containing `ThreadProbe`, and a [peer component](../../tests/fixtures/javascript-wasm-task-components/TaskPeer.lean). Only the first archive contains the runtime and task manager. The [component builder](../../tests/helpers/javascript-wasm-task-plugins.mjs) compiles the other two as separate position-independent Wasm modules. The consumer loads them from their own installed locations. The driver resolves the module initializers and typed exports through separate `dlopen` handles; swapping the two packages must fail. The runtime binary must not export either implementation.

The producer starts a gated Lean task. The peer accepts that same `Task UInt32` and schedules a `BaseIO.mapTask` continuation on its result. The continuation adds seven on a worker and returns a distinct sentinel on the main runtime thread. Nothing in JavaScript adds seven or passes a Lean pointer between packages. On 2026-11-23, four fresh Node processes and one isolated Chromium page each passed 22 checks on this path, including normal result **20**, cooperative cancellation with late native result **1008**, noncooperative cancellation with late native result **20**, and shutdown with late native result **10**. In every case cancellation targeted the original worker, not merely its derived task.

## From Lean declarations to a Wasm interface

The [Jobs fixture](../../tests/fixtures/javascript-wasm-generated-tasks/Jobs.lean) supplies nine ordinary Lean declarations selected in `lean-bridge.exports.json`. None has a handwritten `@[export]` adapter. The [compiler](../../src/build/javascript-wasm-task-component.mjs) elaborates the captured Lake project, checks C prototypes against Lean's generated C, and links a pthread Wasm side module. [Binding IR](../../src/abi/javascript-wasm-tasks.mjs) and the C generator independently determine each method's argument types, result tags, factory and terminal errors. Packaging stops if they disagree. The ordinary synchronous and native file-descriptor profiles do not use this wire.

The [installed wire test](../../tests/helpers/javascript-wasm-generated-tasks.mjs) packs a runtime and a separate component, installs both offline, and calls the component through its own dynamic-library handle. Two fresh Node processes and an isolated Chromium page each passed 79 checks on November 23, 2026. In particular:

| Call | Observed behavior |
|---|---|
| `checked` | A rejected EIO factory returns its typed payload with no task handle. A successful factory can deliver either branch of `Except` as an ordinary value. |
| `ioStart` and `terminal` | A factory IO error is available immediately. A worker IO error arrives through a completion notification. Both retain their text; a subsequent task succeeds. |
| `hold` and `release` | Trying to take the pending task returns immediately. Cancellation retains its native owner until the genuine Lean completion is consumed. A foreign domain or another declaration cannot close or cancel it. |
| `series` and `closes` | A cursor never prefetches. A second outstanding pull is rejected. Exhaustion, an early close and a typed pull failure each run Lean cleanup exactly once. |

Every wire run ended with zero live broker identities and zero pending notifications. These checks deliberately use the private interface to test mistakes an application cannot express through the public API, such as a foreign owner domain.

## What the installed application writes

```js
import { checked, series } from "@example/lean-jobs";

const result = await checked(false, false, 19);  // { ok: 26 }
for await (const n of series(3)) console.log(n);  // 0, 1, 2
```

The [package builder](../../src/release/javascript-wasm-task-packages.mjs) produces two npm archives and a hash-checked package-set receipt. The application imports the component; its exact dependency on `@lean-bridge/runtime` supplies the worker pool. Task functions return a native `Promise` with `cancel()`. Ordinary synchronous functions return their values directly. An iterator pulls one element per `next()`; `break` runs its Lean close action.

Cancellation rejects the public operation immediately. It does **not** pretend an already-running worker has stopped: its native owner stays live until the completion notification arrives. Closing the runtime stops admission synchronously and waits for that drain. The [installed application checks](../../tests/fixtures/javascript-wasm-task-runtime/public-consumer.mjs) distinguish a returned `Except.error` from a thrown typed factory error, a worker IO error, and a failed iterator step. A separate [TypeScript consumer](../../tests/fixtures/javascript-wasm-task-runtime/public-types.mts) checks the signatures against the installed declarations.

On November 23, 2026, both the ordinary project and a separately compiled reviewed project passed 47 public checks apiece in Node and isolated Chromium (188 checks: two fresh installations, each exercised on both hosts). Both passed strict TypeScript compilation against their installed declarations. The reviewed package retained the exact review file, the two component identities differed, and their runtime archives were byte-identical. Shutdown ended with zero native owners before worker termination. The 79 private-wire checks above ran separately in three fresh realms.

The gate in `hold` is allocated on demand. Do not put an unresolved `IO.Promise` directly in a Lean `initialize` declaration: making an imported global persistent can traverse its unresolved task and block the author compiler before any application call.

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
npm run test:javascript-shared-task-probe
npm run test:javascript-generated-tasks
```

## Why a separate runtime profile?

Pinned Lean `f3b06c705e6c85f5314019d5d3baab0fec5b580c` executes spawned work inline without a task manager; its promise implementation requires a manager. The ordinary browser profile builds with `MULTI_THREAD=OFF`. This probe initializes a real manager in a pthread-enabled module. Bringing in the real `Init.System.Promise` initializer also exposes a separate ABI problem:

- With the same final `emcc` command from the installed runner and baseline `threaded` core, `wasm-ld` reports function signature mismatches for `lean_io_create_tempfile` and `lean_io_create_tempdir`: `() -> i32` versus `(i32) -> i32`. Ignoring the warnings can leave a trapping call in a successful link.
- At that revision `stage0/stdlib/Init/System/IO.c` calls both externs with no arguments. `src/runtime/io.cpp` defines both with an unused world argument. A host adapter cannot change calls inside the compiler-generated Init module. The [two-line patch](../../patches/lean4-4.32.2-task-io-world.patch) corrects the definitions only; neither their filesystem behavior nor the Lean kernel changes. The final link uses `-Wl,--fatal-warnings`.
- The change is gated to `threaded-task`, whose patch-set identity differs from both existing profiles. For an upstream update, compare the generated calls to the definitions, try the strict link *without* the patch and run the installed Node/browser test. Drop the patch when those pass. The upstream change belongs in Lean's two extern definitions; if a future compiler intentionally retains the world argument, reassess that compiler and runtime as a pair. If they cannot be reconciled, keep this profile unavailable.

## What this does not ship

The three-package experiment uses one outstanding source task per instance, UInt32 payloads and a fixed shared heap. Its driver knows both component signatures. The generated application takes a different path: it imports ordinary npm functions and uses the compiled component's own contract. The test producer still links the owner runtime against the fixture's required imports. The normal author CLI does not yet provision a component-independent pthread runtime, and this copied-value package does not admit retained callbacks or captured resources. Emscripten 6.0.6 marks dynamic linking with pthreads experimental.

The pthread archives use a distinct profile and content-addressed runtime version. The single-threaded runtime remains separate; no native binding or language-neutral IR changed. These are local installations, not a published, signed or Nix-built release.
