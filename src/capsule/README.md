# Capsule graph

Capsules describe independently built components and their dependencies before runtime loading or final composition.

- [`contract.mjs`](contract.mjs) validates capsule identity, artifacts, runtime requirements, dependencies, and initialization metadata.
- [`node.mjs`](node.mjs) constructs immutable graph nodes used by resolvers and loaders.

Capsules reference component artifacts. They do not contain host-language projection policy or a private runtime.

See the [capsule graph evidence](../../docs/evidence/capsule-graph.md) and [recommended architecture](../../docs/architecture/architecture.md).
