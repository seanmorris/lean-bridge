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

The [instrumented component pair](../../tests/helpers/wit-canonical-fixture.mjs) explicitly asks the producer to deliver and opens one channel at a time. The test does **not** establish automatic scheduling of multiple pending operations, propagation of reader abandonment to a Lean task, delivery from a Lean pull cursor through a canonical stream, or a generated installable canonical-async package.
