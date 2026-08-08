# Proof-of-Concept Plan

The POC begins only after architecture approval. It tests the architecture's failure-prone boundaries; it is not a prematurely polished production library.

## Fixtures

- **Alpha:** primitives, a copied record, and opaque `Model` identity.
- **Beta:** consumes `Alpha.Model`, retains and returns a JavaScript object, and supports nested calls.
- **Gamma:** callbacks, a Lean closure, Promise/cancellation, errors, and a complete cross-library call cycle.
- **Synthetic graph:** generated 1-, 3-, 10-, and 50-library dependency shapes with diamonds, duplicates, and controlled conflicts.
- **Consumers:** raw ESM, Node, browser, worker, Vite, Rollup, Webpack, React; later esbuild, Parcel, and SSR as feasible.

Each library is compiled independently and must not define Lean runtime, allocator, bridge-core, memory, table, or registry symbols.

## Ordered work packages

1. Preserve the preliminary README; record approval, pins, licenses, generated-file policy, and the canonical Nix/graph-lock format.
2. In an isolated spike, build one Emscripten main module plus two Lean side modules and prove they share memory/table/runtime state.
3. Define the runtime-free capsule, recursive resolver, startup/lazy loader, integrity/version/conflict rules, and final-static compositor over one lock.
4. Establish one-time Lean runtime and module initialization plus repeat scalar/string calls and structured errors.
5. Implement generation-safe JS and Lean registries, canonical wrappers, borrows, leases, disposal, shutdown, and debug snapshots.
6. Generate descriptors, ESM, strict `.d.ts`, validators, docs, schemas, tests, and assurance data from Lean declarations; make drift fail CI.
7. Run the Alpha/Beta/Gamma side-module cycle with cross-library opaque and JS identity.
8. Add JS callbacks, exported Lean closures, nested re-entry, self-disposal, throws, and cleanup.
9. Add stackless Promise settlement, cancellation, late settlement, shutdown races, and poisoned-runtime behavior.
10. Validate raw ESM, Node, workers, bundlers, and the React mount/update/unmount lifecycle without consumer Wasm configuration.
11. Build 1/3/10/50-library graphs in side-module, static-final, and standalone-control profiles; audit symbols and measure size/startup/memory/calls.
12. Rebuild the exact graph in clean Nix environments and compare artifact hashes.
13. Generate a nonbinding WIT/WASI projection for the portable subset as a host-neutrality test.
14. Reconcile evidence into ADRs, risks, patches, and a separate production-hardening approval.

## Complete representative scenario

`Gamma.analyze(Alpha.Model, jsDocument, onProgress, AbortSignal)` validates and retains async-lived inputs. Gamma calls a host Promise and returns with an empty Wasm stack. Settlement re-enters Gamma; Gamma invokes `onProgress`; the callback synchronously calls Beta with the same Alpha model and JavaScript object. Nested frames unwind. Gamma resolves a copied report and the canonical model wrapper. Explicit disposal returns every registry, lease, callback, pending, and frame counter to baseline.

Run success, JavaScript throw, Lean error, cancellation, self-disposal, late settlement, and shutdown-during-callback variants.

## Structural acceptance

- Exactly one participating memory and expected table per application instance.
- One definition set for Lean runtime, allocator, tasks, and bridge core in the main/final module.
- Side modules import those contracts and initialize once.
- The runtime baseline is not multiplied by library count.
- Cross-library Lean and JavaScript values retain canonical identity.
- Static and runtime-loaded profiles resolve one lock and expose identical schema/TypeScript/assurance hashes.
- Descriptor conflicts and stale/cross-runtime/wrong-kind handles fail deterministically.

## Lifecycle acceptance

- All deterministic live counts return exactly to baseline after each batch.
- Run at least 100,000 cycles per ownership shape.
- After a 20% warm-up, leaked bridge state causes no Wasm-page growth in the final 80%.
- Forced-GC host growth after cleanup remains within `max(1 MiB, 1%)` on the reference environment; this is supplemental, not the correctness oracle.
- Every callback/pending operation completes or cancels exactly once.

## Performance and size gates

Record exact hardware, OS, tools, flags, caches, and raw samples. Provisional gates:

- warm typed scalar median target ≤3 µs, hard p95 ≤25 µs, and median ≤10× a raw Wasm control;
- typed handle median ≤10 µs and p95 ≤30 µs;
- dynamic escape hatch ≤4× the typed equivalent for the same payload;
- 1 KiB copy, callback round trip, and closure call p95 ≤50 µs;
- Promise bridge bookkeeping p95 ≤100 µs excluding host work;
- cross-library calls within 20% of equivalent same-library calls;
- observability disabled overhead <2%; release regressions >20% fail;
- three-library cached factory-ready median ≤250 ms and p95 ≤500 ms on the recorded reference host;
- compressed application Wasm planning ceiling 15 MiB for the representative graph;
- runtime JS ≤50 KiB gzip and generated wrapper average ≤1 KiB per ordinary binding;
- final-static three-library artifact <75% of the sum of three standalone artifacts;
- 50-library shared-runtime initial memory <20% of 50 standalone runtime baselines and incremental empty-library memory <10% of the one-runtime baseline.

Thresholds may change only with raw evidence and ADR/risk updates. A test may never “pass” by creating private runtimes, hand-writing public types, changing the locked graph between profiles, or hiding trust boundaries.

## Instrumentation

Capture registry slot/generation state, leases/borrows, wrapper-cache behavior, callback frames, pending operations, arena/copy bytes, memory pages/table size, initializer counts, runtime symbol identity, error state, bounded transition traces, Wasm import/export/symbol audits, and clean-build hashes. Store failure bundles with reproduction commands and redacted raw data.

## Non-goals

- runtime Lean compilation;
- automatic cross-heap cycle collection;
- side-module code unloading;
- transparent support for every dependent Lean type;
- a production WASI adapter or IDE overlay;
- an algorithm marketplace/search engine;
- mandatory Lean/Emscripten forks.
