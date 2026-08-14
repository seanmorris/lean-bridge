# Host runtime coordination

This directory implements private host-side state shared by generated projections.

- [`callbacks.mjs`](callbacks.mjs) manages callback registration, re-entry, and release.
- [`pending-operations.mjs`](pending-operations.mjs) tracks asynchronous settlement and cancellation.
- [`weak-value-map.mjs`](weak-value-map.mjs) supports weak identity lookup with deterministic substitutes for tests.

Generated public APIs hide these records. Explicit ownership and close operations remain authoritative; weak cleanup provides a fallback path.

See the [generation-safe registry evidence](../../docs/evidence/generation-safe-registries.md), [callback evidence](../../docs/evidence/callback-signature-plan.md), and [pending-operation evidence](../../docs/evidence/pending-operation-state-machine.md).
