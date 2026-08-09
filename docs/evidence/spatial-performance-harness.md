# Shared-runtime spatial performance harness

Status: executable harness. The harness runs the deterministic spatial workload through generated native JavaScript APIs. It emits measurements, but it does not define or approve a performance budget.

## Command

```sh
npm run benchmark:spatial -- \
  --workload interactive-clustered-2d \
  --profiles lazy,startup,final-static,islands \
  --output build/performance-wasm/interactive-suite.json
```

The benchmark client calls `lowerBound`, constructs `SpatialIndex`, calls its native methods, passes the index to `rangeChecksum`, and calls `dispose`. It contains no raw bridge symbol, generic dispatcher, pointer, or numeric handle.

## Composition profiles

| Profile | Runtime layout | Component layout |
|---|---|---|
| lazy | one Lean runtime | Runtime-free side modules load with their transitive dependencies when requested. |
| startup | one Lean runtime | Emscripten loads all three side modules while it creates the main module. |
| final-static | one Lean runtime | The application links all three component objects into one final Wasm artifact. |
| islands | three Lean runtimes | Three isolated main modules demonstrate duplicated runtime allocation. The complete workload runs in the island that owns the consumer closure. |

Lazy, startup, and final-static profiles execute the same generated operation trace and compare every result with the same expected-result digest. The islands profile executes that trace once while allocating three isolated runtimes. It quantifies the memory cost that the shared-runtime design avoids without pretending that retained identities can cross isolated heaps.

## Correctness gate

The harness rejects the run before it returns a measurement record when:

- any native result differs from the expected result at the same trace sequence;
- a workload, result, or manifest hash drifts;
- a retained `SpatialIndex` remains live after cleanup; or
- any runtime refuses deterministic shutdown.

Warmup calls are checked but excluded from steady-state samples. The report retains every measured sample in nanoseconds, plus minimum, median, p95, maximum, and total values. It records module factory times, component load times, Wasm memory, process RSS, lifecycle counters, artifact hashes, source revision, Node platform, workload identity, and explicit limitations.

## Architecture measurements

The current browser-profile artifacts are:

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| lazy main runtime | 1,301,915 | `ac49b9c56aac25a5fde26a67617505cdcb1172a97eb385d9854d5655e4596019` |
| startup main runtime | 1,302,029 | `ba0cce5efb723a2fca2a0fe9dc484751629d49e557d48763199133116b71fab5` |
| final-static application | 1,316,991 | `f19795f096da5b1ec7c9f0438a32bd18749c626454e3daa1fdc573c1b0c3ca11` |
| ordered-search side module | 5,296 | `c551f42c827df90df4f3ced811a12bf726511d6c5e40dc99d39a05d9acdd14f6` |
| spatial-index side module | 26,292 | `9b452c10f034209ef1b04ffe2eba9e4447e25872d13fe7114c92b37829c5b69e` |
| spatial-consumer side module | 2,116 | `3f7014e2ceb45d185de4fe68e5a9b216afa44d0d2865869bdbcb72b18c788142` |

One runtime starts with 17,039,360 bytes of Wasm memory in this profile. The three-island comparison starts with 51,118,080 bytes. The threefold allocation follows directly from creating three independent memories. Process RSS includes Node and harness state, so the report keeps it separate from Wasm memory.

The measurement methodology node must set fork counts, cache rules, noise limits, uncertainty calculations, and reference machines before this harness can produce an approved baseline or regression budget.
