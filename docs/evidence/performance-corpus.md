# Canonical spatial performance corpus

Status: executable contract with a shared-runtime Lean implementation. This record freezes the operations, ownership model, complexity evidence, and small correctness vectors that every timed implementation must satisfy. It does not contain timing results.

## Command

```sh
npm run test:performance-corpus
```

The command validates `poc/performance/corpus.v1.json` and executes every expected-result vector through an independent reference runner. The reviewed corpus identity is:

```text
baa4108733e6c8949bd4874a93f3a467487e5e8796fce4d0226f1de7634612ef
```

Changing an operation, precondition, postcondition, failure code, ownership mode, result order, dataset, expected result, or evidence record changes that identity.

## Contract surface

The corpus fixes three dimension profiles: 2, 4, and 8. Coordinates are signed 32-bit values restricted to `-32768` through `32767`, which keeps the largest version 1 squared-distance result within exact JavaScript integer range.

| Operation | Public shape | Boundary behavior |
|---|---|---|
| `point-lower-bound` | Pure function | Copies sorted points and a query, then returns the first lexicographic insertion index. |
| `index-build` | Resource constructor | Copies input points into one owned spatial index. |
| `index-nearest` | Read method | Borrows the index and returns a copied point and squared distance. |
| `index-range` | Read method | Borrows the index and returns copied point IDs in ascending order. |
| `index-insert` | Mutating method | Borrows the index, copies one point, and updates every canonical alias. |
| `consumer-range-checksum` | Independent component function | Borrows the producer's index through the shared runtime and returns copied results. |
| `index-dispose` | Native lifecycle operation | Releases once, reports later disposal as a no-op, and invalidates every alias. |

Duplicate coordinates are valid. Lower bound selects the first duplicate. Nearest-neighbor ties select the lowest point ID. Range results use ascending point IDs. Those rules prevent an implementation from selecting a cheaper result order during optimization.

## Complexity evidence

The lower-bound contract carries an asserted `O(log(point-count) * dimensions)` time bound and `O(1)` auxiliary-space bound. The evidence cites the interval-halving control flow and bounded coordinate comparison. It does not name a Lean theorem, so the corpus labels the claim `asserted` rather than `proved`.

Build, nearest, range, insert, size, cross-component checksum, and disposal remain `unknown`. Their bounds depend on the reference data structure and its verified implementation. The contract rejects an unknown metric that carries a bound, and it rejects a proved metric without a named theorem-backed evidence record.

## Frozen vectors

The version 1 fixture covers:

- lexicographic lower bounds before, inside, and after a 2D point set;
- first-duplicate selection;
- nearest-neighbor distance and tie ordering;
- inclusive multidimensional range lookup;
- insertion observed through the same resource identity;
- a borrowed resource call from an independently declared consumer component;
- first and repeated disposal;
- rejection of a call after disposal; and
- equivalent query rules at 4 and 8 dimensions.

The reference runner resets resource state for each vector and compares canonical result bytes at every step. A wrong result blocks the corpus before a timing sample can be accepted.

## Implemented boundary

The repository now contains separate Lean modules for `performance/ordered-search`, `performance/spatial-index`, and `performance/spatial-consumer`. `npm run test:performance-reference` compiles each module into its own generated C artifact, then executes the frozen 2D vector through Lean. The consumer artifact imports the producer's range operation and none of the component artifacts contains a private Lean runtime.

`npm run test:performance-wasm` compiles those modules into three runtime-free Wasm side modules and generates the JavaScript and TypeScript projection from `poc/performance/library-manifest.json`. The public surface contains `lowerBound`, `SpatialIndex`, and `rangeChecksum`. It contains no generic dispatch operation, raw handle, pointer, memory, or underscored symbol.

The generated projection loads only the requested component and its transitive dependencies. Every component imports one memory and one function table from the application runtime. `SpatialIndex` retains one Lean value in a generation-safe slot. The independent consumer borrows that same value, so it does not copy the index or create another runtime. Tests cover lazy loading, one-time initialization, 2D, 4D, and 8D typed results, mutation through stable wrapper identity, cross-runtime rejection, deterministic idempotent disposal, and zero live resources at shutdown.

The timing harness remains the next boundary. It must execute these public generated APIs and reject a sample unless the correctness and ownership checks pass first.
