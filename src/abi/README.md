# ABI contracts

This directory defines host-neutral plans for values and effects that cross a generated component boundary.

## Owned contracts

- [`value-frame.mjs`](value-frame.mjs) describes bounded copied-value frames.
- [`resource-lifecycle.mjs`](resource-lifecycle.mjs) defines identity, ownership, and release behavior.
- [`callback-signature.mjs`](callback-signature.mjs) and [`pending-operation.mjs`](pending-operation.mjs) define callback and asynchronous delivery plans.
- [`error-envelope.mjs`](error-envelope.mjs) defines declared and unexpected failure records.
- [`iterator.mjs`](iterator.mjs), [`initialization.mjs`](initialization.mjs), [`overload.mjs`](overload.mjs), and [`generic-specialization.mjs`](generic-specialization.mjs) cover the remaining callable adaptations.

These modules validate and normalize semantic plans. Language syntax belongs in [`../backends`](../backends/README.md), while live host bookkeeping belongs in [`../runtime`](../runtime/README.md).

See the [native binding contract](../../docs/architecture/native-bindings.md) and [direct-call conformance evidence](../../docs/evidence/direct-call-conformance.md).
