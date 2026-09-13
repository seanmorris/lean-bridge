# Algorithm API and proof reference

The demos expose graph, sequence, cache, limiter, and geometry adapters independently of their webpages. These local adapters are repository artifacts, not published npm algorithm packages. To use a prepared library release, start with [package consumption](../consume.md).

This catalog is generated from the demo manifest, each adapter's exported declarations and comments, and the proof receipts. The generation check verifies the receipt's Lean source hashes and selected theorem names.

## Choose an algorithm

{{ALGORITHM_INDEX}}

## Call an adapter

Keep each `runtime.mjs` beside its `runtime/` artifact directory. One-shot calls initialize their module as needed. Prepared solvers snapshot their input, can run repeatedly, and must be disposed by their owner. Cache and bucket factories return mutable resource objects; their method contracts are in their linked algorithm guides.

The export listings below show public names and call parameters read from source. A parameter named `request` is an object, not an unspecified positional list. Follow its input contract for field types, bounds, and result interpretation. Initialization helpers are not extra requirements for ordinary calls.

Work through [Dijkstra on a delivery graph](../concepts/dijkstra.md), [flood fill with capabilities](../concepts/flood-fill.md), or the [box-overlap API recipe](../demo-api.md). No example requires React to run the core.

{{ALGORITHMS}}

## Interpret the evidence

A selected theorem names a specific property. Dijkstra certifies returned paths; its correctness theorem does not assert that every empty result proves unreachability. Flood fill has exact reachability and least stable capability closure. A* and topological sort have explicit total-result contracts. Follow each theorem and its assumptions instead of transferring one algorithm's guarantee to another.

An adapter function called `ready` or `initRuntime` returns a cached runtime used internally by that demo. The generic prepared-package API does not expose it. Distinct standalone demos do not acquire a shared heap merely because they appear in this catalog.

The source owner for each API is its linked adapter; the manifest owns the catalog selection. The demo tests exercise real compiled calls and independent comparisons. Contributors follow [reference generation](../../site/README.md#content-and-ownership) to update the page.

Next, [audit a claim](../concepts/auditable-claims.md), [read the benchmark method](../concepts/benchmarks.md), or [evaluate an adoption](../concepts/adoption.md).
