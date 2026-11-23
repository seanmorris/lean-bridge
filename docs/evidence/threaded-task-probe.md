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
node scripts/prepare-javascript-task-init.mjs "$LEAN_WASM_LEAN_SOURCE" \
  "$LEAN_BRIDGE_JS_THREAD_CORE" "$LEAN_WASM_EMSDK" "$scratch/init"
export LEAN_BRIDGE_JS_THREAD_INIT="$scratch/init/libTaskInit.a"
export LEAN_BRIDGE_JS_EMSDK="$LEAN_WASM_EMSDK" LEAN_BRIDGE_LEAN_PREFIX="$LEAN_WASM_HOST_LEAN_PREFIX"
npm run test:javascript-threaded-task-probe
npm run test:javascript-shared-task-probe
npm run test:javascript-generated-tasks
```

## Why a separate runtime profile?

The author CLI selects the threaded SDK when `taskExports` or `asyncIterators` is nonempty. Ordinary synchronous npm IO keeps its single-threaded runtime. The two profiles do not substitute for one another.

Pinned Lean `f3b06c705e6c85f5314019d5d3baab0fec5b580c` executes spawned work inline without a task manager; its promise implementation requires a manager. The ordinary browser profile builds with `MULTI_THREAD=OFF`. This probe initializes a real manager in a pthread-enabled module. Bringing in the real `Init.System.Promise` initializer also exposes a separate ABI problem:

- With the same final `emcc` command from the installed runner and baseline `threaded` core, `wasm-ld` reports function signature mismatches for `lean_io_create_tempfile` and `lean_io_create_tempdir`: `() -> i32` versus `(i32) -> i32`. Ignoring the warnings can leave a trapping call in a successful link.
- At that revision `stage0/stdlib/Init/System/IO.c` calls both externs with no arguments. `src/runtime/io.cpp` defines both with an unused world argument. A host adapter cannot change calls inside the compiler-generated Init module. The [two-line patch](../../patches/lean4-4.32.2-task-io-world.patch) corrects the definitions only; neither their filesystem behavior nor the Lean kernel changes. The final link uses `-Wl,--fatal-warnings`.
- The change is gated to `threaded-task`, whose patch-set identity differs from both existing profiles. For an upstream update, compare the generated calls to the definitions, try the strict link *without* the patch and run the installed Node/browser test. Drop the patch when those pass. The upstream change belongs in Lean's two extern definitions; if a future compiler intentionally retains the world argument, reassess that compiler and runtime as a pair. If they cannot be reconciled, keep this profile unavailable.

## Prepare the author SDK

After building the pinned threaded core and PIC Init archive above, build the application-independent owner once:

```sh
node scripts/prepare-javascript-task-sdk.mjs "$scratch/task-sdk"
node scripts/build-cli-npm-package.mjs --output "$scratch/author-cli" \
  --javascript-task-inputs "$scratch/task-sdk"
LEAN_BRIDGE_TEST_TASK_INPUTS="$scratch/task-sdk" npm run test:javascript-task-author-cli
```

The first command links the in-memory Lean value and scheduler operations, notification bridge and ownership broker. It takes no user project as input. It records digests of the libraries, link recipe, toolchain, output bytes and matching target headers. The second embeds the verified SDK in an installable CLI. A publisher can distribute the same SDK separately. Compare its manifest digest with one obtained independently; the local digest sidecar is not a publisher signature.

The installed-CLI test builds ordinary and reviewed releases, checks clean-directory reproduction, then builds a second library with a different API. Both libraries must use identical runtime archives and run together. A permanently pending worker in the first package would make a simple sequential smoke test hang; the consumer runs the second package before releasing the first worker.

The compact SDK built above contains the pinned `Init.System.Promise` dependency closure. The example modules use `prelude` with an explicit import. This does not establish that the full default `Init` or arbitrary `Std` and Lake dependencies are available: a component that needs a missing runtime symbol fails before the handoff is written.

### Installed CLI results, November 23, 2026

Two independent links in different directories produced byte-identical SDK files (manifest SHA-256 `a242f1f85763892627fc1898be1c35e3a8ddb6f647ddc00523742ac2aba3e98b`). An offline-installed CLI used the bundled SDK without the raw target tree or a supplied runtime path. It reproduced the ordinary release from a relocated source tree. These are the verified top-level package-set receipt digests:

| Release | SHA-256 |
| --- | --- |
| Ordinary and relocated Jobs | `2a218cc45df67ad057891d728efa4d09824cc462e57f779bf29d5baef1e37837` |
| Independently reviewed Jobs | `0b6b44f03650751cb96c941ae5e4bb38d28c558e22525833e1b5978053d6d799` |
| Unrelated Totals | `d2501cb2d94e638a97cef273eba64b50043e047602b6e9ec78663ee9b5d703ea` |

All three contain the same 757,897-byte runtime archive (SHA-256 `cc275ed105a05ec5af1cde689445904dd0a9ca2208cdb4331cb3eba412919ece`). Both Jobs routes passed strict TypeScript plus 47 public checks per host in Node and isolated Chromium. On each host, Totals returned 29 while Jobs still owned a pending worker; Jobs then returned 71, leaving zero native owners. The CLI refused an absent or mismatched SDK, external effects, and a scalar declaration selected as a task, without emitting a handoff. Set `LEAN_BRIDGE_JS_TASK_EVIDENCE` to a new directory to retain all three releases from a replay.

## Share a Lean resource between task packages

[Depot](../../tests/fixtures/javascript-wasm-resource-tasks/Depot.lean) lends a ticket to a worker, raises it in a typed factory error, and yields it from a cursor. [Peer](../../tests/fixtures/javascript-wasm-resource-tasks/Peer.lean) is compiled as a separate package. Both import the [same Lean type](../../tests/fixtures/javascript-wasm-resource-tasks/Shared.lean). Each package checks its own ABI; one owner-thread table in the shared Wasm runtime holds the live leases. Workers own ordinary Lean references, not JavaScript handles.

Run the installed acceptance test with a freshly prepared SDK that contains this shared lease table:

```sh
LEAN_BRIDGE_TEST_TASK_INPUTS="$scratch/task-sdk" npm run test:javascript-task-resources
```

The [consumer](../../tests/fixtures/javascript-wasm-resource-tasks/calls.mjs) disposes the original ticket while a worker is pending, then mutates the returned ticket through Peer and reads the new value through Depot. Factory and iterator errors carry independently disposable tickets. Cancellation rejects the caller before a gated worker completes; when that worker returns a ticket anyway, the native owner count drops from one to zero without creating a JavaScript handle. Returning from a cursor with a pull outstanding closes it exactly once. The strict TypeScript consumer also rejects a similarly shaped badge. Set `LEAN_BRIDGE_JS_TASK_RESOURCE_EVIDENCE` to a new directory to retain the three release handoffs.

Two independent links produced byte-identical lease-capable SDKs (manifest SHA-256 `589f84e1575d1efb220e0df20a28a8ce246b814de70330f91fd215c8b748b0d9`). Each component below uses the same 761,487-byte runtime archive, SHA-256 `0989af1879891c06b1ee069e31f2f3037ff00edd81e2a2f0e3eaa740aec7788d`.

| Resource package | Top-level package-set receipt SHA-256 |
|---|---|
| Depot, ordinary | `f99c27b12c3d0b06841e9bd3f33478f27c9d8455e0cba1c1e8b389197488253f` |
| Depot, reviewed | `ea430a97ace556ad81134dd47b0df1eea7ca35289259c4e17294fcb7270c09ee` |
| Peer, independent | `f239f40052f29a68de96d6158cec180c8fc7c479ec643a0e5dc8927464badb1f` |

Both Depot routes passed strict TypeScript and 43 public checks in each of Node, a Node module worker, and isolated Chromium (258 checks). While the worker shut its own runtime down, the parent retained, read and disposed its original ticket. A review that substituted a different nominal identity failed the compiler-contract comparison and produced no release directory.

The copied-value Jobs and Totals regression used the same runtime archive. Jobs again passed 47 checks per source route in both Node and Chromium. Totals returned 29 while Jobs still held a pending worker; after release, Jobs returned 71 and the native owner count was zero on both hosts.

## Retained callbacks on the JavaScript owner

The [Relay source](../../tests/fixtures/javascript-wasm-retained-tasks/Relay.lean) invokes a JavaScript callback either while constructing a task or from its inner worker. The worker sends its argument to the owner and waits for a Lean promise. The JavaScript function can reply immediately or later. The owner can still call another package, cancel the task or close the runtime. Native results, requests and JS errors do not share an identity just because their text matches.

The [installed consumer](../../tests/fixtures/javascript-wasm-retained-tasks/calls.mjs) uses two independently compiled components. It checks the original thrown JS value, the factory/task distinction, caught and replaced errors, returned `Except`, deferred `EIO`, copy budgets and shutdown before a late reply. A fresh consumer runs for each ordinary and reviewed release.

```sh
LEAN_BRIDGE_TEST_TASK_INPUTS="$scratch/task-sdk" npm run test:javascript-task-callbacks
```

The adapter chains Lean tasks instead of parking a second worker to join the inner task. This matters on Chromium: the pinned Emscripten build can grow its pool in Node but cannot do so in a browser. A Node-only run passed before the browser exposed this difference.

Two independent SDK links produced manifest SHA-256 `337dfdbd5bec8bfada345c6a4c83016bff96e72298ae69af6b53770b044d006f`. The three local handoffs include the same 764,239-byte runtime archive, SHA-256 `c66ea9d2fdd55563d61ee48cc531cd0449d5af1bcca0f0925826bc6d28e6c412`. Set `LEAN_BRIDGE_JS_TASK_CALLBACK_EVIDENCE` to a new directory to keep the verified archives; a receipt verifies the files, not the outcome of the subsequent host tests.

| Callback package | Top-level package-set receipt SHA-256 |
|---|---|
| Relay, ordinary | `dddfc660c78bde4d42569073cc6fd18e72b84d37985c4f7de995392d07783010` |
| Relay, reviewed | `e47e43059360e2e3306a75d0693f116399d553aca9400b8bb1c0add006bd537f` |
| Echo, independent | `8e847abcd4ce939a1e937a0b25c0d1a9695b353ec7c1187225d132be79cae961` |

Both Relay routes passed strict TypeScript and 78 public checks in each of Node, a Node module worker, and isolated Chromium (468 checks). Two packages could nest an awaited callback; with two replies already outstanding, the third attempt raised a Lean IO error without invoking JavaScript, and both earlier calls completed. Replacing the reviewed invocation count with `once` failed compiler reconciliation and produced no release.

In a separate Chromium realm for each route, the test injected an uncaught error into a real pthread while the factory awaited JavaScript. The public call, shutdown and subsequent admission observed the same failure. Frames, allocations, pending operations and notifications returned to zero without calling cleanup through the failed heap. This is a fatal worker failure, distinct from an application's rejected callback.

## Exercise a production browser-worker deployment

Use the same author kit as above, or reuse the original release handoffs from both suites:

```sh
LEAN_BRIDGE_TEST_TASK_INPUTS="$scratch/task-sdk" npm run test:javascript-task-web
# Replay only, using the callback and resource suites' retained archives:
LEAN_BRIDGE_JS_TASK_WEB_RELEASES="$scratch/callback-handoffs" \
LEAN_BRIDGE_JS_TASK_WEB_RESOURCES="$scratch/resource-handoffs" npm run test:javascript-task-web
```

The test verifies the package receipts, installs the archives offline, bundles the [page and worker](../../tests/fixtures/javascript-wasm-task-web/page.mjs), and compares the deployed Wasm bytes with the installed binaries. It then removes the consumer's dependency directory and serves only the static deployment under `/tasks/nested/`. The positive case supplies cross-origin isolation headers; the negative case omits them.

The Relay page holds a pending callback while its worker starts and closes a separate runtime. The Depot page keeps a ticket and a pending task, then passes the returned ticket to Peer after worker shutdown. In its worker, [two real `for await` loops](../../tests/fixtures/javascript-wasm-task-web/resource-calls.mjs) distinguish breaking after the first item from natural exhaustion.

The ordinary and reviewed workers each passed 78 callback checks or 43 resource checks plus both loop exits. Every parent resumed with `42`; all four deployments ended with zero frames, allocations, pending operations, native owners and notifications. Without isolation each reported the shared-heap prerequisite. The worker sends a startup acknowledgement after its static imports: before that change, both callback applications loaded the correct pthreads but lost the first request.

## What this does not ship

The three-package wire experiment uses one outstanding source task per instance, UInt32 payloads and a fixed shared heap. Its driver knows both component signatures. The generated npm application instead imports ordinary package functions and uses the compiled component's own contract. The low-level wire test still creates a fixture-specific runtime; the author SDK is linked independently. Direct nominal resource arguments, returns, items and error payloads use the runtime's lease table. Threaded callbacks accept one copied scalar and return one copied scalar; they do not transport nested resources or returned functions. Emscripten 6.0.6 marks dynamic linking with pthreads experimental.

The pthread archives use a distinct profile and content-addressed runtime version. The single-threaded runtime remains separate; no native binding or language-neutral IR changed. These are local installations, not a published, signed or Nix-built release.
