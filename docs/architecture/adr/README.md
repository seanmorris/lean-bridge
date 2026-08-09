# Architecture Decision Records

The complete working ADR bodies are mirrored in Virtual Office. This index records the accepted design package and the decisions that must be revalidated by the proof of concept.

| ADR | Decision | Status |
|---|---|---|
| 01 | Generated native callables and idiomatic objects over a private narrow runtime ABI; generic dispatch is internal | Revised; accepted for POC |
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
| 17 | Accessibility, zero-friction host conventions, and progressive optional learning are architecture gates | Accepted for POC |
| 18 | Universal composition contracts and independent-component CI evidence at every layer | Accepted for POC |
| 19 | One language-neutral binding IR with namespaced producer adapters | Accepted for POC |

## ADR 1: Generated native binding surface

The narrow frame/symbol ABI and generic dispatcher are private implementation details. Every public Lean declaration projects to a direct named host callable with fully generated validation, marshalling, handle conversion, ownership, cleanup, async/iterator and error adaptation. Copied values project as idiomatic value types; identity-bearing values project as canonical classes/resources with constructors/factories, properties, methods and host-language lifecycle conventions. JavaScript and Python consumers require no manual wrappers or calling-convention knowledge. CI rejects raw dispatch, Wasm, ABI symbols, pointers, numeric handles, public `any`, or ownership flags in ordinary exports, declarations/stubs and docs.

## ADR 13: Shared runtime and library loading

Every composable library publishes a runtime-free capsule. The runtime-loaded profile is required: one Emscripten main module owns Lean/runtime/bridge/system symbols, memory, table, registries, and initialization; library side modules bind into it. A PHP-Wasm-style generated descriptor recursively resolves dependencies and assets for startup or lazy loading. Final static linking consumes the same canonical graph and is the optimized release profile. Standalone per-library runtimes are explicit convenience exports only.

Side modules remain loaded until application shutdown in v1. The POC must prove three real and 50 synthetic libraries share one runtime and public contract.

## ADR 14: Reproducible composition and artifact identity

One content-addressed lock describes sources, tools, generators, flags, features, dependencies, ABI, schema, initialization, proof/trust data, licenses, and artifacts. Nix derivations reproduce the closure. Static and runtime loaders must agree on it. Bit-for-bit reproducibility is tested explicitly. Proof metadata links exact Lean declarations and assumptions to exact generated and shipped artifacts while keeping compiler/runtime/host trust boundaries visible.

## ADR 15: Host-neutral core

TypeScript is the first-class initial projection, not the only canonical interface. The portable schema covers copied values, resources, ownership, errors, package graphs, and assurance data. JS objects, prototypes, callbacks, Promises, DOM and Node APIs are explicit host capabilities. A future WIT/WASI projection must be possible for the portable subset without changing Lean declaration or proof identity.

## ADR 16: AI-native reuse

Near-term implementation does not build a component search engine. It does preserve semantic specifications, theorem/assumption graphs, ABI/target compatibility, reproducible closures, benchmarks, licenses, and content identities so an AI or human can search for and compose an existing verified component before generating new code.

## ADR 17: Accessibility and gradual adoption

JavaScript and Python consumers use ordinary ecosystem installation and language conventions. Lean, Nix, Wasm, proof, ABI, loader, and ownership mechanics remain generated/internal on the happy path. Assurance and implementation depth are progressively disclosed rather than prerequisites. The POC measures install-to-first-call time, commands, configuration, unfamiliar concepts, handwritten glue, diagnostics, migration effort, and escape-hatch use. Accessibility is required in human documentation and machine/agent output and cannot rely on color alone.

## ADR 18: Universal composition contract

Every supported abstraction layer defines compatibility identities and composition rules for semantics, types/effects, ABI, runtime/ownership, errors/async, proofs/trust, metadata, packages, locks, and target projections. CI composes at least two independently built components at every claimed layer. Startup-side, lazy-side, and final-static profiles consume the same canonical graph and expose equivalent contracts. A composition claim without independent evidence is unverified and blocks production approval.

## ADR 19: Language-neutral binding IR

One versioned binding IR owns declaration, type, identity, mutability, ownership, lifetime, failure, result-delivery, capability, documentation, and assurance semantics. JavaScript, TypeScript, C, Rust, Python, ABI, and lifecycle generators consume this IR. Backend code may choose idiomatic syntax and report capability gaps. It may not restate or override binding semantics.

Lean is the first producer adapter. Lean declaration identities, elaborator details, export selection, and proof provenance enter through a declared producer and namespaced extensions. Another verified source can populate the same core without pretending that source-specific evidence is universal. The validator rejects source metadata that bypasses a namespace and rejects abstraction that loses lifetime or assurance meaning.

## Amendment rule

An ADR may change only with evidence, consequences for all eight permanent lenses, migration effects on generated artifacts and lock data, and an explicit update to the risk register and POC gates.
