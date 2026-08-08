# Architecture Decision Records

The complete working ADR bodies are mirrored in Virtual Office. This index records the accepted design package and the decisions that must be revalidated by the proof of concept.

| ADR | Decision | Status |
|---|---|---|
| 01 | Generated typed bindings over a narrow runtime ABI; dynamic values are an explicit escape hatch | Accepted for POC |
| 02 | Upstream Lean generated C plus Emscripten is the primary substrate; alternate backends require isolated evidence | Accepted for POC |
| 03 | Every public type explicitly chooses copy or handle semantics | Accepted for POC |
| 04 | Handles use side, nominal kind, slot, generation, and private runtime identity | Accepted for POC |
| 05 | Borrows and retained leases with deterministic disposal; finalizers are fallback only | Accepted for POC |
| 06 | Fixed callback signature adapters and same-agent nested re-entry | Accepted for POC |
| 07 | Stackless Promise/pending-operation baseline; Asyncify/JSPI/threads are optional profiles | Accepted for POC |
| 08 | Versioned error envelope and poisoned-runtime containment | Accepted for POC |
| 09 | Explicit persistent application factories and ESM-first packaging | Accepted for POC |
| 10 | Capability-first host access, bounded decoding, and removable observability | Accepted for POC |
| 11 | No generic weak Lean handle in v1 | Accepted for POC |
| 12 | No required Lean or Emscripten patch until an extension-point failure is reproduced | Accepted for POC |
| 13 | One Lean runtime per application with required PHP-Wasm-style side modules and optimized static composition | Revised; accepted for POC |
| 14 | Nix-locked reproducible graph and proof-to-artifact identity | Accepted for POC |
| 15 | JavaScript-first generated adapter over a host-neutral core with future WASI projection | Accepted for POC |
| 16 | Preserve AI-native semantic discovery and verified reuse as an ecosystem north star | Directional; implementation deferred |

## ADR 13 — Shared runtime and library loading

Every composable library publishes a runtime-free capsule. The runtime-loaded profile is required: one Emscripten main module owns Lean/runtime/bridge/system symbols, memory, table, registries, and initialization; library side modules bind into it. A PHP-Wasm-style generated descriptor recursively resolves dependencies and assets for startup or lazy loading. Final static linking consumes the same canonical graph and is the optimized release profile. Standalone per-library runtimes are explicit convenience exports only.

Side modules remain loaded until application shutdown in v1. The POC must prove three real and 50 synthetic libraries share one runtime and public contract.

## ADR 14 — Reproducible composition and artifact identity

One content-addressed lock describes sources, tools, generators, flags, features, dependencies, ABI, schema, initialization, proof/trust data, licenses, and artifacts. Nix derivations reproduce the closure. Static and runtime loaders must agree on it. Bit-for-bit reproducibility is tested explicitly. Proof metadata links exact Lean declarations and assumptions to exact generated and shipped artifacts while keeping compiler/runtime/host trust boundaries visible.

## ADR 15 — Host-neutral core

TypeScript is the first-class initial projection, not the only canonical interface. The portable schema covers copied values, resources, ownership, errors, package graphs, and assurance data. JS objects, prototypes, callbacks, Promises, DOM and Node APIs are explicit host capabilities. A future WIT/WASI projection must be possible for the portable subset without changing Lean declaration or proof identity.

## ADR 16 — AI-native reuse

Near-term implementation does not build a component search engine. It does preserve semantic specifications, theorem/assumption graphs, ABI/target compatibility, reproducible closures, benchmarks, licenses, and content identities so an AI or human can search for and compose an existing verified component before generating new code.

## Amendment rule

An ADR may change only with evidence, consequences for all six permanent lenses, migration effects on generated artifacts and lock data, and an explicit update to the risk register and POC gates.
