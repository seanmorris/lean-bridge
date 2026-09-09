# Flood fill with keys and permissions

Flood fill answers which vertices are reachable through allowed directed edges. Capability closure repeats that question as reachable vertices grant reusable capabilities. The room demo uses keys and doors; the generic algorithm can also model staged access in another graph.

The distinction is useful: “what can I reach with what I already have?” differs from “what can I eventually reach if I collect every available grant?”

## Follow a five-location chain

Locations 0 through 4 form a directed chain. Location 1 grants Fern (capability 0); location 3 grants Sun (capability 1). Moving from 1 to 2 requires Fern, and moving from 3 to 4 requires Sun.

With no keys marked as held, ordinary reachability stops at location 1. Automatic closure can collect Fern there, reach Sun at location 3, then reach location 4.

| Stage | Held capabilities | Reachable locations |
| --- | --- | --- |
| Initial reachability | None | 0, 1 |
| Collect Fern | Fern | 0, 1, 2, 3 |
| Collect Sun | Fern, Sun | 0, 1, 2, 3, 4 |

## Run both questions

From the repository root with the compiled flood-fill artifacts present:

```js
import { reachable, reachableWithCapabilities } from './demos/lean-flood-fill/runtime.mjs';

const graph = {
  vertexCount: 5,
  offsets: Uint32Array.of(0, 1, 2, 3, 4, 4),
  targets: Uint32Array.of(1, 2, 3, 4),
  allowedVertices: Uint32Array.of(1, 1, 1, 1, 1),
  start: 0
};

const available = await reachable({
  ...graph,
  allowedEdges: Uint32Array.of(1, 0, 1, 0)
});
console.log(JSON.stringify(Array.from(available))); // [0,1]

const closure = await reachableWithCapabilities({
  ...graph,
  capabilityCount: 2,
  requirements: Uint32Array.of(2, 0, 2, 1),
  grants: Uint32Array.of(2, 0, 2, 1, 2),
  initialCapabilities: new Uint32Array()
});
console.log(JSON.stringify(Array.from(closure.vertices))); // [0,1,2,3,4]
console.log(JSON.stringify(Array.from(closure.capabilities).sort((left, right) => left - right))); // [0,1]
```

Requirements align with edges; grants align with vertices. The value equal to `capabilityCount` means no requirement or no grant. Here 2 is the sentinel, while 0 and 1 are real capability IDs. Eligibility arrays use zero or one. Capabilities form a set; the example sorts them only to make the printed result stable.

## What the proof establishes

`floodFillCsr_correct` says the returned set contains a vertex exactly when an enabled directed walk reaches it from the start. It covers both directions: every reported vertex is reachable, and every reachable vertex is reported.

`capabilityClosureCsr_correct` adds stability and leastness. The final set includes the starting capabilities and every grant on reachable vertices. Recomputing reachability and collecting those grants adds nothing further. Among stable sets extending the initial capabilities, this result is least by inclusion.

Leastness matters for a locked cycle. A key behind its own locked door cannot justify granting itself. The algorithm grows from the supplied starting capabilities; it does not assume a convenient larger set.

The [proof source](../../demos/lean-flood-fill/FloodFill.lean) establishes these properties for the optimized CSR core. The [generated reference](../reference/algorithms.md#lean-flood-fill) links the receipt and exported functions.

## Interpret the room editor

In the [workbench](../../demos/lean-flood-fill/index.html), marking a reachable key as found changes the manually held inventory. Automatic pickup answers the eventual-closure question. Clearing keys returns to the initial inventory; it does not remove key placements from the map.

Walls disable movement. A one-way ledge removes the forbidden directed transition. A corner ledge restricts two cardinal directions, such as up and left; it does not add diagonal motion. Doors and tiles remain an application adapter for the graph.

Capabilities are reusable and never consumed. A puzzle with single-use keys, mutually exclusive choices, or a key that disappears needs a richer state model. Do not interpret this closure as a solver for those different rules.

## Verify and continue

Documentation tests execute the example against compiled Lean and check all three outputs. The [demo suite](../../demos/lean-flood-fill/test.mjs) adds independent reachability and closure comparisons. The room editor's browser checks separately cover key placement, ledges, doors, and navigation restoration.

Next, [check your graph adapter](trust-boundaries.md), [reuse the core](reusable-cores.md), or [inspect the live benchmark](benchmarks.md).
