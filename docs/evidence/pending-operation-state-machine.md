# Pending Operation State Machine Evidence

Status: the generated plan, shared-runtime state machine, and public Lean Promise settlement pass. Callback re-entry remains open.

## Generated contract

`compilePendingOperationV1` accepts a validated Binding IR declaration whose result mode is `promise`. It emits a closed plan with:

- stackless execution with an empty Wasm stack while work is pending;
- same-agent re-entry;
- exactly-once resolution, rejection, or cancellation;
- rejection of late settlement;
- reverse-order cleanup;
- cancellation as a terminal state;
- cancellation of pending work during runtime shutdown; and
- capture actions derived from copy, borrow, lease, or transfer ownership.

A copied parameter enters the pending record as a copied value. An identity-bearing borrow acquires an operation lease and releases it after settlement. The plan preserves the declared result ownership and chooses copied lifting, canonical borrowed projection, or canonical owned projection.

The compiler rejects non-Promise declarations and generic declarations that lack monomorphization metadata. It validates Binding IR before producing a plan and does not freeze or edit its input.

## Runtime state machine

`PendingOperationRegistry` belongs to one application runtime context. It assigns generation-safe tokens, enforces a configured capacity, and records one pending entry per operation. Resolution, rejection, and cancellation remove the entry before its promise continuation runs. A second settlement attempt receives `stale-pending-operation`.

Each pending entry owns a cleanup stack. The registry runs cleanup in reverse order before promise settlement. A cleanup failure converts a successful result into `pending-cleanup-failed` and retains the original cleanup error as the cause.

Runtime shutdown stops admission, cancels every pending entry, runs cleanup, closes the pending domain, and advances its epoch before the runtime completes shutdown.

## Executable checks

`tests/pending-operation.test.mjs` covers generated copied and identity captures, exact settlement, late settlement, cancellation, cleanup order, cleanup failure, capacity, and shutdown.

`tests/internal/abi/js-pending-operations.test.mjs` places the registry inside the same runtime context used by loaded libraries. It verifies shared diagnostics and shutdown cancellation.

`tests/library-loader.test.mjs` compiles a Promise declaration and pending adapter from Binding IR, loads a normal API object, calls `await api.roundTrip(value)`, settles through the private runtime hook, validates the copied result, and returns every pending counter to baseline. The public function contains no token or settlement argument.

`tests/internal/abi/lean-pending-operation.test.mjs` calls `api.deferBoxValue(value)` through a generated projection. The private C adapter schedules work with `emscripten_async_call` and returns. The callback later calls the Lean-generated `alpha_box` and `alpha_read` functions while the initiating Wasm frame count is zero, then resolves the JavaScript Promise through the runtime-owned pending registry.

The same test cancels a scheduled operation before the callback runs. The generated cancellation symbol marks the native record, the JavaScript Promise rejects once, and a second settlement receives `stale-pending-operation`. A shutdown case cancels the record before Lean finalization. The native callback observes the closed runtime, skips the Lean call, and releases its allocation.

## Remaining boundary

The POC private C adapter schedules the operation and calls existing Lean-generated exports. The Lean frontend does not yet emit an asynchronous declaration or its private adapter. The bridge also does not generate copied result frames for rich asynchronous results, callback signature adapters, `AbortSignal` projection, or nested callback frames. Those pieces must consume the same plan and state machine.
