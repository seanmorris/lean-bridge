# Deliver a parked Lean task through a canonical WIT future

An installed [Pulse](../../tests/fixtures/c-lean-tasks/Pulse.lean) package starts a real Lean worker. A Wasm consumer reads its result through a Component Model `future<s64>`. The producer and consumer have separate memories and handle tables. This is an embedding test, not a change to the published `native-wit-task-v1` interface.

| Execution | What it verifies |
| --- | --- |
| Wasmtime 42.0.1 CLI | Two components transfer a `future<u32>` or `stream<u32>`. The reader parks before the writer sends, cancels the pending read, then reads again. The notified handle and event kind must match. The stream receives a second distinct item and ends when the writer closes. Dropping a reader before writing is observable at the producer. |
| Wasmtime 51.0.0 C SDK, Linux x86-64 | A [C embedding](../../tests/fixtures/wit-canonical-async/native.c) starts `Pulse.late` through the installed native package. The task must report pending and supply a readiness descriptor. After the guest parks its read, the embedding releases Lean’s gate, waits on the descriptor, and consumes the result exactly once. The guest receives `INT64_MIN`, zero and `INT64_MAX` on each of two independently built package routes. |

The ordinary Pulse archive was `d181b4c42c30d50c28d88ba97d549e60474bc6a3c39932a0a75f30a93c5104a0`; the reviewed archive was `7f7271e21881a4901413069566171c37d9d8560d44264e28e58c543b8d947928`. The test verifies the receipts and archive bytes, extracts only the public header and three runtime libraries, and checks which libraries the executable loads. No author source is compiled by the consumer.

The difference between the CLI and SDK matters. The pinned 42.0.1 C library can inspect future types but rejects an actual future/stream component at compilation. The 42.0.1 CLI can enable async builtins, as can the separate [Wasmtime 51.0.0 C SDK](https://github.com/bytecodealliance/wasmtime/releases/tag/v51.0.0). The ordinary package SDK pin is unchanged. Also, a synchronous guest export cannot block in `waitable-set.wait`. The test polls a ready event once after delivery; it does not spin.

## Reproduce

Set `WASM_TOOLS` to wasm-tools 1.245.1 and `WASMTIME` to the 42.0.1 CLI. Run `npm run test:wit-canonical-transport` for the two guest-to-guest cases.

For the parked Lean worker, use the retained ordinary and reviewed handoffs from the [C task package test](../../tests/helpers/c-task-installed.mjs). Set `LEAN_BRIDGE_C_TASK_EVIDENCE_DIR` when building those handoffs. Point `LEAN_BRIDGE_CANONICAL_PULSE_RELEASES` to the resulting directory containing `ordinary/` and `reviewed/`. Set `LEAN_BRIDGE_ASYNC_WASMTIME_C_API` to the extracted Linux x86-64 C SDK with `include/` and `lib/libwasmtime.so`. The upstream v51 archive SHA-256 is `515694e57d8b376f536280a7343a69b976e83d1ce6fb57bdb87c658b18b356d3`; the test requires shared-library SHA-256 `e3b6f82a76730979875b0c336e573583e1bd9deb052ac44be771e19b1dc51e00`. Run `npm run test:wit-canonical-lean-future`.

## Schedule independent futures

The first [component pair](../../tests/helpers/wit-canonical-fixture.mjs) requests delivery explicitly. The [scheduled application](../../tests/helpers/wit-canonical-scheduled-app.mjs) does not. It starts two independently gated [Lean tasks](../../tests/fixtures/wit-canonical-latches/Latches.lean), parks both reads, and releases only the second task. Its callback checks the identity and value of the first notification before releasing the other task. Their signed 64-bit results sum to exactly `100000000000000002`.

The [producer](../../src/backends/wit/canonical-future.mjs) uses separate canonical writers and storage for each operation. The [embedding reactor](../../src/backends/wit/canonical-future-reactor.h) waits on native readiness descriptors, takes each Lean result once, and retains a blocked writer’s slot until the reader consumes or drops it. Neither a raw handle nor a delivery hook appears in the application's imports.

The [installed test](../../tests/helpers/wit-canonical-scheduled.mjs) holds three completed writes at once, consumes `INT64_MAX` before `INT64_MIN`, and drops readers before and after publication. It then drops the reader of a seventh task whose Lean gate is still closed. The reactor releases that native owner without taking its result and reuses the slot before the worker is released. Shutting down twice with an eighth task pending closes that owner once.

With the native C author toolchain configured, point `LEAN_BRIDGE_ASYNC_WASMTIME_C_API` at the v51 SDK and `WASM_TOOLS` at wasm-tools 1.245.1. Run `npm run test:wit-canonical-scheduled`. The gate builds ordinary and reviewed Latches archives, in sequence, and runs the same consumer against each. To replay existing packages without the Lean compiler, also set `LEAN_BRIDGE_CANONICAL_LATCHES_ORDINARY` and `LEAN_BRIDGE_CANONICAL_LATCHES_REVIEWED` to the respective directories containing their receipts and archives.

These embedding checks use native C providers. The prepared WIT release is exercised separately below. Neither check delivers a Lean pull cursor through a canonical stream.

The idle-reader-drop regression failed against the old generated producer on the ownership counters. With the fix it passed on Wasmtime 51.0.0 with both native Latches archives: ordinary `212a9d41e98c7a3d3004ba55ffdb345d122a98618e1bf7ad0a3281de869232de` and reviewed `2e9179c9819d01ed5868591cf308c3b7b7f488d51c76a67142806e588cd7c08a`. Both declare Binding IR `928e66bbd1829148e535734ed567b4d70382cac1247f9fa07fbbe10650845ffb`. The [Canonical ABI](https://github.com/WebAssembly/component-model/blob/main/design/mvp/CanonicalABI.md#stream-and-future-state) and [pinned Wasmtime implementation](https://github.com/bytecodealliance/wasmtime/blob/v51.0.0/crates/wasmtime/src/runtime/component/concurrent/futures_and_streams.rs#L2336-L2352) notify even an idle writer when its reader is dropped. The producer registers for that event before returning the reader; it need not wait for Lean to finish.

## Run a prepared WIT package

The `native-wit-canonical-task-v1` release contains its own scheduler, Wasmtime runtime and compiled Lean exports. The [guest](../../tests/fixtures/wit-canonical-command/application.wat) imports only `ready`, `parked` and `release` from the public world. First, a Lean `Task.pure` wakes the guest while two other tasks are pending. Then it releases gate 2, waits for its result, and releases gate 1. The guest exits with another worker still parked. The expected result is `99999999999999983`; no application code calls a scheduler or transfers a native handle.

The [installation gate](../../tests/helpers/wit-canonical-command-package.mjs) verifies both receipts, checks the guest against the emitted WIT, moves each installation, verifies the loaded libraries, and runs it with no tools on its path. Run `npm run test:wit-canonical-package` with the publisher toolchain to build both routes. To replay, set `LEAN_BRIDGE_PREPARED_WIT_RELEASES` to a directory containing the `ordinary/` and `reviewed/` release handoffs, and `LEAN_BRIDGE_WASM_TOOLS` to wasm-tools 1.245.1. The gate uses wasm-tools to compile the test guest; the packaged runner takes the binary directly.

| Installed WIT archive | Bytes | SHA-256 |
| --- | ---: | --- |
| Ordinary Lean source | 60,912,455 | `e406668098c493bbdde92923b8360e9f4c57b8930b9c2b345da78f6224fb10e6` |
| Reviewed Binding IR and Lean source | 60,913,298 | `0b3d99b4f807069494af4f74f3535942dec80790f979ec514c1aef613754cdd9` |

A guest that starts no tasks returns `INT64_MIN` immediately. A core Wasm module, a component missing `run`, and a component requesting a private import are rejected. A guest that traps after opening a parked task exits nonzero without waiting for the Lean gate. These cases run inside each installed release.

Compatibility check: an offline-installed CLI built `Immediate.ready` again without `asyncAbi`. Its receipt selected `native-wit-task-v1`; the archive bundled Wasmtime 42.0.1. A C client linked against the installed header and libraries started the task, awaited `READY`, and received `INT64_MIN`.

## Distinguish factory, worker and returned errors

The [Meter exports](../../tests/fixtures/wit-task-package/effects.lean) and [Direct exports](../../tests/fixtures/wit-canonical-effects/Direct.lean) were compiled first from ordinary Lean source and then with reviewed Binding IR. The [independent guest](../../tests/fixtures/wit-canonical-effects/application.wat) ran unchanged against each relocated release. It imports six public functions. The consumer process had no Lean, Wasmtime SDK or build commands on its search path.

| Lean contract | What the guest checked |
| --- | --- |
| `EIO ε (Task α)` | A rejected factory returned the exact typed error and no future. After 96 consecutive rejections of the same factory, success still worked. A separate factory preserved `UInt64.max` on failure and `Int64.min` on completion. |
| `IO (Task (Except IO.Error UInt32))` with `taskIOErrors` | The same UTF-8 message, including an embedded NUL, came back in the outer error at startup and the inner error after awaiting the worker. A successful worker returned 97. |
| `Task (Except ε α)` and nested `Except` | A pure factory returned a future directly. Returned error branches, including the inner and outer branches of a nested value, survived delivery without turning into factory or worker failures. |
| Synchronous `EIO String (Except String UInt32)` | A direct call returned either a declared failure or a successful call containing an ordinary error. Neither outcome required a future. |

Two same-method string futures delivered separate NUL-containing Unicode strings in reverse order. The guest then read one future and dropped another in each of 96 rounds, exceeding the 64-slot capacity without exhausting it. Both runs printed `3737844653`, the final Lean value. The allocator test also reused a freed block 4,097 times with no linear-memory growth while another writer’s bytes stayed intact.

| Installed WIT archive | Bytes | SHA-256 |
| --- | ---: | --- |
| Ordinary Lean source | 60,916,915 | `b47ba0fdc421d35e7873ca2cf18dd82261c358c7258e19be57525c958d40e4e0` |
| Reviewed Binding IR and Lean source | 60,918,316 | `5ef1e2b8c842fe5616b8db96bb015c3ede7ad0a953cd7370cdcb044274195c56` |

Run `npm run test:wit-canonical-effects` with the [publisher toolchain](../publish/wit-wasi.md#export-asynchronous-tasks) to build and test both packages. To replay existing handoffs, set `LEAN_BRIDGE_CANONICAL_EFFECTS_RELEASES` to the directory containing `ordinary/` and `reviewed/`. Dropping a future in this check releases delivery storage; it does **not** demonstrate that a running Lean worker stopped. Canonical streams are a separate gate.

## Consume a compiled pull cursor as a stream

The [Lean cursor](../../tests/fixtures/wit-task-package/cursors.lean) increments one counter in `advance` and another in `finish`. The [guest](../../tests/fixtures/wit-canonical-stream/application.wat) observes these through a synchronous Lean export. Its only other imports are two public stream factories. No hand-written host invokes `next`, reports demand or supplies items.

| Guest operation | Observation |
| --- | --- |
| Reject 96 factories, then open two cursors and drop one unread | No pulls. Only the successfully opened, discarded cursor closed. |
| Request a read and immediately withdraw it | No extra pull. The same reader subsequently received items 0 and 1, then end. |
| Receive an ordinary `Except.error "item"` | It arrived as an item; an early break closed that cursor. |
| Fail a step with `UInt16.max` | One typed terminal error, distinct from an item and from the factory's `UInt32` error. Cleanup ran once. |
| Cancel a read while its Lean step is parked, then discard the reader | The cursor closed **before** the Lean gate was released. Its late value did not reach the guest. |
| Hold a zero-length read open, advance a second reader, then consume or drop the first writer's buffered item | The two cursors retained their own position and payload storage. Discarding a buffered terminal error did not close its cursor twice. |

The final result encodes **11 pulls and 89 closes**: `(11 << 32) + 89 = 47244640345`. Eighty of those closes came from repeatedly dropping an unread cursor, beyond the per-method slot count. These counters measure Lean activity, not host wrapper calls.

The [Canonical ABI stream readiness rules](https://github.com/WebAssembly/component-model/blob/main/design/mvp/CanonicalABI.md#stream-and-future-state) allow a zero-length write to wait for a reader without sending data. On Wasmtime 51.0.0, a readiness notification can survive a cancelled read. The producer checks readiness again before requesting the next Lean item. Omitting that check advanced the test cursor once after the guest had withdrawn demand.

| Installed stream archive | Bytes | SHA-256 |
| --- | ---: | --- |
| Ordinary Lean source | 60,916,851 | `5b4d026ff315d8b48b572fbfbdad0c9f963689076403c335020caffae0027df9` |
| Reviewed Binding IR and Lean source | 60,917,939 | `eeb1bc64eee8550881ddab1316e9ed21a09dd659cfff535cb590840cebd090fa` |
| Lean source exporting both streams and a future | 60,924,439 | `eaad6ea34388a536c593cc8123954afee0c41aa8d57882a35f4d00057b1f731f` |

All three relocated packages ran the same guest with no build tools on its search path. The mixed package also ran a [second guest](../../tests/fixtures/wit-canonical-stream/mixed.wat): it starts a parked Lean task, receives a stream item, then releases the task and reads its result, `-700000000000000029`. The review test changed the cursor's cleanup declaration while keeping the original reviewed IR; the build rejected the mismatch without writing a package receipt.

Run `npm run test:wit-canonical-stream` with the [publisher toolchain](../publish/wit-wasi.md#export-asynchronous-tasks). To replay a prepared archive, set `LEAN_BRIDGE_CANONICAL_STREAM_ORDINARY`, `LEAN_BRIDGE_CANONICAL_STREAM_REVIEWED`, or `LEAN_BRIDGE_CANONICAL_STREAM_MIXED` to its handoff directory. The test builds any missing handoff and always runs the stale-review check.

After adding streams, the fallible-future regression above also passed from fresh builds of both source routes (SHA-256 `0b0caa0d0624bcc16a84037f283ce9a409d60d27d059bb1f1160412c77ea651f` and `9a539a82b8826e0fa3e112c350f0689f293d5176da88c6ce7da96a2184f78e0f`, respectively).

## Observe cancellation inside the Lean worker

The [Watch package](../../tests/fixtures/wit-canonical-cancel/Watch.lean)
separates three events: a pull worker starts, its cursor closes, and the
worker finishes. A [Wasm guest](../../tests/fixtures/wit-canonical-cancel/application.wat)
waits for each event through a public future. On the abandonment paths it
does not release the parked worker until the Lean close callback has run.
There are no sleeps, timing thresholds, or host-generated acknowledgements
in the protocol.

| Guest action | What the worker reported | What reached the guest |
| --- | --- | --- |
| Release the worker with its reader still open | `4`: completed without cancellation | The item `73`, then one close when the guest dropped the reader |
| Withdraw the read, drop the reader, wait for close, then release a cooperative worker | `2`: `IO.checkCanceled` was true; the worker returned without producing an item | No write to the guest's destination; one close |
| Repeat with a worker that ignores the same cancellation request | `3`: `IO.checkCanceled` was true; the worker still computed an item | No write to the guest's destination; one close |

Both freshly built and relocated packages returned **423**, the three
worker observations in order. The guest and package agreed on the emitted WIT
world, and the launcher ran with no build tools on its path. This verifies a
pending **stream pull**; it does not claim a standalone future's reader drop
interrupts arbitrary Lean code.

| Source | Bytes | Archive SHA-256 |
| --- | ---: | --- |
| Ordinary | 60,916,681 | `6a8840d8a8eb808f4d863f1c04f2165533bb9f6d02495a417f78845aac9623f1` |
| Reviewed | 60,917,615 | `05942387113385cc18f674cd9ada44df5d0340aeb0b4c909b3a28ee11e7feca0` |

Run `npm run test:wit-canonical-cancel` with the same pinned producer tools
as the stream test. The [installation gate](../../tests/helpers/wit-canonical-cancel.mjs)
can also replay handoffs supplied in `LEAN_BRIDGE_CANONICAL_CANCEL_ORDINARY`
and `LEAN_BRIDGE_CANONICAL_CANCEL_REVIEWED`.

## Drop a standalone future while its worker is parked

The [guest](../../tests/fixtures/wit-canonical-cancel/future.wat) runs against
a package that exports futures but **no stream or cursor finalizer**. The
[Lean worker](../../tests/fixtures/wit-canonical-cancel/Watch.lean) signals
that it has started, parks on a promise, and reports its own `IO.checkCanceled`
flag after the guest releases the promise.

| Guest action | Worker observation | Delivery |
| --- | --- | --- |
| Withdraw a pending read; keep the reader and read again | `4`: no cancellation | The second read received `73`. |
| Withdraw the read, then drop the reader | `2`: the cooperative worker observed cancellation and stopped | The discarded read's destination was unchanged. |
| Drop the reader without ever issuing a read | `3`: the worker observed cancellation, ignored it and computed `73` | No late value reached the guest. |

On both drop paths the guest awaits an independent future before opening the
worker's gate. That round trip gives the reactor a turn; the worker's own flag,
not the passage of time, establishes cancellation. Both relocated WIT packages
ran the same guest with no build tools on its path and printed **423**.

| Source | Bytes | WIT archive SHA-256 |
| --- | ---: | --- |
| ordinary | 60,916,539 | `c6348053ab5b320bac86e8b01df9d7c7872c9d21378b310d694ef0b966cbf1d3` |
| reviewed | 60,917,324 | `f01e1c7bb080c04a676a8d89fe3b5f01a7ffe685502614676c0f2f7f2dd48d30` |

Run `npm run test:wit-canonical-future-cancel` with the [publisher toolchain](../publish/wit-wasi.md#export-asynchronous-tasks).
To replay the same guest on existing packages, set `LEAN_BRIDGE_CANONICAL_FUTURE_CANCEL_ORDINARY` and `LEAN_BRIDGE_CANONICAL_FUTURE_CANCEL_REVIEWED` to their handoff directories.

The [fallible-future guest](../../tests/fixtures/wit-canonical-effects/application.wat) also passed with this producer. Each fresh install survived 96 rejected factories and 96 read/drop rounds. Factory errors, worker errors and ordinary `Except` values remained distinct, and simultaneously pending strings retained their own bytes. Archive SHA-256: ordinary `43d6a6c1d6109fb0bc5c5191faefe77500a8faad33fc7f57c5f0ce5940e9457b`; reviewed `512777c9edbd10e4270d35ef20c01d6baf0eb8803c6e69d277b565fe6005bd05`.
