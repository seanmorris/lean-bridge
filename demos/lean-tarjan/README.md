# Proven Lean strongly connected components

Tarjan's algorithm groups a generic directed graph into strongly connected components. Two vertices belong to the same component exactly when each can reach the other. The implementation, certificate checker, and total reference solver compile from Lean to WebAssembly.

## Interaction

The demo shows module imports. An arrow points from the importing module to the module it imports. Select a module and toggle its outgoing imports in the sidebar. Drag cards to rearrange them, rename modules, or add and remove modules.

The initial graph contains several separate cycles. Adding the suggested feedback import connects a downstream module back to an upstream module, merging the groups along that path. Removing it splits them again. Select **Collapse groups** to replace each component with one card. The remaining arrows form a directed acyclic graph. Unfolding preserves the original graph and card positions.

## Generic graph API

```js
import { prepareGraph } from "./runtime.mjs";

const solve = await prepareGraph({
  vertexCount: 4,
  offsets: new Uint32Array([0, 1, 3, 4, 4]),
  targets: new Uint32Array([1, 0, 2, 3])
});
const result = solve();
// labels: Uint32Array([0, 0, 2, 3])
// components: [Uint32Array([0, 1]), Uint32Array([2]), Uint32Array([3])]
// condensation: Uint32Array([0, 2, 2, 3])
// componentCount: 3, usedFallback: false
solve.dispose();
```

Vertices are numbered from zero. CSR offsets must contain `vertexCount + 1` entries, start at zero, be monotone, and end at the edge count. Every target must be in range. Empty graphs, self-loops, and duplicate edges are supported. The JavaScript API requires `Uint32Array` inputs and rejects counts or buffer sizes outside the Wasm32 representation limits before allocation.

Preparation snapshots the input and builds the reverse CSR once. Each prepared handle owns independent storage. Solving is synchronous after preparation; returned arrays own their data. Disposal is idempotent, and subsequent use throws. `solveGraph(request)` prepares, solves, and releases in one call. `solveGraphTotal(request)` exercises the cubic reference directly and is intended for small diagnostic graphs.

Labels use each component's smallest original vertex. Members and components are sorted by vertex number. Condensation edges are unique, lexicographically sorted pairs of representative IDs, not dense component indices. Lean returns the labels and fallback flag; JavaScript groups the labels and projects the original edges for display.

## Algorithm and proofs

The candidate search is iterative Tarjan, with separate discovery indices, low-link values, active-component stack, and DFS frames. An edge to a new vertex starts a DFS frame. An edge to an active vertex lowers the current low-link using the target's discovery index. Edges to completed components do not lower it. Returning from a child propagates the child's low-link. A vertex whose low-link equals its index closes a stack prefix as one component.

For each candidate component, Lean builds a forward and reverse spanning tree rooted at its representative. Every nonroot tree entry includes its parent, a strictly decreasing rank toward the root, and an index witnessing the corresponding input edge. Cross-component edges must strictly decrease component exit order. The executable checker scans these conditions in `O(V + E)` time.

Ranked trees prove mutual reachability within each group. Decreasing exit order proves that mutually reachable vertices cannot be separated into different groups. Together they establish the exact SCC partition. If a candidate fails certification, a proved cached Boolean Floyd–Warshall solver computes the complete reachability relation and returns its mutual-reachability classes. Its matrix stages use `O(V³)` time and `O(V²)` space; initializing the matrix from CSR adds `O(V · E)` time. Ordinary tests and timed benchmarks require the Tarjan candidate to pass without fallback.

The proof covers the combined executable solver. Local index, low-link witness, and stack-pop lemmas describe the real Tarjan transitions; they are not a complete invariant proof of the unchecked Tarjan loop. The certificate checker and total reference supply the unconditional output guarantee.

The checked theorems include:

- `solve_total`: every well-formed graph prepares and returns an exact SCC partition, without a successful-search or fuel premise.
- `exported_same_iff`: equality of the exact serialized labels returned through the FFI is equivalent to mutual reachability.
- `solve_maximal`: every returned group is nonempty, strongly connected, and maximal under inclusion.
- `condensation_acyclic`: collapsing the components excludes every nonempty directed cycle.
- `condensation_edge_projects` and `condensation_walk_reachable`: cross-group edges are preserved, and quotient paths correspond to original reachability.
- `discover_assigns`, `lowerLink_preserves_reachable_witness`, and `popThrough_preserves_uniqueness`: discovery, low-link updates, and component-stack popping preserve their stated local properties.

All six source modules appear in the syntax-highlighted viewer, build receipt, and both browser checker bundles. The receipt hashes the exact checked sources. Proofs use only Lean's standard logical foundations, with no unchecked declarations. Module names, card coordinates, editing, memory copying, and rendering are adapter code.

## Verification and performance

```sh
bash demos/lean-tarjan/build.sh
node --test demos/lean-tarjan/test.mjs
node demos/lean-tarjan/benchmark.mjs --assert
```

Tests compare the compiled solver with an independently implemented SCC oracle. The browser benchmark uses a typed-array JavaScript Tarjan baseline on the same prepared graph and returns the same labels, groups, and condensation edges. Preparation is outside timing; Lean certification and both implementations' result materialization remain inside. Five excluded samples warm both implementations before 100 measured pairs. Adaptive batching avoids timer-resolution artifacts.

The suite covers all 66,067 directed graphs through four vertices, including self-loops, with both compiled solvers checked against Kosaraju. It also covers 120 random multigraphs, 10,000-vertex paths and cycles, 65,536 isolated vertices, invalid requests, independent handles, immediate caller mutation, and disposal. Adapter tests cover feedback merging, stable editor IDs, distinct group colors, and nonoverlapping collapsed layouts through 24 groups.

Chromium on the development machine measured a 0.72 ms Lean median and 0.86 ms p95 against a 0.13 ms JavaScript median for 1,024 vertices and 4,032 edges, a 5.5× relative cost. These measurements were taken on September 7, 2026; the page measures the current browser again. The certificate remains inside the timed Lean call. An ownership fix removed quadratic array copying from certificate construction, improving the initial Node median from 8.99 ms to 0.80 ms. The performance gate checks both absolute time and relative cost to catch that regression.

## Sources

The algorithm follows [Tarjan and Zwick's account of strong components](https://arxiv.org/pdf/2201.07197), including the index/stack formulation and component exit order. [Chen, Cohen, Lévy, Merz, and Théry's formalizations](https://doi.org/10.4230/LIPIcs.ITP.2019.13) and the [Rocq Tarjan implementation](https://github.com/rocq-community/tarjan/blob/master/theories/tarjan_num.v) provide proof references. This directory contains a new Lean implementation and certificate-based proof, not a line-for-line translation of those developments.
