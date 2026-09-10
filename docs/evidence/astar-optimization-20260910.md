# A* optimization, 10 September 2026

Baseline: repository revision `5cbf96e`. Measurements ran on an Intel Core i7-7700K host with Node 22.23.2. Both builds use Lean 4.32.2 and the repository's pinned Wasm toolchain.

## Prepared-search measurements

The comparison used `makeWorkload` with its default seed, `0xa57a`. Preparation was outside timing for each implementation. `measurePairedBenchmark` alternated order, excluded five warmup pairs, yielded between pairs, and measured 50 pairs using adaptive batches of at least 12 ms. Every pair compared the complete path, cost, expansion sequence and fallback flag.

| Vertices / edges | Previous median | Optimized median | Previous p95 | Optimized p95 |
| --- | --- | --- | --- | --- |
| 1,008 / 3,904 | 0.808 ms | 0.513 ms | 0.902 ms | 0.526 ms |
| 1,728 / 6,744 | 1.475 ms | 0.940 ms | 1.903 ms | 0.952 ms |

Search time fell by 36.5% and 36.2%, respectively. In separate paired runs against the unchanged JavaScript implementation, the optimized Lean medians were 0.512 ms and 0.941 ms, versus 0.163 ms and 0.334 ms in JavaScript. Relative costs were 3.13× and 2.82× on this machine. Expansion counts remained 980 and 1,717.

The original command-line benchmark also passes its existing 3 ms / 10× and 6 ms / 10× gates. These local measurements do not establish the performance of the GitHub runner. The prior Pages failure at `4349783` remains awaiting a run with this optimization.

Wasm SHA-256 identities:

- Previous: `97c987b35b6cdcb503b320d3ac72254dbcd36fc929d5832860fba146716f7f8c`.
- Optimized: `1be86a55d4265000520eb724b64eb50c4abff1d117c40e80fbbf169701cba576`.

## Browser measurements

Chromium 152.0.7977.75 on the same host measured the same artifacts and workloads. The browser comparison also excluded five warmup pairs, alternated order, and collected 50 pairs with adaptive batches of at least 12 ms. It yielded through `requestAnimationFrame` between pairs and checked all result fields outside timing.

| Vertices | Previous median | Optimized median | Previous p95 | Optimized p95 |
| --- | --- | --- | --- | --- |
| 1,008 | 0.725 ms | 0.491 ms | 0.831 ms | 0.528 ms |
| 1,728 | 1.306 ms | 0.894 ms | 1.744 ms | 1.025 ms |

Browser search time fell by 32.3% and 31.6%. Separate paired comparisons against JavaScript measured 0.491 / 0.131 ms and 0.894 / 0.261 ms, respectively.

The rebuilt React page also completed its normal 100-sample, scroll-triggered benchmark: Lean 0.50 ms, JavaScript 0.13 ms, relative cost 3.8×, Lean p95 0.51 ms. Each pair agreed on path, cost and expansion order.

## Changes and proofs

Profiling identified generic array reads, indirect label calls, reference counting and allocation in the timed path. The implementation now:

- Inlines shared array reads and specializes generic certificate predicates.
- Uses a tail-recursive vertex scan. `allUpTo_eq_allDownFrom` proves the compiler replacement equals the original predicate for every input.
- Caches each certificate row's source label. `labelsFrom_eq` proves equivalence to the shared CSR edge checker.
- Carries the relaxation arrays directly instead of rebuilding two wrapper objects after every improving edge.
- Computes the graph-wide maximum-weight sentinel during preparation. `Prepared.infinityValid` and `searchPrepared_eq_searchRaw` prove that the cached value preserves the candidate.
- Links the generated Lean modules and C adapter with link-time optimization.

The binary heap, tie-breaking rules, certificate acceptance, fallback solver, output format and input limits are unchanged. A tested four-way heap variant was slower and was discarded. No search or certificate logic moved to C or JavaScript.

The shared traversal change also removes a reproduced stack overflow: the previous build throws `RangeError: Maximum call stack size exceeded` while preparing an edgeless 20,000-vertex graph. The optimized build prepares it and returns both singleton-path and unreachable results on repeated runs. The regression covers those sparse cases, not every possible large graph.

## Verification

```sh
bash demos/lean-dijkstra/build.sh
bash demos/lean-a-star/build.sh
node --test demos/lean-a-star/test.mjs demos/lean-dijkstra/test.mjs
node demos/lean-a-star/benchmark.mjs --assert
node demos/lean-dijkstra/benchmark.mjs --assert
npm run docs:reference
npm run check:core
npm run test:docs
npm run site:test
npm run site:build
```

Both proof builds pass. A*'s receipt includes all three new equivalence theorems alongside the existing shortest-path, unreachable, total-return and serialized-export guarantees. The tests include all 512 three-vertex directed graphs and their nine endpoint pairs, randomized weighted graphs, zero-cost cycles, stale entries, large costs and independent prepared handles. Lean tests also reject a forged certificate label and check the cached sentinel against the uncached candidate.

The focused A*/Dijkstra suite passes all 20 tests. Core checks pass 384 tests, docs pass 58, and site tests pass 94. The assembled site passes the Chromium workbench audit for both affected demos: edits, navigation and page restoration, six route lifetimes, native-handle cleanup and 100 checked benchmark samples. Firefox and WebKit were not tested locally: the multi-engine audit stopped when the Firefox executable was unavailable.
