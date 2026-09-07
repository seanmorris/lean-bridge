# Proven Lean topological sort

This demo compiles a generic finite directed-graph solver from Lean 4 to WebAssembly. Every well-formed graph returns either a complete topological order or an explicit directed cycle. The build checks successful return and result correctness before compiling the same Lean implementation.

The browser models a build pipeline, but names, positions, editing, and visualization remain JavaScript adapter concerns. Lean receives only a vertex count and flat directed endpoint pairs.

## Algorithm and provenance

The acyclic path uses Kahn's indegree algorithm: Arthur B. Kahn, “Topological sorting of large networks,” *Communications of the ACM* 5(11), 1962, DOI `10.1145/368996.369025`. When vertices remain, the solver follows residual incoming edges until a vertex repeats, then reverses that segment into an explicit directed cycle. The implementation is original MIT-licensed repository code; no source from the paper or another implementation was copied.

## Guarantees

- An `order` result contains every finite vertex exactly once and every input edge points forward.
- A `cycle` result is nonempty, contains no repeated vertex, stays in range, and closes through input edges.
- `solve_result_correct`, `solve_order_correct`, and `solve_cycle_correct` connect the checked result released by the exported implementation to those predicates.
- `solve_total` proves every well-formed graph returns a correct result, without assuming that a computation succeeded.
- `solveGraph_total` connects that guarantee to the exact serialized Wasm export. `solveGraph_no_failure` proves its result tag is always an order or a cycle for valid input.
- `permutationCheck_iff`, `edgeExists_iff`, and `topologicalOrder_iff_semantic` connect the executable checks to vertex coverage and actual edges in the flat input table.
- Malformed endpoint arrays and out-of-range vertices are rejected at the JavaScript and C boundaries.

The proof covers the finite directed graph received by Lean. Task names, card positions, pointer interactions, browser rendering, and ABI memory copying remain outside the theorem.

The executable path builds adjacency and indegree arrays in `O(V + E)`, runs Kahn's scan in `O(V + E)`, and checks an order in `O(V + E)`. Cycle extraction may scan the flat edge array once per witness step, so its current worst case is `O(VE)`.

`sortGraph(request)` solves a graph once. `prepareSort(request)` copies the graph and returns a synchronous solver with independent storage, so several prepared graphs can coexist. Call `solve.dispose()` to release its graph and output buffer. Disposal is idempotent; calling a disposed solver throws. Returned results are copies and remain usable after disposal.

`solve` first tries the optimized CSR candidate and its existing checks. If that
candidate is rejected, a constructive solver in `TopologicalSortTotal.lean`
removes source vertices recursively. If no source remains, it follows incoming
edges until a predecessor repeats and closes a simple cycle. Both recursions
decrease an explicit list length; no fuel assumption or admitted proof is needed.
`TopologicalSortChecks.lean` and `TopologicalSortCycleLemmas.lean` prove that its
results satisfy the same certificate predicates as the fast candidate. Those
proofs erase, so the fallback does not repeat the certificate check.

The guarantee covers this combined solver. Ordinary requests retain the current
CSR path. The fallback takes at most `O(V³)` edge queries, each `O(E)` for the flat
input table, and exists to guarantee a result when the fast candidate is rejected.
The diagnostic `sortGraphTotal(request)` API exercises that branch directly.
Tests run both paths on all 66,067 directed graphs with zero through four
vertices, including self loops, and test longer chains, cycles, and duplicate edges.

The proof viewer hashes and bundles all six Lean modules, including the order,
cycle, and checker lemmas. Both browser checkers receive that complete bundle;
the Comparator challenge asks for `solve_total`.

Build and test from the repository root:

```sh
bash demos/lean-topological-sort/build.sh
node --test demos/lean-topological-sort/test.mjs
node demos/lean-topological-sort/benchmark.mjs --assert
```
