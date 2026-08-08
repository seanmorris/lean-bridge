# Native API performance baseline

Status: measured architecture POC evidence. This record covers the browser-profile JavaScript `Box` projection under Node. It does not establish production performance or browser startup performance.

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
| lazy main Wasm | `1e866f7ba5447da504612b95859f7dd65925e3637ec537cc3762c778b5a1678e` |
| Alpha lazy side module | `bfa12d7b6869c1eba84606ab8bb5f1c804836b2384c14186e6e9654f66f96f09` |
| canonical graph lock | `5559812f095c992b6c87f4b7917af8a6eea4eca832a52b3b931c9f5f24025a54` |

## Method

The benchmark calls the public POC surface returned by `libraries.load(alpha)`. It does not call `ccall`, `cwrap`, an underscore-prefixed export, or a numeric handle directly.

Cold measurements create a fresh main module, construct a fresh library loader, verify the Alpha side-module hash, load Alpha, then construct, read, and dispose one `Box`. The first `Box` construction triggers deferred Lean runtime and `Init` initialization.

Warm measurements perform 10,000 complete lifecycle operations before sampling. Read timing uses 60 batches of 10,000 calls. Lifecycle timing uses 60 batches of 1,000 construct, read, and dispose operations. Batched timing reduces the effect of the timer's resolution on individual calls. Each result contributes to a checksum so the calls remain observable.

## Results

| Operation | Samples | Median | p95 | Minimum | Maximum |
|---|---:|---:|---:|---:|---:|
| main module factory | 12 | 8.56 ms | 16.12 ms | 5.22 ms | 16.12 ms |
| Alpha integrity check and lazy load | 12 | 1.16 ms | 5.65 ms | 0.74 ms | 5.65 ms |
| first `Box` lifecycle, including deferred initialization | 12 | 1.26 ms | 39.16 ms | 1.16 ms | 39.16 ms |
| warm `box.read()` | 60 batches | 16.4 ns | 65.7 ns | 15.7 ns | 91.4 ns |
| warm `Box` construct, read, and dispose | 60 batches | 0.218 µs | 0.264 µs | 0.144 µs | 0.402 µs |

The 12-sample p95 is the maximum sample. More cold samples and separate process runs are required before setting a production p95 budget.

## Size results

| Artifact | Bytes |
|---|---:|
| browser startup main | 1,292,186 |
| browser lazy main | 1,292,101 |
| browser Alpha side module | 3,778 |
| browser Beta side module | 604 |
| browser Gamma side module | 605 |
| browser final-static three-library main | 1,293,376 |
| threaded startup main | 1,326,087 |
| threaded final-static three-library main | 1,322,585 |

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
