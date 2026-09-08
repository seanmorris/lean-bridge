# Proven union-find percolation lab

This demo compiles a generic finite-index union-find implementation from Lean 4 to WebAssembly. The browser generates a braided maze, treats permanent wall cells as isolated vertices, and turns neighboring open passage cells into undirected pairs. Two additional vertices connect the eligible top and bottom boundary cells. Lean returns their exact partition.

The page separates one editable material sample from a live browser benchmark. The benchmark warms both solvers with five excluded searches, runs 100 measured seeded threshold searches through checked Lean/Wasm and an optimized typed-array JavaScript union-find, then verifies that they find the same crossing point. Maze generation, wall semantics, and the inlet and outlet adapter remain JavaScript.

The grid, animation, seeded activation order, benchmark harness, and histogram live in JavaScript. The Lean API receives only an element count and endpoint pairs. `solvePartition_correct` proves directly that two representatives returned by the production solver are equal exactly when the input pairs connect those elements.

Public requests snapshot their typed arrays before awaiting initialization. Each `preparePartition` solver owns its graph and output storage independently. Results are copied out of Wasm memory. Call the solver's idempotent `dispose()` method when finished; calls after disposal throw.

## Build and check

```sh
bash demos/lean-union-find/build.sh
node --test demos/lean-union-find/test.mjs
node demos/lean-union-find/benchmark.mjs --assert
```

The build rejects `sorry` and `admit`, runs native Lean tests, emits the proof receipt, compiles the core to Wasm, and validates the resulting module. Differential tests compare the compiled implementation with an independent graph traversal.

## Performance boundary

The `partition` export runs a weighted union-find over two mutable Lean arrays and returns only the representative array needed by the application. Its correctness proof is erased during compilation, so the browser does not rebuild or validate a runtime certificate. The separate `partitionDebug` API retains the larger certifying result for diagnostics. Each benchmark trial uses binary search, so it needs at most ten partitions instead of replaying every activation. Reported core timings cover those solver calls after JavaScript has built the graph request.

## Sources

- Robert E. Tarjan, [Efficiency of a Good But Not Linear Set Union Algorithm](https://doi.org/10.1145/321879.321884), 1975.
- Arthur Charguéraud and François Pottier, [Verifying the Correctness and Amortized Complexity of a Union-Find Implementation in Separation Logic with Time Credits](https://www.chargueraud.org/research/2017/credits_jar/credits_jar.pdf), 2019.
