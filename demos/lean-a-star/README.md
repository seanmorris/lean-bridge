# Proven Lean A* search

This demo compiles a generic directed, nonnegative weighted-graph search from Lean to WebAssembly. Every accepted request returns a lowest-cost path or a proof that no path exists. The browser turns editable terrain into a graph and compares A* with the same solver using a zero heuristic.

## Interaction

Both maps show the same terrain. Paint walls, floor, forest, or water on either map. Place the source and destination with their tools. Lean recomputes both routes after each edit. Route cost counts the terrain entered, not the starting tile. The explored overlays show vertices actually removed from each search frontier, including the goal.

The estimate is a fraction of Manhattan distance. Each traversable move costs at least one, so the estimate stays consistent at every offered strength. At zero strength, A* uses Dijkstra's priority. A stronger estimate can reduce the region searched; the route still has the same minimum cost. Different equal-cost routes are valid.

## Graph API

```js
import { prepareSearch } from "./runtime.mjs";

const search = await prepareSearch({
  vertexCount: 3,
  offsets: new Uint32Array([0, 2, 3, 3]),
  targets: new Uint32Array([1, 2, 2]),
  weights: new Uint32Array([1, 5, 1]),
  heuristic: new Uint32Array([2, 1, 0]),
  start: 0,
  target: 2
});
const result = search();
// { kind: "path", cost: 2, path: Uint32Array([0, 1, 2]),
//   expanded: Uint32Array([0, 1, 2]), usedFallback: false }
search.dispose();
```

Preparation copies the inputs and asks Lean to check the graph and heuristic. Handles have independent storage. Calls are synchronous after preparation; returned arrays own their data. Disposal is idempotent and subsequent use throws. `solveGraph(request)` prepares, searches, and disposes in one call. `solveGraphTotal(request)` exercises the reference fallback directly and is intended for small diagnostic graphs.

An unreachable result has `kind: "unreachable"`, an empty path, and cost zero. Invalid input throws during preparation. The two outcomes are distinct.

Vertices are numbered from zero. CSR offsets must be monotone, start at zero, and end at the edge count. Each row must have unique targets; the JS and C APIs reject parallel edges. Self-loops and zero-weight edges are supported. The source and goal must be in range. All arrays use `Uint32Array`, with vertex counts and heuristic values bounded by `2³¹−1`. The wire format also requires `(maximumWeight + 1) × (vertexCount + 1) ≤ 2³¹−1`.

The JavaScript wrapper rejects input or output buffers exceeding the Wasm32 allocation range before calling the allocator.

## Algorithm and proofs

The binary heap orders by `g + h`, then larger `g`, then vertex id. Search discards stale entries, closes each vertex once, and stops when it removes the goal. Preparation checks `h(goal) = 0` and `h(u) ≤ weight(u,v) + h(v)` for every edge. `consistent_admissible` proves that these conditions make the estimate a lower bound on every route to the goal.

For a candidate with cost `C`, the certificate uses labels `L(v) = min(g(v), C − h(v))`, with natural-number subtraction. The consistency proof makes the cap itself feasible. Certification therefore scans outgoing edges only where `g(v) < C − h(v)`; other rows follow from the cap lemma. A checked path whose cost equals its goal label is globally shortest. An unreachable candidate supplies a set containing the source, excluding the goal, and closed under every outgoing edge.

The executable solver retains those checks. If a candidate fails them, it runs a constructive reference solver that removes vertices as it explores simple paths. Its proof removes repeated vertices from arbitrary walks without increasing cost, then proves that the selected path is globally shortest or that no walk exists. Recursion strictly decreases the remaining vertex-list length. This fallback is exponential in the worst case; it is not the benchmarked heap path. Ordinary runtime tests assert that it is not used.

The combined solver has these checked guarantees:

- `solve_total`: every well-formed graph with a valid heuristic prepares and returns a correct result, without a successful-search premise.
- `solve_path_shortest`: every returned path is valid and costs no more than any alternative walk.
- `solve_unreachable`: an unreachable result means no walk connects the source and goal.
- `exported_search_correct`: those guarantees cover the exact serialized function called by the C bridge.
- `searchLoop_stale`: discarding a stale heap entry changes no search-state field.

The guarantees concern the generic graph received by Lean. The browser supplies terrain costs, endpoints, and coordinates. The C adapter owns memory copying; the page owns rendering and editing.

`DijkstraCore.lean` and `Dijkstra.lean` are build-generated copies of the maintained graph specification and path lemmas in `../lean-dijkstra/`. Edit the maintained files, then rebuild. The A* core, heuristic lemmas, CSR checker proofs, reference solver, and export proofs live in this directory. All seven source modules appear in the checked receipt and both browser-checker payloads.

## Verification and performance

```sh
bash demos/lean-a-star/build.sh
node --test demos/lean-a-star/test.mjs
node demos/lean-a-star/benchmark.mjs --assert
```

Tests compare both compiled paths against Bellman–Ford for all 512 three-vertex directed graphs and all nine source/goal pairs. They also cover random weighted graphs with nonzero consistent heuristics, zero-weight cycles, stale entries, early exit, large costs, invalid inputs, independent handles, and disposal.

The browser benchmark compares Lean A* with an independent typed-array JavaScript A* on the same graph, heuristic, tie breaks, and output shape. Both stop at the goal. Setup and heuristic validation occur before timing. Five excluded samples warm both implementations; adaptive batches avoid timer-resolution artifacts. Every measured pair must agree on cost, route, and expansion order. The page's A*-versus-Dijkstra comparison is separate from this implementation benchmark.

On the development machine, the 1,008-vertex browser benchmark measured a 0.74 ms Lean median versus 0.13 ms JavaScript, with a 1.10 ms Lean p95. These measurements are from Chromium on September 7, 2026; the page measures the current browser again.

## Sources

The algorithm follows [Hart, Nilsson, and Raphael, 1968](https://doi.org/10.1109/TSSC.1968.300136), with [their 1972 correction](https://cse.sc.edu/~mgv/csce580sp15/astarHNR1972.pdf) explaining consistency and closed vertices. The implementation and proofs are repository code. Shared shortest-path lemmas originate in this repository's [Dijkstra proof port](../lean-dijkstra/README.md).
