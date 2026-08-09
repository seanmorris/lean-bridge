# Canonical spatial performance corpus

Status: executable contract. This record freezes the operations, ownership model, complexity evidence, and small correctness vectors that later performance implementations must satisfy. It does not contain timing results or claim that the Lean reference components have been implemented.

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

## Next implementation boundary

The next work item must implement `performance/ordered-search`, `performance/spatial-index`, and `performance/spatial-consumer` as independent Lean capsules. Generated host bindings must expose the same functions and index class without raw ABI access. The producer and consumer must share one Lean runtime and one resource identity domain. Correctness and lifecycle counters must pass before the harness records timing.
