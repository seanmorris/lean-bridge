# Algorithm API and proof reference

The twelve demos expose graph, sequence, cache, limiter, and geometry adapters independently of their webpages. These local adapters are repository artifacts, not published npm algorithm packages. To use a prepared library release, start with [package consumption](../consume.md).

This catalog is generated from the demo manifest, each adapter's exported declarations and comments, and the proof receipts. The generation check verifies the receipt's Lean source hashes and selected theorem names.

## Choose an algorithm

| Algorithm | Use it for |
| --- | --- |
| [Dijkstra shortest path](#lean-dijkstra) | A generic weighted-graph solver with a certified shortest-path result. |
| [Flood fill + capability closure](#lean-flood-fill) | Directed reachability across rooms, locks, keys, obstacles, and one-way ledges. |
| [Union-find percolation](#lean-union-find) | A generic checked partition finds when open passages first cross a braided porous maze. |
| [Topological sort + cycle witness](#lean-topological-sort) | A generic checked scheduler returns a complete legal order or an explicit directed dependency cycle. |
| [Aho–Corasick multi-pattern search](#lean-aho-corasick) | One checked byte automaton reports every exact match, including overlaps and duplicate patterns. |
| [LRU cache](#lean-lru-cache) | A bounded key/value cache with proven recency, capacity, and least-recently-used eviction. |
| [A* heuristic search](#lean-a-star) | A checked heuristic guides a generic shortest-path search. Compare its route and explored region with Dijkstra on weighted terrain. |
| [Tarjan strongly connected components](#lean-tarjan) | Find every group of mutually dependent modules, then collapse those groups into an acyclic graph. |
| [Token-bucket rate limiter](#lean-token-bucket) | Watch a request burst spend available tokens, then refill over time. Exact integer arithmetic enforces the configured rate and burst capacity. |
| [Maximum flow / minimum cut](#lean-dinic) | Change a connection's capacity and watch the bottleneck move. Lean returns a maximum flow and a minimum cut through a generic directed network. |
| [Myers shortest edit script](#lean-myers) | Edit two documents and inspect their smallest insertion/deletion script. Lean proves that replay reaches the target and no shorter script exists. |
| [Sweep-and-prune collision pairs](#lean-sweep-and-prune) | Drag moving boxes and see one-axis candidates narrowed to exact overlaps. Lean proves that no overlapping pair is missed or repeated. |

## Call an adapter

Keep each `runtime.mjs` beside its `runtime/` artifact directory. One-shot calls initialize their module as needed. Prepared solvers snapshot their input, can run repeatedly, and must be disposed by their owner. Cache and bucket factories return mutable resource objects; their method contracts are in their linked algorithm guides.

The export listings below show public names and call parameters read from source. A parameter named `request` is an object, not an unspecified positional list. Follow its input contract for field types, bounds, and result interpretation. Initialization helpers are not extra requirements for ordinary calls.

Work through [Dijkstra on a delivery graph](../concepts/dijkstra.md), [flood fill with capabilities](../concepts/flood-fill.md), or the [box-overlap API recipe](../demo-api.md). No example requires React to run the core.

## lean-dijkstra

A generic weighted-graph solver with a certified shortest-path result.

[Open Dijkstra shortest path](../../demos/lean-dijkstra/index.html) · [Input and result contract](../../demos/lean-dijkstra/README.md) · [Adapter source](../../demos/lean-dijkstra/runtime.mjs)

| Export / call parameters | Purpose |
| --- | --- |
| `shortestPath({ vertexCount, offsets, targets, weights, start, target })` | Run the generic weighted-graph solver compiled from `DijkstraCore.lean`. |
| `prepareShortestPath({ vertexCount, offsets, targets, weights })` | Prepare an immutable weighted graph once for repeated certified queries. |
| `ready` | Resolve after the compiled Lean runtime is ready. |

Selected theorems: `dijkstra_correct`, `dijkstraCsr_correct`.

The [proof receipt](../../demos/lean-dijkstra/runtime/proof-audit.json) records 17 required declarations checked with Lean v4.32.2. This reference build verifies every listed source hash against the Lean files.

[Benchmark source](../../demos/lean-dijkstra/benchmark.mjs) · [Correctness tests](../../demos/lean-dijkstra/test.mjs)

## lean-flood-fill

Directed reachability across rooms, locks, keys, obstacles, and one-way ledges.

[Open Flood fill + capability closure](../../demos/lean-flood-fill/index.html) · [Input and result contract](../../demos/lean-flood-fill/README.md) · [Adapter source](../../demos/lean-flood-fill/runtime.mjs)

| Export / call parameters | Purpose |
| --- | --- |
| `reachable({ vertexCount, offsets, targets, allowedVertices, allowedEdges, start })` | Return exactly the vertices reachable through enabled directed edges. |
| `reachableWithCapabilities({ vertexCount, offsets, targets, allowedVertices, requirements, grants , initialCapabilities, capabilityCount, start })` | Compute the least stable reachability/capability closure. |
| `prepareCapabilityClosure(request)` | Prepare an immutable gated graph once for repeated certified closures. |
| `ready` | Resolve after the compiled Lean runtime is initialized. |

Selected theorems: `floodFillCsr_correct`, `capabilityClosureCsr_correct`.

The [proof receipt](../../demos/lean-flood-fill/runtime/proof-audit.json) records 14 required declarations checked with Lean v4.32.2. This reference build verifies every listed source hash against the Lean files.

[Benchmark source](../../demos/lean-flood-fill/benchmark.mjs) · [Correctness tests](../../demos/lean-flood-fill/test.mjs)

## lean-union-find

A generic checked partition finds when open passages first cross a braided porous maze.

[Open Union-find percolation](../../demos/lean-union-find/index.html) · [Input and result contract](../../demos/lean-union-find/README.md) · [Adapter source](../../demos/lean-union-find/runtime.mjs)

| Export / call parameters | Purpose |
| --- | --- |
| `UNION` | Exported constant or initialization alias. |
| `CONNECTED` | Exported constant or initialization alias. |
| `partition({ elementCount, links })` | Build the exact partition induced by a flat array of undirected endpoint pairs. |
| `preparePartition({ elementCount, links })` | Prepare one fixed graph and return a synchronous partition operation for benchmarking. Input conversion happens once; each call runs the checked Lean implementation and copies its representatives out of Wasm memory. |
| `partitionDebug({ elementCount, links })` | Build a diagnostic partition that also exposes the internal parent and size arrays. |
| `runOperations({ elementCount, operations })` | Execute UNION and CONNECTED triples in order and return the query results. |
| `ready` | Loads and initializes the compiled Lean module. |

Selected theorems: `solvePartition_correct`, `connected_equivalence`.

The [proof receipt](../../demos/lean-union-find/runtime/proof-audit.json) records 8 required declarations checked with Lean v4.32.2. This reference build verifies every listed source hash against the Lean files.

[Benchmark source](../../demos/lean-union-find/benchmark.mjs) · [Correctness tests](../../demos/lean-union-find/test.mjs)

## lean-topological-sort

A generic checked scheduler returns a complete legal order or an explicit directed dependency cycle.

[Open Topological sort + cycle witness](../../demos/lean-topological-sort/index.html) · [Input and result contract](../../demos/lean-topological-sort/README.md) · [Adapter source](../../demos/lean-topological-sort/runtime.mjs)

| Export / call parameters | Purpose |
| --- | --- |
| `sortGraph(request)` | Sort a finite directed graph or return one directed cycle. |
| `sortGraphTotal(request)` | Run the constructive total solver directly, for independent fallback verification. |
| `prepareSort(request)` | Prepare an immutable graph and return a synchronous checked solver. Each solver owns its graph and output allocation. Call solver.dispose() when done. |
| `ready` | Resolve after the compiled Lean runtime is initialized. |

Selected theorems: `solve_total`, `solveGraph_total`, `solve_order_correct`, `solve_cycle_correct`.

The [proof receipt](../../demos/lean-topological-sort/runtime/proof-audit.json) records 17 required declarations checked with Lean v4.32.2. This reference build verifies every listed source hash against the Lean files.

[Benchmark source](../../demos/lean-topological-sort/benchmark.mjs) · [Correctness tests](../../demos/lean-topological-sort/test.mjs)

## lean-aho-corasick

One checked byte automaton reports every exact match, including overlaps and duplicate patterns.

[Open Aho–Corasick multi-pattern search](../../demos/lean-aho-corasick/index.html) · [Input and result contract](../../demos/lean-aho-corasick/README.md) · [Adapter source](../../demos/lean-aho-corasick/runtime.mjs)

| Export / call parameters | Purpose |
| --- | --- |
| `prepareMatcher(patterns)` | Compile patterns once and return synchronous batch and streaming scanners. |
| `unpackMatches(result)` | Convert a flat result into ergonomic match records. |
| `ready` | Resolve after the compiled Lean runtime is initialized. |

Selected theorems: `scan_matches_sound`, `scan_matches_complete`.

The [proof receipt](../../demos/lean-aho-corasick/runtime/proof-audit.json) records 8 required declarations checked with Lean v4.32.2. This reference build verifies every listed source hash against the Lean files.

[Benchmark source](../../demos/lean-aho-corasick/benchmark.mjs) · [Correctness tests](../../demos/lean-aho-corasick/test.mjs)

## lean-lru-cache

A bounded key/value cache with proven recency, capacity, and least-recently-used eviction.

[Open LRU cache](../../demos/lean-lru-cache/index.html) · [Input and result contract](../../demos/lean-lru-cache/README.md) · [Adapter source](../../demos/lean-lru-cache/runtime.mjs)

| Export / call parameters | Purpose |
| --- | --- |
| `createCache(capacity)` | Create an independent cache with unsigned 32-bit keys and values. |
| `prepareTrace(capacity, operations)` | Prepare an immutable operation trace for repeated independent runs from an empty cache. |
| `ready` | Resolve when the shared Lean runtime has initialized. |

Selected theorems: `get_valid`, `put_full_evicts_oldest`.

The [proof receipt](../../demos/lean-lru-cache/runtime/proof-audit.json) records 16 required declarations checked with Lean v4.32.2. This reference build verifies every listed source hash against the Lean files.

[Benchmark source](../../demos/lean-lru-cache/benchmark-workload.mjs) · [Correctness tests](../../demos/lean-lru-cache/test.mjs)

## lean-a-star

A checked heuristic guides a generic shortest-path search. Compare its route and explored region with Dijkstra on weighted terrain.

[Open A* heuristic search](../../demos/lean-a-star/index.html) · [Input and result contract](../../demos/lean-a-star/README.md) · [Adapter source](../../demos/lean-a-star/runtime.mjs)

| Export / call parameters | Purpose |
| --- | --- |
| `initRuntime()` | Initialize the Lean runtime once. |
| `prepareSearch(request)` | Copy a generic graph and check its heuristic once. The returned synchronous search owns its input and output allocations; call search.dispose() when done. |
| `solveGraph(request)` | Solve one request and release its prepared graph immediately afterward. |
| `solveGraphTotal(request)` | Exercise the proved total fallback directly, for small diagnostic graphs. |

Selected theorems: `solve_total`, `solve_path_shortest`, `solve_unreachable`, `exported_search_correct`.

The [proof receipt](../../demos/lean-a-star/runtime/proof-audit.json) records 19 required declarations checked with Lean v4.32.2. This reference build verifies every listed source hash against the Lean files.

[Benchmark source](../../demos/lean-a-star/benchmark-workload.mjs) · [Correctness tests](../../demos/lean-a-star/test.mjs)

## lean-tarjan

Find every group of mutually dependent modules, then collapse those groups into an acyclic graph.

[Open Tarjan strongly connected components](../../demos/lean-tarjan/index.html) · [Input and result contract](../../demos/lean-tarjan/README.md) · [Adapter source](../../demos/lean-tarjan/runtime.mjs)

| Export / call parameters | Purpose |
| --- | --- |
| `initRuntime()` | Initialize the Lean runtime once. |
| `prepareGraph(request)` | Copy and prepare a generic CSR graph. The synchronous solver owns its graph until dispose() is called; independent handles may safely be interleaved. |
| `solveGraph(request)` | Solve one directed graph and release its prepared handle. |
| `solveGraphTotal(request)` | Exercise the proved cubic reference directly on small diagnostic graphs. |

Selected theorems: `solve_total`, `exported_same_iff`, `solve_maximal`, `condensation_acyclic`.

The [proof receipt](../../demos/lean-tarjan/runtime/proof-audit.json) records 28 required declarations checked with Lean v4.32.2. This reference build verifies every listed source hash against the Lean files.

[Benchmark source](../../demos/lean-tarjan/benchmark-workload.mjs) · [Correctness tests](../../demos/lean-tarjan/test.mjs)

## lean-token-bucket

Watch a request burst spend available tokens, then refill over time. Exact integer arithmetic enforces the configured rate and burst capacity.

[Open Token-bucket rate limiter](../../demos/lean-token-bucket/index.html) · [Input and result contract](../../demos/lean-token-bucket/README.md) · [Adapter source](../../demos/lean-token-bucket/runtime.mjs)

| Export / call parameters | Purpose |
| --- | --- |
| `initRuntime()` | Initialize the compiled Lean runtime once for all independent buckets. |
| `createBucket(configuration)` | Create an independent bucket, initially full, in generic integer credits/ticks. |
| `prepareTrace(configuration)` | Snapshot a trace for repeated independent runs from a full initial bucket. |

Selected theorems: `refill_eq`, `request_valid`, `exportedRun_no_over_admission`, `exportedStep_admitted_iff`.

The [proof receipt](../../demos/lean-token-bucket/runtime/proof-audit.json) records 25 required declarations checked with Lean v4.32.2. This reference build verifies every listed source hash against the Lean files.

[Benchmark source](../../demos/lean-token-bucket/benchmark-workload.mjs) · [Correctness tests](../../demos/lean-token-bucket/test.mjs)

## lean-dinic

Change a connection's capacity and watch the bottleneck move. Lean returns a maximum flow and a minimum cut through a generic directed network.

[Open Maximum flow / minimum cut](../../demos/lean-dinic/index.html) · [Input and result contract](../../demos/lean-dinic/README.md) · [Adapter source](../../demos/lean-dinic/runtime.mjs)

| Export / call parameters | Purpose |
| --- | --- |
| `initRuntime()` | Initialize the shared Lean/Wasm module once. |
| `prepareGraph(request)` | Snapshot a capacitated CSR network, preserving original edge order. |
| `solveGraph(request)` | Solve one network and release its prepared handle. |
| `solveGraphTotal(request)` | Exercise the proved reference directly on tiny diagnostic networks. |

Selected theorems: `solve_total`, `exported_optimal`, `flow_cut_upper_bound`, `matching_cut_edges`.

The [proof receipt](../../demos/lean-dinic/runtime/proof-audit.json) records 31 required declarations checked with Lean v4.32.2. This reference build verifies every listed source hash against the Lean files.

[Benchmark source](../../demos/lean-dinic/benchmark-workload.mjs) · [Correctness tests](../../demos/lean-dinic/test.mjs)

## lean-myers

Edit two documents and inspect their smallest insertion/deletion script. Lean proves that replay reaches the target and no shorter script exists.

[Open Myers shortest edit script](../../demos/lean-myers/index.html) · [Input and result contract](../../demos/lean-myers/README.md) · [Adapter source](../../demos/lean-myers/runtime.mjs)

| Export / call parameters | Purpose |
| --- | --- |
| `MAX_TOTAL_TOKENS` | Exported constant or initialization alias. |
| `initRuntime()` | Initialize the shared Lean/Wasm module once. |
| `prepareDiff(request)` | Snapshot generic uint32 token sequences and prepare an independently owned solver. |
| `diffTokens(before, after)` | Compute a shortest edit script and release temporary prepared storage. |
| `diffTokensTotal(before, after)` | Exercise the proved reference on tiny token sequences. |

Selected theorems: `solve_total`, `exported_shortest`, `exported_patch_reconstructs`, `exported_zero_iff`.

The [proof receipt](../../demos/lean-myers/runtime/proof-audit.json) records 37 required declarations checked with Lean v4.32.2. This reference build verifies every listed source hash against the Lean files.

[Benchmark source](../../demos/lean-myers/benchmark-workload.mjs) · [Correctness tests](../../demos/lean-myers/test.mjs)

## lean-sweep-and-prune

Drag moving boxes and see one-axis candidates narrowed to exact overlaps. Lean proves that no overlapping pair is missed or repeated.

[Open Sweep-and-prune collision pairs](../../demos/lean-sweep-and-prune/index.html) · [Input and result contract](../../demos/lean-sweep-and-prune/README.md) · [Adapter source](../../demos/lean-sweep-and-prune/runtime.mjs)

| Export / call parameters | Purpose |
| --- | --- |
| `MAX_BOXES` | Exported constant or initialization alias. |
| `initRuntime()` | Initialize the shared Lean/Wasm runtime once. |
| `prepareSweep(request)` | Snapshot boxes before awaiting; each call sorts and sweeps the complete snapshot. |
| `findOverlaps(request)` | Find all projection candidates and exact box overlaps, releasing prepared storage. |

Selected theorems: `solve_total`, `exported_candidates_exact`, `exported_overlaps_exact`, `exported_overlaps_unique`.

The [proof receipt](../../demos/lean-sweep-and-prune/runtime/proof-audit.json) records 41 required declarations checked with Lean v4.32.2. This reference build verifies every listed source hash against the Lean files.

[Benchmark source](../../demos/lean-sweep-and-prune/benchmark-workload.mjs) · [Correctness tests](../../demos/lean-sweep-and-prune/test.mjs)

## Interpret the evidence

A selected theorem names a specific property. Dijkstra certifies returned paths; its correctness theorem does not assert that every empty result proves unreachability. Flood fill has exact reachability and least stable capability closure. A* and topological sort have explicit total-result contracts. Follow each theorem and its assumptions instead of transferring one algorithm's guarantee to another.

An adapter function called `ready` or `initRuntime` returns a cached runtime used internally by that demo. The generic prepared-package API does not expose it. Distinct standalone demos do not acquire a shared heap merely because they appear in this catalog.

The source owner for each API is its linked adapter; the manifest owns the catalog selection. The demo tests exercise real compiled calls and independent comparisons. Contributors follow [reference generation](../../site/README.md#content-and-ownership) to update the page.

Next, [audit a claim](../concepts/auditable-claims.md), [read the benchmark method](../concepts/benchmarks.md), or [evaluate an adoption](../concepts/adoption.md).
