# Executive Feasibility Recommendation

## Decision

**Approved for the architecture-testing POC.** Ahead-of-time compiled Lean libraries can expose idiomatic host APIs through upstream Lean-generated C, a matched Lean runtime compiled with Emscripten, generated typed bindings, and a narrow private handle/frame ABI. The shared-runtime, native JavaScript object, synchronous callback, and asynchronous Promise paths now pass. Exported Lean closures, additional callback signatures, broader retained JavaScript capabilities, and generated downstream-language packages remain POC work.

The application is the runtime boundary. An individual library cannot own that boundary. A composed application has exactly one Lean reference-counting heap, WebAssembly memory/table, symbol universe, bridge registry pair, pending/error domain, and initialization/shutdown sequence.

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

The same portable subset must project into an ordinary Python package rather than requiring Python developers to learn a JavaScript/Wasm workflow. Host-specific capabilities remain explicit, but Lean, Nix, proof, ABI, loader, and ownership machinery stays behind generated host conventions. Learning and assurance inspection are progressive and optional.

Developer-experience acceptance measures install-to-first-call time, commands and configuration, unfamiliar concepts, handwritten glue, diagnostic recovery, migration effort, and manual escape-hatch use. Composition acceptance requires CI evidence across independently built components at semantic, ABI, runtime, proof/trust metadata, package, lock, and static/dynamic graph layers.

## Highest remaining risks

1. General binding generation across primitives, copied values, resources, errors, callbacks, asynchronous work, and multiple host languages.
2. Correct reference counting and deterministic ownership across JavaScript GC and Lean RC for the complete lifecycle matrix.
3. Exported Lean closure projection, additional callback signatures, asynchronous callback settlement, and cleanup races.
4. Bundler, browser, worker, and registry behavior for recursively loaded assets.
5. Binding generated proof metadata to the exact shipped and reproducibly rebuilt artifact.
6. Startup, memory, and size slopes across 10 and 50 independently packaged libraries.

Each has an early falsification experiment in the POC plan.

## Implementation recommendation

Continue the approved architecture-testing POC. Production hardening requires the generated API, complete lifecycle matrix, browser and downstream-language fixtures, proof-to-artifact identity chain, and synthetic 50-library measurements. The three-library shared-runtime and independent-root reproducibility gates already pass.
