# Check a typed WIT task interface

A caller that starts `Meter.parked` gets an owned `parked-task`, not an integer handle. Polling or cancelling borrows that task. The readiness observation distinguishes `pending`, `ready(s64)`, `cancelled`, and `closed`. The other tasks in the same package have distinct resource types and their own result types.

The [Lean fixture](../../tests/fixtures/wit-tasks/Meter.lean) declares a gated `BaseIO (Task Int64)`, a release operation returning `BaseIO (Task Bool)`, and an immediate `Task UInt32`. The [world generator](../../src/backends/wit/task-model.mjs) reconciles the original compiler evidence and the complete public contract before emitting the WIT and its canonical-ABI forwarding component. It refuses declared failures, unsupported payloads, and external native effects in this projection.

## Reproduce

Set `LEAN_BRIDGE_LEAN_PREFIX` to the Lean 4.32.2 installation and `LEAN_BRIDGE_WASM_TOOLS` to the wasm-tools 1.245.1 executable. Run `npm run test:wit-task-world`. Set `LEAN_BRIDGE_WIT_TASK_WORLD_EVIDENCE` to a new directory to retain each route's checked inputs and outputs.

The [driver](../../tests/helpers/wit-task-resource-world.mjs) first builds from configured Lean exports. It then removes the explicit export list, supplies a reviewed Binding IR file, takes a new Lake snapshot, and compiles again. For each route it parses and validates the binary and runs `wasm-tools component targets world.wit component.wasm`. Swapping the borrowed task type in the advertised poll operation must fail that last check. Changing the reviewed scalar result or claiming a filesystem capability must also fail before emitting a new world.

| Artifact | SHA-256, ordinary and reviewed |
| --- | --- |
| Public Binding IR (semantic hash) | `267a646a1418db0fc51e481029dfbb75cb1bb1bc43c7284e92036d6cc1353277` |
| WIT world | `4a1f172c47d0e4e7fa56f2961679bd1fb9f033f0abd7dff2bec4cb26ce0cedda` |
| Binary component | `be64a9169ee1661ef2e8685a657ee051cb4ad6c0f40e0fb326ac6c32915f2334` |

## Run the task through Wasmtime

On Linux x86-64, set `LEAN_BRIDGE_WASMTIME_C_API` to the extracted Wasmtime 42.0.1 C SDK. With the same Lean and wasm-tools settings, run `npm run test:wit-task-host`. The test builds the shared native Lean runtime once. To reuse one, set `LEAN_BRIDGE_WIT_TASK_RUNTIME` to its directory containing `runtime.json`; the test verifies its contents and compiler commit before linking. The optional evidence directory also retains the compiled consumer, generated imports, and per-route hashes.

The [embedding test](../../tests/fixtures/wit-tasks/host.c) loads the component above and invokes its **exports** in a Wasmtime store. The [generated imports](../../src/backends/wit/task-host.mjs) start real Lean tasks. A second store can resolve the Lean promise but cannot borrow the first store’s task. The host waits on a borrowed Linux descriptor for either completion or runtime retirement; it does not spin, and Lean workers do not call into Wasmtime.

| Operation | Observable behavior |
| --- | --- |
| Poll a parked task | Returns `pending`; another poll reuses the same readiness descriptor. Resolving the promise wakes the host. |
| Poll a completed task | Returns `ready(value)` exactly once, then `closed`. The consumer checks signed 64-bit minimum and unsigned 32-bit wraparound. |
| Cancel before delivery | The first request returns `true`; a second returns `false`. Poll reports `cancelled` once, then `closed`. A late Lean result is not delivered. |
| Drop or shut down | Wasmtime’s resource destructor releases the native owner. Closing the store also releases outstanding tasks, even after a failed call. A descriptor borrowed from a disposed task is no longer valid. |
| Retire the runtime | A pending wait wakes even without a result. Poll fails; the host tears down the store and its readiness subscription. |

This is an embedding test, not yet an installable downstream WIT task package. It exercises nominal task resources; it does not implement canonical Component Model `future<T>` or `stream<T>`, async iterators, or typed terminal errors.
