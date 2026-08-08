# Executive Feasibility Recommendation

## Decision

**Yes, with constraints.** Ahead-of-time compiled Lean libraries can be exposed as idiomatic JavaScript/TypeScript packages, and Lean can manipulate retained JavaScript values, callbacks, and asynchronous capabilities through a generated bridge. The recommended approach uses upstream Lean-generated C, a matched Lean runtime compiled with Emscripten, generated typed bindings, and a narrow handle/frame ABI.

The decisive constraint is that the application—not an individual library—is the runtime boundary. A composed application has exactly one Lean reference-counting heap, WebAssembly memory/table, symbol universe, bridge registry pair, pending/error domain, and initialization/shutdown sequence.

## Recommended path

Publish each Lean library as a runtime-free capsule containing:

- a versioned side-module/shared-object artifact for runtime loading;
- relocatable objects or an archive for final static composition;
- a recursive dependency and initialization descriptor;
- generated ESM, TypeScript declarations, validators, documentation, and tests;
- schema, ABI, proof, trust, provenance, license, and content-hash metadata.

One Emscripten main module owns the Lean runtime and bridge kernel. Side modules leave those symbols unresolved and bind into the main module, sharing its memory, table, heap, registries, and object identities. The loader deliberately adapts PHP-Wasm's `sharedLibs`, `dynamicLibs`, version-aware helper packages, and `locateFile` architecture.

The same locked dependency graph can be statically final-linked with one runtime for maximum dead-code elimination and lower startup. Runtime-loaded and final-static profiles must expose the same generated public contract and assurance graph.

## Expected developer experience

```ts
import { createLeanApp } from "@lean-wasm/runtime";
import graph from "@lean-wasm/graph";
import statistics from "@lean-wasm/statistics";

await using lean = await createLeanApp({ libraries: [graph, statistics] });
const mean = await lean.statistics.mean([1, 2, 3]);
```

The consumer does not manage Wasm URLs, memories, tables, symbols, handles, reference counts, or loader order. Advanced locator and lazy-loading controls remain available outside the normal path.

## Highest risks

1. Full Lean runtime compatibility under Emscripten side-module dynamic linking.
2. Correct reference counting and deterministic ownership across JS GC and Lean RC.
3. Callback signature adapters, nested re-entry, async settlement, and cleanup races.
4. Export retention, symbol/version conflicts, and bundler asset behavior.
5. Binding generated proof metadata to the exact shipped and reproducibly rebuilt artifact.

Each has an early falsification experiment in the POC plan.

## Implementation recommendation

Approve only the architecture-testing POC first. Do not approve production hardening until three real libraries and a synthetic 50-library graph share one main runtime, pass identity/lifecycle checks, rebuild reproducibly, and present one drift-free TypeScript API in both side-module and static profiles.
