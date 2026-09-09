# Reuse the algorithm, not the screen

The demos turn an application problem into a compact input for a generic Lean algorithm. The webpage can change without turning the proof into a grid proof, a drawing proof, or a React proof.

A delivery network and a maze both become a graph. Their vertex labels, units, and editing controls differ; the shortest-path algorithm receives vertices, directed edges, and costs.

## Keep the model explicit

| Application concept | Generic input | Application responsibility |
| --- | --- | --- |
| A location or walkable tile | A vertex ID | Keep an ID-to-domain-object mapping. |
| A permitted move or connection | A directed edge | Add only moves the application allows. |
| Travel time or terrain cost | A nonnegative weight | Choose units and represent them consistently. |
| A lock or permission | A capability requirement | Decide who grants it and whether it can be reused. |
| A permanent obstacle | An omitted or disabled vertex/edge | Prevent the adapter from adding a forbidden transition. |

A wall does not require a special wall theorem in Lean. The graph adapter omits the transition. A one-way ledge needs directed edges, not a different reachability algorithm.

## Store a sparse graph

Compressed sparse rows (CSR) group outgoing edges by source vertex. `offsets[v]` and `offsets[v + 1]` delimit vertex `v`'s slice of `targets`. A parallel `weights` array supplies edge costs when the algorithm needs them.

The [Dijkstra walkthrough](dijkstra.md) builds four vertices and five edges in this format. The [flood-fill walkthrough](flood-fill.md) adds capability requirements without changing the underlying vertex model.

Algorithms differ in their input contracts. Dijkstra rejects duplicate targets within a row; another graph API may accept parallel edges. Read the particular adapter's validation instead of assuming every graph-shaped API accepts the same data.

## Keep domain objects outside the core

Use integer IDs at the boundary, then map returned IDs back to deliveries, modules, rooms, or records. Avoid copying names and presentation state into every solver call when only the connectivity matters.

For repeated queries over an unchanged graph, use a prepared solver if the adapter provides one. Preparation snapshots the graph once. A changed graph needs a new snapshot; dispose the old solver when its owner is finished. [Ownership and cleanup](ownership.md) shows this lifecycle.

## Choose another core

Topological sort accepts dependencies and returns a legal order or cycle. Aho–Corasick accepts patterns and byte sequences. Myers accepts token sequences. Sweep-and-prune accepts box coordinates. None of these cores needs the corresponding workbench's display model.

The [API reference](../reference/algorithms.md) derives its function lists from those adapters. It links the source contract and proof receipt for each algorithm.

Next, run the small [delivery graph](dijkstra.md), or use the [adoption checklist](adoption.md) to define your own boundary.
