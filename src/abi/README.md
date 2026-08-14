# ABI contracts

This directory compiles host-neutral Binding IR semantics into closed adapter plans. A plan tells a generator how to cross the private component boundary without choosing JavaScript, PHP, Python, Rust, or another host syntax.

## Data flow

```text
validated Binding IR declaration
             |
             v
       ABI plan compiler
             |
             v
versioned, bounded adapter record
             |
             v
 language generator and private runtime
```

Each compiler returns data that can be validated, hashed, tested, and rendered by several backends. Invalid or unsupported semantics produce a domain-specific error before package generation.

## Module map

| Module | Contract |
|---|---|
| [`value-frame.mjs`](value-frame.mjs) | Compiles copied values into a bounded frame plan and emits the matching C header. |
| [`resource-lifecycle.mjs`](resource-lifecycle.mjs) | Defines identity-bearing resources, ownership, borrows, retention, disposal, and stale-use behavior. |
| [`callback-signature.mjs`](callback-signature.mjs) | Compiles fixed callback signatures, nesting bounds, and callback lifetime. |
| [`pending-operation.mjs`](pending-operation.mjs) | Defines asynchronous operation creation, settlement, cancellation, and release. |
| [`error-envelope.mjs`](error-envelope.mjs) | Defines declared failures, supported payload values, unexpected errors, and containment. |
| [`iterator.mjs`](iterator.mjs) | Compiles synchronous and asynchronous iterator plans, cursor ownership, pulls, return, and cancellation. |
| [`initialization.mjs`](initialization.mjs) | Defines runtime and component initialization order and exactly-once state. |
| [`overload.mjs`](overload.mjs) | Resolves a closed overload set without exposing generic runtime dispatch. |
| [`generic-specialization.mjs`](generic-specialization.mjs) | Expands declared finite generic specializations into direct named callables. |

## Invariants

- Every adapter kind and ABI version is explicit.
- Copied inputs and outputs have declared size and depth limits.
- Identity-bearing values retain nominal kind, runtime identity, slot, and generation checks.
- Explicit disposal defines correctness. Finalization only recovers abandoned host wrappers.
- Callback and pending-operation records define release on success, failure, cancellation, and shutdown.
- Declared failures remain distinguishable from bridge or runtime failures.
- Generators receive direct callable plans. The public API never needs a generic dispatcher.

## Changing an adapter

1. Update the relevant Binding IR validation if the semantic input changes.
2. Change the plan compiler and its versioned output.
3. Update every backend that consumes the plan.
4. Add positive, rejection, lifecycle, and generated-surface tests.
5. Regenerate or update evidence only after the executable tests pass.

Focused tests live under [`../../tests/internal/abi`](../../tests/internal/abi/). Cross-language behavior is checked by [`../../tests/binding-semantic-parity.test.mjs`](../../tests/binding-semantic-parity.test.mjs) and [`../../tests/public-surface-conformance.test.mjs`](../../tests/public-surface-conformance.test.mjs).

See the [native binding contract](../../docs/architecture/native-bindings.md), [direct-call conformance evidence](../../docs/evidence/direct-call-conformance.md), and [typed value-frame evidence](../../docs/evidence/typed-value-frame.md).
