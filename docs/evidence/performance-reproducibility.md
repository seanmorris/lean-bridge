# Performance reproducibility and self-consistency

Status: clean architecture measurement. Two independent source trees rebuilt the locked performance graph from one committed revision. A second check ran one fixed workload three times and separated semantic identity from elapsed-time variance.

## Clean build comparison

The gate used commit `7a9394b3843aaad30b3b15bc2171f657a6c51b1c`. It cloned that revision twice without local hard links, gave each checkout its own writable build tree, and built the spatial and 50-library scaling suites in both roots.

Each inventory contained 385 files and 17,838,911 bytes. Both inventories produced SHA-256 `6e4e033ca769db9a2f1c618c00bda5f108b8c639eb8dd87b3a22ee26d7269865`. The comparison found zero missing files and zero byte differences.

The exact comparison covers:

- benchmark Lean, C, JavaScript, and JSON sources;
- locked datasets and result schemas;
- generated Lean and C source;
- generated JavaScript and TypeScript bindings;
- lazy, startup, final-static, and scaling Wasm artifacts;
- Emscripten JavaScript loaders; and
- normalized symbol, export, object inspection, and hash manifests.

Timing records do not belong in the build identity because they record the machine executing the benchmark. Compiler objects, Lean object files, and raw linker maps are transient products. Raw linker maps contain checkout paths. The first comparison exposed 110 path-bearing compiler objects and 53 path-bearing linker maps while every executable and generated public artifact already matched. The final inventory excludes those transient files and states those exclusions in its machine record.

The comparison record is 148,750 bytes with SHA-256 `a19a362523132cf0b83ab75d658de1062b9d525eb9a9970712175d6e810d3a95`.

## Fixed-workload consistency

Node 22.23.1 ran three repetitions on Linux x64 with an Intel Core i7-7700K and eight logical CPUs. Each repetition executed `interactive-clustered-2d` through the lazy, startup, final-static, and isolated-runtime profiles.

All three repetitions produced semantic SHA-256 `4533e9607ab120e961c62aaf83989b5f9c96365dc0cac911dda029352431c6a5`. That digest covers the workload identity, artifact identities, runtime count, correctness results, operation set, shutdown state, and Wasm memory. A changed result, artifact, profile, operation set, runtime count, or shutdown outcome fails the check.

The report contains 62 timing metrics. It records every raw value plus minimum, median, maximum, mean, standard deviation, coefficient of variation, and spread ratio. Timing variance does not alter semantic acceptance.

The largest observed spread was the lazy profile's range p95, from 22,132 ns to 689,275 ns. Lazy loading of ordered search ranged from 1,888,118 ns to 42,793,681 ns. These values show why one warm-process run cannot establish a release budget. Nodes 793 and 794 must approve environments, repetition counts, summaries, and thresholds before timing can block a release.

The self-consistency record is 26,025 bytes with SHA-256 `46049a2ffac057f6ccdd489d8f96a56f966e4a46c0e830d075f9bad4d860158d`.

## Commands

```sh
npm run test:performance-reproducibility
npm run verify:performance-reproducibility -- \
  --output build/performance-reproducibility/build-comparison.json
node scripts/benchmark-self-consistency.mjs \
  --repetitions 3 \
  --output build/performance-reproducibility/self-consistency.json
```
