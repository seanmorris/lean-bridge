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

The [installed test](../../tests/helpers/wit-canonical-scheduled.mjs) verifies the archive and Binding IR before compiling the C embedding. It holds three completed writes simultaneously, consumes `INT64_MAX` before `INT64_MIN`, and drops readers both before and after publication. It also shuts down with a seventh Lean operation still pending: shutdown closes that native owner once, and subsequently releasing the Lean gate does not publish a result. Reader drop alone does not promise cancellation of a running Lean computation.

With the native C author toolchain configured, point `LEAN_BRIDGE_ASYNC_WASMTIME_C_API` at the v51 SDK and `WASM_TOOLS` at wasm-tools 1.245.1. Run `npm run test:wit-canonical-scheduled`. The gate builds ordinary and reviewed Latches archives, in sequence, and runs the same consumer against each. To replay existing packages without the Lean compiler, also set `LEAN_BRIDGE_CANONICAL_LATCHES_ORDINARY` and `LEAN_BRIDGE_CANONICAL_LATCHES_REVIEWED` to the respective directories containing their receipts and archives.

These embedding checks use native C providers. The prepared WIT release is exercised separately below. Neither check delivers a Lean pull cursor through a canonical stream.

Verified Latches archive SHA-256: ordinary `212a9d41e98c7a3d3004ba55ffdb345d122a98618e1bf7ad0a3281de869232de`; reviewed `d9ff37b4998b2215d5e280a348ebc3dcb378c87a39f1df70604d3d6d9a9687b7`. Both declare Binding IR `928e66bbd1829148e535734ed567b4d70382cac1247f9fa07fbbe10650845ffb`.

## Run a prepared WIT package

The `native-wit-canonical-task-v1` release contains its own scheduler, Wasmtime runtime and compiled Lean exports. The [guest](../../tests/fixtures/wit-canonical-command/application.wat) imports only `ready`, `parked` and `release` from the public world. First, a Lean `Task.pure` wakes the guest while two other tasks are pending. Then it releases gate 2, waits for its result, and releases gate 1. The guest exits with another worker still parked. The expected result is `99999999999999983`; no application code calls a scheduler or transfers a native handle.

The [installation gate](../../tests/helpers/wit-canonical-command-package.mjs) verifies both receipts, checks the guest against the emitted WIT, moves each installation, verifies the loaded libraries, and runs it with no tools on its path. Run `npm run test:wit-canonical-package` with the publisher toolchain to build both routes. To replay, set `LEAN_BRIDGE_PREPARED_WIT_RELEASES` to a directory containing the `ordinary/` and `reviewed/` release handoffs, and `LEAN_BRIDGE_WASM_TOOLS` to wasm-tools 1.245.1. The gate uses wasm-tools to compile the test guest; the packaged runner takes the binary directly.

| Installed WIT archive | Bytes | SHA-256 |
| --- | ---: | --- |
| Ordinary Lean source | 60,912,455 | `e406668098c493bbdde92923b8360e9f4c57b8930b9c2b345da78f6224fb10e6` |
| Reviewed Binding IR and Lean source | 60,913,298 | `0b3d99b4f807069494af4f74f3535942dec80790f979ec514c1aef613754cdd9` |

A guest that starts no tasks returns `INT64_MIN` immediately. A core Wasm module, a component missing `run`, and a component requesting a private import are rejected. A guest that traps after opening a parked task exits nonzero without waiting for the Lean gate. These cases run inside each installed release.

Compatibility check: an offline-installed CLI built `Immediate.ready` again without `asyncAbi`. Its receipt selected `native-wit-task-v1`; the archive bundled Wasmtime 42.0.1. A C client linked against the installed header and libraries started the task, awaited `READY`, and received `INT64_MIN`.
