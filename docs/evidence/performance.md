# Native API performance baseline

Status: measured architecture POC evidence. This record covers the browser-profile JavaScript `Box` projection under Node. It does not establish production performance or browser startup performance.

The versioned [canonical spatial performance corpus](performance-corpus.md) fixes the operations, ownership rules, complexity evidence, and correctness vectors for the next timing suite. The independent Lean components now execute through generated native APIs in the [shared-runtime spatial harness](spatial-performance-harness.md). This page remains the earlier `Box` timing baseline until the spatial methodology and baseline receive review.

The spatial correctness gate builds a 1,301,915 byte main runtime, a 5,296 byte ordered-search module, a 26,292 byte spatial-index module, and a 2,116 byte independent consumer module. The test loads components on demand, checks one runtime initialization and one initialization per loaded library, passes the same retained index into the consumer, and reaches zero live resources before shutdown. These sizes are architecture evidence.

Date: 2026-08-08 UTC.

## Environment

| Property | Value |
|---|---|
| operating system | Linux 6.1.0-31-amd64 |
| architecture | x86-64 |
| processor | Intel Core i7-7700K at 4.20 GHz |
| logical CPUs | 8 |
| Node | 22.23.1 |
| runtime profile | browser, unshared growable memory |

The run used a warm filesystem cache. No browser, network, bundler, or compressed-transfer stage participated.

## Artifact identity

| Artifact | SHA-256 |
|---|---|
| lazy main Wasm | `c417b8c79c5f676959df95dcd9fcb310932ebc23d11069d059b2a29cfb102442` |
| Alpha lazy side module | `bfa12d7b6869c1eba84606ab8bb5f1c804836b2384c14186e6e9654f66f96f09` |
| canonical graph lock | `5559812f095c992b6c87f4b7917af8a6eea4eca832a52b3b931c9f5f24025a54` |

## Method

The benchmark calls the public POC surface returned by `libraries.load(alpha)`. It does not call `ccall`, `cwrap`, an underscore-prefixed export, or a numeric handle directly.

Cold measurements create a fresh main module, construct a fresh library loader, verify the Alpha side-module hash, load Alpha, then construct, read, and dispose one `Box`. The first `Box` construction triggers deferred Lean runtime and `Init` initialization.

Warm measurements perform 10,000 complete lifecycle operations before sampling. Read timing uses 60 batches of 10,000 calls. Lifecycle timing uses 60 batches of 1,000 construct, read, and dispose operations. Batched timing reduces the effect of the timer's resolution on individual calls. Each result contributes to a checksum so the calls remain observable.

## Results

| Operation | Samples | Median | p95 | Minimum | Maximum |
|---|---:|---:|---:|---:|---:|
| main module factory | 12 | 9.49 ms | 18.37 ms | 5.61 ms | 18.37 ms |
| Alpha integrity check and lazy load | 12 | 1.11 ms | 6.94 ms | 0.98 ms | 6.94 ms |
| first `Box` lifecycle, including deferred initialization | 12 | 1.46 ms | 49.43 ms | 1.24 ms | 49.43 ms |
| warm `box.read()` | 60 batches | 45.3 ns | 256.0 ns | 43.9 ns | 426.8 ns |
| warm `Box` construct, read, and dispose | 60 batches | 1.604 µs | 7.412 µs | 1.319 µs | 9.458 µs |

The 12-sample p95 is the maximum sample. More cold samples and separate process runs are required before setting a production p95 threshold.

The generation-safe registry changed the earlier WP4 median from 16.4 ns to 45.3 ns for a warm read and from 0.218 µs to 1.604 µs for a warm lifecycle. The added work includes token validation, wrapper lookup, borrow accounting, lease accounting, weak-reference registration, and stale-use protection. The absolute medians remain below 0.046 µs per read and 1.7 µs per lifecycle on this machine. The relative change is recorded for future optimization.

## Size results

| Artifact | Bytes |
|---|---:|
| browser startup main | 1,294,557 |
| browser lazy main | 1,294,472 |
| browser Alpha side module | 3,778 |
| browser Beta side module | 604 |
| browser Gamma side module | 605 |
| browser final-static three-library main | 1,294,401 |
| threaded startup main | 1,327,110 |
| threaded final-static three-library main | 1,323,599 |

The application pays for the Lean runtime and `Init` once. Side modules remain runtime-free. This result covers three small libraries, so it does not establish the size slope for realistic libraries or a 50-library graph.

## Reproduce

Build the browser profile before running the harness:

```sh
npm run build:lean-link-spike
npm run benchmark:poc
```

The command prints machine-readable JSON containing the environment, artifact hashes, sample counts, summaries, and limitations.

## Open measurements

The production suite still needs:

- scalar calls for every primitive width;
- strings, byte arrays, records, inductive types, and large arrays;
- copy and explicitly leased zero-copy paths;
- callbacks, nested re-entry, closures, promises, and cancellation;
- browser download, compilation, instantiation, and bundler startup;
- peak and steady-state memory;
- same-library and cross-library call comparisons;
- 1, 3, 10, and 50-library dependency graphs;
- final-static, side-module, and standalone-runtime controls; and
- repeated runs on declared reference machines with raw samples retained.
