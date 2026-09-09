# Dijkstra on a delivery graph

Dijkstra chooses a least-cost route through a graph with nonnegative edge weights. In this example, a depot can send a delivery through a hub or take a more expensive direct connection. The same core can route through a maze, but nothing in the Lean API requires a grid.

For the interactive version, open [Dijkstra's workbench](../../demos/lean-dijkstra/index.html). The example below uses its local compiled adapter from a repository checkout.

## Describe four locations

Use IDs 0 for the depot, 1 for the hub, 2 for a transfer stop, and 3 for the destination. Costs use one consistent integer unit.

| From | To | Cost |
| --- | --- | --- |
| Depot (0) | Hub (1) | 2 |
| Depot (0) | Transfer (2) | 9 |
| Hub (1) | Transfer (2) | 1 |
| Hub (1) | Destination (3) | 8 |
| Transfer (2) | Destination (3) | 3 |

The route `0 → 1 → 2 → 3` costs 6. The alternatives through `0 → 1 → 3` and `0 → 2 → 3` cost 10 and 12.

## Call the compiled core

With the demo artifacts present, run this JavaScript from the checkout root:

```js
import { prepareShortestPath } from './demos/lean-dijkstra/runtime.mjs';

const solve = await prepareShortestPath({
  vertexCount: 4,
  offsets: Uint32Array.of(0, 2, 4, 5, 5),
  targets: Uint32Array.of(1, 2, 2, 3, 3),
  weights: Uint32Array.of(2, 9, 1, 8, 3)
});

try {
  console.log(JSON.stringify(solve(0, 3))); // [0,1,2,3]
  console.log(JSON.stringify(solve(3, 0))); // []
} finally {
  solve.dispose();
}
```

`offsets` splits the target and weight arrays into rows. Vertex 0 owns entries 0 and 1; vertex 1 owns entries 2 and 3; vertex 2 owns entry 4; vertex 3 has no outgoing edges. Edges are directed, so this graph has no return route from 3 to 0.

The returned path contains both endpoints. Equal-cost routes can have different valid paths; do not require a particular tie-breaking order unless the API promises one.

## What the proof establishes

The optimized search constructs distances and predecessors. Before returning a path, Lean checks that the source label is zero, labels satisfy the edge inequalities, the route is a valid walk, and its cost equals the target label. Those facts establish that no alternative walk is cheaper.

`dijkstraCsr_correct` connects the CSR implementation to the shortest-path specification. Its result guarantee is about returned paths. Although the second query above returns an empty array, this theorem does not establish a general equivalence between empty output and an unreachable target. The [source guide](../../demos/lean-dijkstra/README.md) states that distinction explicitly.

The [generated reference](../reference/algorithms.md#lean-dijkstra) keeps the selected theorems and adapter exports aligned with the receipt. The [proof source](../../demos/lean-dijkstra/Dijkstra.lean) contains the certificate lemmas and the CSR correctness theorem.

## Model the application correctly

Weights must be nonnegative and fit the adapter's unsigned 32-bit representation. Zero-weight edges are allowed. Duplicate targets within a row are rejected. Validate domain values before constructing typed arrays so conversion cannot silently wrap invalid numbers.

To model a wall or closed road, omit the corresponding transition. To model a one-way road, add only its permitted direction. The application retains names and coordinates and maps the returned vertex IDs back to them.

## Verify and continue

The documentation tests execute the unmodified example against the maintained compiled binary and compare the stated outputs. The [demo tests](../../demos/lean-dijkstra/test.mjs) exercise invalid inputs, independent result comparisons, and prepared ownership. Reproduce the artifact with the [demo build instructions](../../demos/README.md#reproduce-a-demo).

Next, [add capabilities to a graph](flood-fill.md), [read the cost comparison](benchmarks.md), or [plan an application pilot](adoption.md).
