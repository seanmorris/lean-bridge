# Host runtime coordination

This directory implements private host-side state used by generated projections. Its registries connect host values to Lean callbacks and pending operations without exposing transport handles through the generated public API.

## Architecture position

```text
generated host API
       |
       v
ABI adapter plan
       |
       +----> callback registry
       +----> pending-operation registry
       +----> weak identity map
       |
       v
private component transport
```

The [ABI modules](../abi/README.md) define callback, ownership, cancellation, and async semantics. Runtime registries execute the host-side part of those plans. A backend may adapt the same semantics to another host, but it should not invent a conflicting lifecycle.

## Callback registry

[`callbacks.mjs`](callbacks.mjs) provides `CallbackRegistry`. It assigns stable private handles to host callables, validates invocation state, permits defined re-entry, and releases entries when their ownership plan ends.

Registration, invocation, and release are separate operations. This prevents a callback from disappearing while Lean is executing it and makes repeated release or invocation-after-release a detectable contract error. The registry keeps transport identity private; generated methods accept and return ordinary host-language callables.

## Pending-operation registry

[`pending-operations.mjs`](pending-operations.mjs) provides `PendingOperationRegistry`. It tracks an asynchronous operation from creation through settlement, rejection, or cancellation. Terminal states reject later settlement so two completion paths cannot both win.

Cancellation records the requested transition and invokes the adapter-defined cleanup path. Registry removal occurs at the lifecycle point defined by the pending-operation plan, not merely when a host promise becomes unreachable.

## Weak identity map

[`weak-value-map.mjs`](weak-value-map.mjs) provides `WeakValueMap`. It supports identity lookup without forcing a host object to remain alive forever. Production use can rely on weak references and finalization when the host supplies them. Tests can inject deterministic substitutes so cleanup assertions do not depend on garbage-collector timing.

Weak cleanup is a fallback. Explicit `close()`, release, or cancellation remains the deterministic lifecycle boundary presented by generated APIs.

## Concurrency and re-entry rules

Registry mutations validate the current generation and lifecycle state before acting. A stale handle cannot target a newer entry that reused the same internal slot. Callback re-entry and pending settlement use explicit transitions so nested component calls remain observable and testable.

Do not move public data conversion into these registries. They coordinate identities and state; generated adapters own value conversion and error projection.

## Changing runtime behavior

Start with the corresponding ABI plan and write the lifecycle transition before changing a registry. Add tests for the success path, duplicate terminal action, stale identity, nested re-entry, explicit cleanup, and fallback cleanup. Then run the generated-backend tests that consume the registry so private changes do not leak into public declarations.

## Verification and evidence

[`../../tests/callback-runtime.test.mjs`](../../tests/callback-runtime.test.mjs), [`../../tests/pending-operation.test.mjs`](../../tests/pending-operation.test.mjs), and [`../../tests/weak-value-map.test.mjs`](../../tests/weak-value-map.test.mjs) cover the registries directly. Focused lifecycle and finalization cases live under [`../../tests/internal/abi`](../../tests/internal/abi/). The [generation-safe registry evidence](../../docs/evidence/generation-safe-registries.md), [callback evidence](../../docs/evidence/callback-signature-plan.md), and [pending-operation evidence](../../docs/evidence/pending-operation-state-machine.md) record the corresponding behavior.
