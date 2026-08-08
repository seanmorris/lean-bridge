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
| lazy main Wasm | `ad6b73edca8493cbaedff3f854a6513253f92f8f0dfe44be4b1d6f9740fbe5b6` |
| Alpha lazy side module | `e98111b14c3effbe9b1e0d72b8bbe1e0fa44d79254171bcb08c3e2c3d0fd8853` |
| canonical graph lock | `dacd0fc5b4a3698cd322577f6e3b382ff2c90e8c3bcee626179e673691c820e4` |

## Method

The benchmark calls the public POC surface returned by `libraries.load(alpha)`. It does not call `ccall`, `cwrap`, an underscore-prefixed export, or a numeric handle directly.

Cold measurements create a fresh main module, construct a fresh library loader, verify the Alpha side-module hash, load Alpha, then construct, read, and dispose one `Box`. The first `Box` construction triggers deferred Lean runtime and `Init` initialization.

Warm measurements perform 10,000 complete lifecycle operations before sampling. Read timing uses 60 batches of 10,000 calls. Lifecycle timing uses 60 batches of 1,000 construct, read, and dispose operations. Batched timing reduces the effect of the timer's resolution on individual calls. Each result contributes to a checksum so the calls remain observable.

## Results

| Operation | Samples | Median | p95 | Minimum | Maximum |
|---|---:|---:|---:|---:|---:|
| main module factory | 12 | 8.10 ms | 19.52 ms | 6.57 ms | 19.52 ms |
| Alpha integrity check and lazy load | 12 | 1.17 ms | 6.85 ms | 0.85 ms | 6.85 ms |
| first `Box` lifecycle, including deferred initialization | 12 | 1.44 ms | 38.61 ms | 1.22 ms | 38.61 ms |
| warm `box.read()` | 60 batches | 29.4 ns | 88.6 ns | 15.5 ns | 96.2 ns |
| warm `Box` construct, read, and dispose | 60 batches | 0.221 µs | 0.411 µs | 0.144 µs | 0.483 µs |

The 12-sample p95 is the maximum sample. More cold samples and separate process runs are required before setting a production p95 budget.

## Size results

| Artifact | Bytes |
|---|---:|
| browser startup main | 1,289,844 |
| browser lazy main | 1,289,759 |
| browser Alpha side module | 1,029 |
| browser Beta side module | 604 |
| browser Gamma side module | 605 |
| browser final-static three-library main | 1,288,288 |
| threaded startup main | 1,323,826 |
| threaded final-static three-library main | 1,315,888 |

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
