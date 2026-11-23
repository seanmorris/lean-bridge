# Check a typed WIT task interface

A caller that starts `Meter.parked` gets an owned `parked-task`, not an integer handle. Polling or cancelling borrows that task. The readiness observation distinguishes `pending`, `ready(s64)`, `cancelled`, and `closed`. The other tasks in the same package have distinct resource types and their own result types.

The [Lean fixture](../../tests/fixtures/wit-tasks/Meter.lean) declares a gated `BaseIO (Task Int64)`, a release operation returning `BaseIO (Task Bool)`, and an immediate `Task UInt32`. The [world generator](../../src/backends/wit/task-model.mjs) reconciles the original compiler evidence and the complete public contract before emitting the WIT and its canonical-ABI forwarding component. These three exports do not declare failures. The generator rejects ungranted external native effects.

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

The embedding test exercises nominal task resources, not canonical Component Model `future<T>` or `stream<T>`, async iterators, or typed terminal errors. The separate [release test](../../tests/helpers/wit-task-package.mjs) exercises the [prepared package](../consume/wit-wasi.md#await-a-lean-task): run `npm run test:wit-task-package` with the same producer tools. It builds the ordinary and reviewed archives with an offline-installed CLI, verifies the receipt, relocates the installation, compiles a consumer with just the installed header and `pkg-config`, and runs with no producer tools on `PATH`.

### Installed package receipts

At [the first installed milestone](https://github.com/seanmorris/lean-bridge/commit/744f1a69f21f6299bba0e5827f5eb99d3a331a46), the release test extended Meter to 13 exports, including text with an embedded NUL, a Unicode scalar, fixed-width signed and unsigned integers, and both floating-point widths. This larger package has semantic Binding IR hash `4c334f37fb578f50245fea8f6775beb873ab167e776eb098c6ff6ab7f52867b7`. The prepared `lean-bridge@0.1.0-rc.1` CLI and the development CLI produced identical receipts for each route. These are local Linux x86-64 results using the glibc 2.36 test floor; they do not record a hosted build or a public release.

| Build | Archive bytes | Archive SHA-256 | Receipt SHA-256 |
| --- | ---: | --- | --- |
| Ordinary | 59,212,002 | `8c34b4f1197cd485c3d2adeef33821faee1aee8d20b5ec0e4fd5e136b6c7bc90` | `7840679f6c54ee80cadf0877960d37b0d11d13bb634a843f7629e54611384d8c` |
| Reviewed | 59,213,246 | `eada7ff2f979790ddd979862482407f1b55a1edba61fe8bbaf432e436825fac9` | `175d3ef79965f8ed1bf8b4ac6b3e54e615245c89b2eb68470c19e7da4ec6cd7a` |

The [consumer](../../tests/fixtures/wit-task-package/consumer.c) uses only the generated header and the standard C/POSIX library. It checks that a dropped reference cannot act on a new task, cancellation wins before delivery even if Lean already computed the value, a foreign session cannot borrow the task, and returned text survives store shutdown. A separate [fault-injection process](../../tests/fixtures/wit-task-package/retire.c) retires the runtime while the owner is waiting on a parked task and checks that closing the failed session releases its descriptor. The reviewed-result mismatch and the forbidden capability must each leave the release directory absent.

### Factory errors, returned values and worker failures

The [effect declarations](../../tests/fixtures/wit-task-package/effects.lean) extend the installed example to 16 exports. `Meter.phase` can throw the same `IO.userError` either before returning a task or inside its worker. Its WIT factory returns `result<own<phase-task>, string>`; the task's observation has a separate `failed(string)` case. `Meter.checked` instead returns nested `Except` values, including errors, as `ready(result<result<u32, string>, u32>)`. `Meter.branch` can throw either arm of `Except String UInt16` at startup.

| Route | Archive bytes | Archive SHA-256 | Receipt SHA-256 |
| --- | ---: | --- | --- |
| Ordinary | 59,230,016 | `647bc1932eb9b75e91b431dd38f2e8ac99e6d6a65a77319a076b9eb54a2ca21a` | `f4cc5fb72ebd86e7a1dece5a07b2a2cce7a93d081297480bab91360a3c0daccd` |
| Reviewed | 59,231,618 | `ffabfbe48b4ac02b1d85a74b4e2803f7800962f7d7a79aa419249b1177029d18` | `dde8c14eac1b7dffac40d977315286447982b7c763a90fa684d9ccc730442ced` |

Both receipts identify the same semantic Binding IR (`46bc5aa19c03ed457250b2b7e67192147800ce1e92897508e600c2f789f931c6`). Both archives contain the same validated binary component (`50b19e3201b5ed29757181a4e1fbfa6a0e26b9cac67221245d7dda6ebedb5750`). Run `npm run test:wit-task-package` to compile and execute the [installed C consumer](../../tests/fixtures/wit-task-package/effects.c) against each archive. It checks 260 rejected starts without exhausting a 256-slot store, embedded NUL and UTF-8 in owned errors, exactly-once delivery, and recovery. Cancellation can win before delivery even if the worker would have reported an error. The package gate passed both clean installs and rejected three altered reviews (value type, startup error type, missing worker failure) and an ungranted filesystem capability before producing an archive. These tests do not establish callback or stream support.
