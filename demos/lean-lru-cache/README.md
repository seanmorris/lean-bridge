# Proven LRU cache

An editable request timeline backed by a generic bounded Lean key/value cache.
Click a resource to request it, step through a sequence, or run it automatically.
Click any timeline entry to replay the cache up to that request. Change capacity
to compare the same history with more or fewer slots. The scan preset demonstrates
how one-time requests displace a repeatedly used working set.

## Core and proofs

`LruCore.lean` implements a cache for arbitrary key and value types, with decidable
key equality. Entries are stored in a compact array from least to most recently
used. `get` returns a stored value and promotes its key; a miss leaves the cache
unchanged. `put` replaces or inserts a value, promotes its key, and evicts the
oldest entry if needed. A zero-capacity cache stores nothing.

`Lru.lean` proves the executable array transitions refine a separate list
specification. The named guarantees include bounded capacity, unique keys,
lookup values preserved by promotion, visibility of written values, relative
order of untouched entries, no eviction on replacement, and eviction of exactly
the least recent entry on insertion into a full cache. Equality must be lawful.
Starting empty and applying any operation trace preserves the cache invariant.
Proofs erase before compilation; operations do not run a certificate checker.
`exported_run_refines` proves every batch outcome and the final cache equal the
list specification. `exported_get_correct` and `exported_put_correct` connect the
individual exported entry points to the same guarantees.

The browser export specializes keys and values to natural numbers. The JS API
accepts unsigned 32-bit integers, including zero and `0xffffffff`. Resource names,
request playback, simulated loading on a miss, and drawing remain in JavaScript.
Lean decides every cache hit, recency change, and eviction shown in the demo.

## Reusable API

```js
import { createCache, prepareTrace } from "./runtime.mjs";

const cache = await createCache(2);
cache.put(7, 70);
cache.put(8, 80);
cache.get(7);          // { hit: true, value: 70 }; 7 becomes most recent
cache.put(9, 90);      // evicted: { key: 8, value: 80 }
cache.entries();       // [[9, 90], [7, 70]], most recent first
cache.dispose();

const trace = await prepareTrace(2, new Uint32Array([
  1, 7, 70,           // put
  0, 7, 0             // get; third word ignored
]));
trace.run();           // independent run from an empty cache
trace.dispose();
```

`cache.run(operations)` executes the same triples against the current cache.
It returns four words per operation: status, value, evicted key, evicted value.
Status is 0/miss, 1/hit, 2/insert, 3/replacement, 4/eviction, or 5/storage disabled.
Unused eviction words and miss values are zero. A put outcome carries the written
value even at zero capacity. `put` also reports `stored` and `replaced` booleans.
Get misses return `value: undefined`, so a stored zero is unambiguous.

Each cache and prepared trace owns its Wasm resources. Dispose them after use;
disposal is idempotent and later operations throw. Prepared inputs are copied.
Independent caches and traces can be interleaved. Capacity is immutable, bounded
at 65,536 entries in the JS adapter; traces allow up to 1,000,000 operations.

## Complexity and benchmarks

The compact array implementation uses O(capacity) space and O(capacity) worst-case
time per lookup or write. It targets small bounded caches. It does not claim the
expected O(1) operations of a hash table plus linked list.
The exported read checks the most recent entry first, making repeated reads of
that key O(1). `fastGet_eq_get` proves this shortcut equivalent to the generic
lookup for valid caches. Writes determine whether a key existed while removing
it, avoiding a separate search.

Both browser and command-line benchmarks compare 4,096-operation traces against
an independent insertion-ordered JavaScript `Map` implementation. Both allocate
an empty cache and produce identical outcome quads on each run. Prepared input
allocation and conversion into each runtime's representation are outside timing;
execution, result copying, and JS result allocation are inside. Five excluded samples warm both
implementations. Adaptive repeated timing avoids timer-floor ratios, and order
alternates between implementations. Every measured pair checks every output
word. The browser reports 100 comparisons and their histogram. The CLI covers
capacities 8, 32, and 128, including mixed access, scan pollution, and repeated
access to the most recent entry.

Representative local Node measurements after the first optimization pass:

| Workload (4,096 operations) | Lean median | JS median | Relative cost |
| --- | ---: | ---: | ---: |
| Mixed, 8 slots | 1.10 ms | 0.34 ms | 3.3× |
| Mixed, 32 slots | 2.02 ms | 0.35 ms | 5.8× |
| Scan, 128 slots | 8.19 ms | 0.56 ms | 14.6× |
| Repeated most-recent access, capacity 128 | 0.43 ms | 0.29 ms | 1.5× |

The repeated-access workload holds one entry, exercising the common shortcut;
the scan workload fills the cache and forces eviction. The latter shows the
array representation's scaling cost. CI budgets for these four rows are
6/10/30/4 ms and 20/25/50/10× respectively, allowing machine variation while
rejecting large regressions. Browser measurements run on the visitor's machine.

## Reference and license

Behavior was studied against CPython's `functools._lru_cache_wrapper`, pinned to
release v3.13.7, commit `bcee1c322115c581da27600f2ae55e5439c027eb`:

- [Reference implementation](https://github.com/python/cpython/blob/bcee1c322115c581da27600f2ae55e5439c027eb/Lib/functools.py)
- [Reference license](https://github.com/python/cpython/blob/bcee1c322115c581da27600f2ae55e5439c027eb/LICENSE)

CPython uses a dictionary and circular linked list to promote hits and recycle
the oldest entry when full. Its reference source is covered by the PSF license.
This demo contains an independent Lean implementation and original proofs under
this repository's MIT license; no Python source is included.

## Build and check

```sh
bash demos/lean-lru-cache/build.sh
node --test demos/lean-lru-cache/test.mjs
node demos/lean-lru-cache/benchmark.mjs --assert
npm run demos:site
```

The build checks core, proofs, and Lean examples before generating a receipt,
compiling the same core through C to WebAssembly, and validating the Wasm binary.
The page checks source hashes against the receipt and provides highlighted
source, theorem/axiom inspection, Lean WASM, and Lean Web/Comparator controls.
`npm run demos:verify` rebuilds and verifies the complete Pages gallery.
