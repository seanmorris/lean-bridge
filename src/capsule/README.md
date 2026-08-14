# Capsule graph

This directory defines the component graph records used before runtime loading or final composition. A capsule describes one independently built component. A graph lock fixes a set of capsules and their dependency order.

## Architecture position

```text
component artifact manifest
          |
          v
       capsule  <---- dependency identities
          |
          v
      graph lock
          |
          +----> runtime loader
          +----> composition and package checks
```

Capsules connect artifact identity to runtime requirements without embedding host-language projection policy. They let loaders reason about initialization order, shared runtime compatibility, and dependency closure before entering component code.

## Modules

[`contract.mjs`](contract.mjs) validates capsules and graph locks and resolves dependency order. Validation covers component identity, artifact references, runtime requirements, dependency edges, initialization metadata, and closed record shapes.

[`node.mjs`](node.mjs) reads a locked graph, verifies capsule and Binding IR digests, and supplies canonical JSON and SHA-256 helpers. It returns the dependency-first view produced by the contract resolver.

## Capsule and graph-lock roles

A capsule answers questions about one component:

- Which artifact does this node load?
- Which runtime profile does it require?
- Which named components must already be available?
- Which initialization entrypoint and metadata apply?

A graph lock answers questions about the complete load set:

- Which exact capsule versions and hashes are selected?
- Does every dependency resolve to one locked node?
- Is the graph acyclic and deterministic?
- In what order can the runtime initialize nodes?

Resolution rejects missing nodes, identity mismatches, duplicate identities, and dependency cycles. It returns dependency-first order so a loader does not infer ordering from filesystem or object iteration behavior.

## Boundaries

Capsules reference built artifacts. They do not contain the artifact bytes, generated consumer API, registry coordinates, or private host runtime implementation. Binding semantics remain in the [Binding IR](../binding-ir/README.md), build output identity remains in [`../build`](../build/README.md), and registry layout remains in [`../release`](../release/README.md).

Treat graph-lock changes as artifact identity changes. A dependency update can alter initialization and composition even when the root component bytes remain unchanged.

## Extending the contract

Add a field only when loaders or composition checks need it to make a deterministic decision. Update the capsule or graph-lock schema, runtime validation, canonical hashing fixtures, and both valid and invalid graph tests together. A new dependency relation also needs cycle, missing-node, and stable-order cases.

## Verification and evidence

[`../../tests/capsule-contract.test.mjs`](../../tests/capsule-contract.test.mjs) covers record validation and graph resolution. [`../../tests/lean-graph-lock.test.mjs`](../../tests/lean-graph-lock.test.mjs) exercises the real Lean fixture. The [capsule graph evidence](../../docs/evidence/capsule-graph.md) records the executed graph, while the [recommended architecture](../../docs/architecture/architecture.md) explains why components retain independent identities.
