# Proven Lean Dijkstra demo

This demo rewrites the core of [fetburner/coq-dijkstra](https://github.com/fetburner/coq-dijkstra) in Lean 4, compiles the executable core to WebAssembly, and uses it from an interactive browser grid. The Lean implementation is generic: it accepts any finite directed graph with natural-number edge weights. Only `app.mjs` knows that this particular interface is a grid.

The upstream source analyzed for this port is commit `1ca9e67958e61f7159c46206720e0013a4e5e3c3` (2021-03-02). Its single `Dijkstra.v` theory defines accumulated path cost, the label-setting recursion, and a proof that the resulting paths are shortest under increasing, monotone edge-cost extension.

## What was ported

The Lean version uses ordinary addition on natural edge weights, the standard specialization used by Dijkstra:

| Coq declaration | Lean counterpart |
|---|---|
| `cost_of_path` | `costOfPath` |
| `cost_of_path_cons` | `costOfPath_cons` |
| `cost_of_path_increase` | `costOfPath_increase` |
| `cost_of_path_rcons` | `costOfPath_rcons` |
| `shortest_path` | `ShortestPath` |
| `dijkstra_rec` | `dijkstraLoop` / `dijkstraRec` |
| `dijkstra_rec_correct` | `dijkstraRec_correct` |
| `dijkstra` / `dijkstra_correct` | `dijkstra` / `dijkstra_correct` |

There is one deliberate specification change: a finite graph can have an unreachable target, so Lean returns `Option (List Nat)`. Every `some path` is proven to satisfy `ShortestPath`; `none` represents no certified route.

The port uses a proof-carrying result. The label-setting loop builds distances and predecessors. Before returning a path, executable Lean checks a certificate consisting of:

- a zero label at the source;
- the triangle inequality for every edge;
- a valid source-to-target walk; and
- equality between the walk cost and the target label.

`certificate_shortest` proves these conditions imply global minimality against every alternative walk. `dijkstraRec_correct` and `dijkstra_correct` establish the generic list-backed API, while `csrFeasibleLabelsCheck_eq` and `dijkstraCsr_correct` connect the direct CSR implementation used by the Wasm export to exactly the same graph specification. There are no `sorry` declarations. The proof module is checked on every build, while Lean erases proofs from the Wasm artifact.

The executable graph uses compressed sparse rows, and Dijkstra's next-vertex selection uses a binary min-heap. The search result also caches its graph-derived unreachable-distance bound. Search therefore runs in `O((V + E) log E)` time, while certificate validation traverses the vertices and edges once in `O(V + E)` time instead of probing every possible vertex pair.

## Files

- `DijkstraCore.lean` — generic executable graph algorithm and matrix export; imports only `Init` so it can use the small Wasm runtime.
- `Dijkstra.lean` — ported lemmas and correctness proofs over the exact core definitions.
- `bridge.c` — narrow ownership/memory adapter between JavaScript typed arrays and Lean arrays.
- `runtime.mjs` — generic weighted compressed-sparse-row JavaScript API.
- `app.mjs` — grid-to-graph conversion and UI behavior.
- `benchmark.mjs` — deterministic end-to-end benchmark for the compiled API.
- `../shared/proof-viewer.mjs` — shared syntax highlighting, browser-side receipt verification, and Lean checker launcher.
- `generate-proof-audit.mjs` — creates the source-hash receipt after Lean accepts the proof module.
- `runtime/` — compiled Emscripten ES module and Lean Wasm artifact.

The browser boundary uses compressed sparse row (CSR) arrays: `offsets` has one row boundary per vertex, while parallel `targets` and `weights` arrays describe the edges. Zero-weight edges are supported. The compiled path traverses CSR directly rather than expanding every edge into linked lists and records. Its executable CSR certificate is proved equivalent to the generic graph checker, and `dijkstraCsr_correct` connects the optimized entry point to the same `ShortestPath` specification.

## Build and run

From the repository root:

```sh
demos/lean-dijkstra/build.sh
python3 -m http.server 8080
```

Then open `http://localhost:8080/demos/lean-dijkstra/`. A web server is required because browsers do not load the Wasm ES module from `file://` URLs.

The proof section works offline: it displays both Lean files and verifies their SHA-256 hashes against `runtime/proof-audit.json`, which the build emits only after the pinned Lean compiler accepts `Dijkstra.lean`. It offers two optional interactive checks using the same self-contained source:

- [Lean 4 in your browser](https://github.com/cauli/lean4-wasm-in-browser) runs the real compiler and kernel locally in a Web Worker. Its first run downloads a large Wasm compiler and library bundle. The source travels in the URL fragment rather than to a proof-checking server. After the checker reports `Ready`, click `Run Code`; appended `#check` and `#print axioms` commands make both the generic and optimized CSR theorems visible rather than leaving an empty output pane.
- [Lean Web](https://github.com/leanprover-community/lean4web) runs Lean server-side and exposes its experimental Comparator workflow. The launcher supplies two separate inputs: a challenge containing the identical generic core and the exact `dijkstraCsr_correct` statement with an intentional `sorry`, and a solution containing the full proof. Private helper markers are removed from both inputs because Comparator compiles them under different filenames and Lean otherwise gives them different private names; this changes visibility, not their definitions. Comparator can therefore compare the theorem for the implementation actually exported to Wasm instead of reporting an empty challenge. Its result is meaningful only after the user inspects and trusts the challenge; it checks soundness of returned paths, not a stronger reachability/completeness claim.

## Verify

```sh
source scripts/env.sh
LEAN_PATH=build/demos/lean-dijkstra/generated:demos/lean-dijkstra \
  lean demos/lean-dijkstra/Tests.lean
node --test demos/lean-dijkstra/test.mjs
```

The build also validates the emitted Wasm with `wasm-tools`.

## Benchmark

Run the compiled Lean/Wasm implementation across deterministic weighted grid graphs:

```sh
node demos/lean-dijkstra/benchmark.mjs
```

The benchmark warms each workload once, validates every returned path, and reports minimum, median, and p95 latency. Timings cover the public JavaScript API end to end: CSR copying into a reusable Wasm scratch block, Lean Dijkstra execution, executable certificate checking, and copying the result back to JavaScript. Graph construction is outside the timed region.

For machine-readable output or a fixed sample count:

```sh
node demos/lean-dijkstra/benchmark.mjs --json
LEAN_DIJKSTRA_BENCH_ITERATIONS=10 node demos/lean-dijkstra/benchmark.mjs
node demos/lean-dijkstra/benchmark.mjs --assert
```

`--assert` applies conservative median-latency budgets and exits at the first regression. The budgets catch reintroducing per-edge CSR expansion, dense edge probing, linear minimum selection, and repeated graph-wide work while retaining headroom over the recorded reference timings.
