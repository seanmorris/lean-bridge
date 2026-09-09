# Ownership and cleanup

Most ordinary-package calls return a number, string, boolean, or copied byte array. Those values need no Lean-specific cleanup. APIs that return a cache, bucket, or prepared solver also return a resource that must be released.

Use the release's public API to decide who owns a result. Do not add a runtime lifecycle to an API that does not expose one.

## Three lifetimes

| API result | Owner | End of lifetime |
| --- | --- | --- |
| A pure scalar or copied byte result | Application host value | Normal host memory management. |
| A prepared local solver, cache, or bucket | The caller that created it | Its public `dispose()` method. |
| The initialized shared runtime module | Its JavaScript realm and module graph | End of that realm, such as worker termination. |

Reviewed native and managed packages can expose other resource wrappers. Use the cleanup operation in that language's generated API, such as an explicit close operation or a scoped wrapper. The [consumer guides](../consume.md) show the appropriate pattern for each release profile.

## Release a prepared solver

This repository-local example owns an immutable graph until the query is finished. Run it from the checkout root with the maintained Dijkstra artifacts present:

```js
import { prepareShortestPath } from './demos/lean-dijkstra/runtime.mjs';

const solve = await prepareShortestPath({
  vertexCount: 2,
  offsets: Uint32Array.of(0, 1, 1),
  targets: Uint32Array.of(1),
  weights: Uint32Array.of(7)
});

try {
  console.log(JSON.stringify(solve(0, 1))); // [0,1]
} finally {
  solve.dispose();
}
```

The adapter snapshots the input before awaiting initialization and returns copied paths. Changing the original array afterward does not edit this prepared graph. Its `dispose()` is idempotent; calling the solver after disposal throws.

## Handle navigation during preparation

In a UI, keep an active flag or revision for the owner. If preparation finishes after that owner leaves, dispose the returned handle immediately. If preparation finishes while it is still active, retain the handle and release it in cleanup.

Do this for success and failure paths. A cancelled benchmark should not leave a prepared problem allocated. A resize observer, animation frame, timer, or pointer capture also needs an owner and cleanup even though it is not a Lean resource.

The React workbenches use [a scoped controller owner](../../demos/shared/workbench-scope.mjs) for these lifetimes. Its [unit tests](../../demos/shared/workbench-scope.test.mjs) cover late results and cleanup failures; the browser lifecycle checks exercise repeated navigation against the compiled adapters.

## Keep mutable state separate from snapshots

An LRU cache and a token bucket change after each operation. A prepared trace instead repeats a captured workload from its defined initial state. Those are different APIs even when they appear in the same demo.

Store application inputs for navigation restoration, not native resources. Recreate the resource through its public constructor and replay only the state the API permits. The [algorithm reference](../reference/algorithms.md) links each factory's exact contract.

Next, [check the integration](trust-boundaries.md) or read how [runtime sharing](shared-runtime.md) differs from resource ownership.
