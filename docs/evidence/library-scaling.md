# Lean library scaling evidence

Status: executable architecture measurement. The suite measures 1, 3, 10, and 50 independently compiled Lean libraries through generated `ping` functions.

## Public call boundary

Each generated package exposes one ordinary function:

```js
const component = await libraries.load("scale-050");
const result = component.ping(1000);
```

The package hides the internal Emscripten symbols, ordinals, function pointers, linker calls, and initializer calls. The benchmark client and harness contain no raw bridge symbol or generic dispatcher.

The build generates fifty separate Lean source modules. Every module exports its own `UInt32 -> UInt32` function and its own Lean initializer. A constructor in each runtime-free side module registers that function and initializer with the application runtime. The final-static build links the same generated Lean and registration objects into one application artifact.

## Graphs and profiles

The graph manifest defines a linear dependency chain and selects the first 1, 3, 10, or 50 components. The harness executes each graph through four profiles:

| Profile | Runtime instances | Component loading |
|---|---:|---|
| lazy | 1 | The loader resolves the chain and loads each side module on demand. |
| startup | 1 | Emscripten loads every selected side module while it creates the main module. |
| final-static | 1 | The linker includes every selected component in the application Wasm. |
| isolated | library count | Each library receives a separate Lean runtime and memory for the duplication comparison. |

Every run validates one first call through every generated API. It also requires the expected registration count, one initializer run per library, one runtime initialization per runtime, zero rejected calls, and successful shutdown.

## Recorded phases

The machine record contains exact artifacts, byte counts, SHA-256 hashes, source revision, environment, cache state, raw timing samples, process memory, Wasm memory, and runtime counters. It records:

- local artifact reads;
- first ESM import;
- module factory execution;
- dependency graph resolution;
- library loading and initialization;
- first generated native call for every library; and
- memory after every phase and after shutdown.

Emscripten combines dynamic compilation, linking, and constructor registration in `loadDynamicLibrary`. Lazy loader events therefore report one combined duration and a registration-count delta. Startup and final-static constructors run inside the module factory. The report keeps those boundaries explicit instead of assigning invented subphase times.

## Architecture result

One browser-profile Lean runtime allocates 17,039,360 bytes of Wasm memory in this build. The composed graph keeps that allocation constant from one through fifty libraries. Fifty isolated runtimes allocate 851,968,000 bytes.

| Libraries | Profile | Runtimes | Distributed artifact bytes | Wasm memory bytes |
|---:|---|---:|---:|---:|
| 1 | lazy | 1 | 1,369,959 | 17,039,360 |
| 3 | lazy | 1 | 1,371,111 | 17,039,360 |
| 10 | lazy | 1 | 1,375,143 | 17,039,360 |
| 50 | lazy | 1 | 1,398,183 | 17,039,360 |
| 50 | startup | 1 | 1,399,256 | 17,039,360 |
| 50 | final-static | 1 | 1,365,369 | 17,039,360 |
| 50 | isolated | 50 | 1,398,183 | 851,968,000 |

The isolated artifact total describes the distributed files once. The memory total describes fifty live instances. That distinction separates download size from runtime duplication.

## Initial timing record

The initial local run executed one sample per graph and profile on Node 22. It warmed the filesystem while hashing artifacts before module creation. These measurements verify reporting coverage and phase attribution. Node 793 must define repetitions, reference machines, noise rules, and uncertainty before the project treats timing values as a baseline.

| Libraries | Profile | Module factory median | Complete library load median | First native call median |
|---:|---|---:|---:|---:|
| 1 | lazy | 12.910 ms | 39.516 ms | 58.607 µs |
| 1 | startup | 13.064 ms | 36.125 ms | 18.976 µs |
| 1 | final-static | 12.073 ms | 34.402 ms | 30.795 µs |
| 3 | lazy | 13.465 ms | 4.819 ms | 6.254 µs |
| 3 | startup | 19.718 ms | 40.498 ms | 3.278 µs |
| 3 | final-static | 8.735 ms | 39.028 ms | 3.576 µs |
| 10 | lazy | 13.887 ms | 10.014 ms | 4.279 µs |
| 10 | startup | 23.424 ms | 34.430 ms | 3.320 µs |
| 10 | final-static | 8.254 ms | 35.677 ms | 5.032 µs |
| 50 | lazy | 11.894 ms | 145.681 ms | 3.991 µs |
| 50 | startup | 41.203 ms | 35.973 ms | 3.692 µs |
| 50 | final-static | 9.492 ms | 36.395 ms | 3.031 µs |

The isolated profile reports per-runtime medians. Its fifty-library run measured a 7.338 ms module factory median, a 2.060 ms library-load median, and a 7.215 µs first-call median. The architecture comparison uses its 851,968,000-byte aggregate Wasm allocation, not those per-runtime timing medians.

## Commands

```sh
npm run build:performance-scaling
node --test tests/performance-scaling.test.mjs
npm run benchmark:scaling -- \
  --counts 1,3,10,50 \
  --profiles lazy,startup,final-static,isolated \
  --output build/performance-scale/scaling-suite.json
```
