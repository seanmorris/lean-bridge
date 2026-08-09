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
| 20 | Rust as the second semantic-parity backend; C++ remains a later packaging backend | Accepted for POC |
| 21 | One generated PHP projection over closed native Zend and PHP-Wasm transport interfaces | Accepted for POC |
| 22 | Compile each component once; registry backends package an immutable canonical release bundle without compiler access | Accepted for POC |

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

## ADR 20: Rust semantic-parity backend

Rust is the second high-level binding backend for the POC. Rust expresses copied values through ownership, receiver-anchored results through borrows, failures through `Result`, host callbacks through closure traits, and deterministic resource cleanup through `Drop`. These projections expose Binding IR lifetime decisions in the host type system and make semantic drift visible during compilation.

The generator emits a crate with a hidden typed runtime trait containing one method per declaration. The public module contains no generic dispatcher or runtime identity value. Finite generic declarations produce concrete functions for the declared specializations. Unsupported arbitrary integers, asynchronous delivery, rich error payloads, and other uncovered shapes fail generation.

Stable Rust cannot implement the `Fn` traits for a generated owned resource. A returned Lean closure therefore exposes `.call(...)`, and the package manifest records that capability gap. C++ remains a later backend for package reach. It is not needed to establish that two high-level host projections can consume the same Binding IR.

## ADR 21: Shared PHP projection

Binding IR compiles into one PHP surface before either PHP transport is selected. Copied records become typed value objects. Identity-bearing resources become canonical PHP objects with deterministic `close()`. Host callbacks remain normal callables. Returned Lean closures become invokable objects. Declared failures become named exceptions. Iterators use `Traversable`. Asynchronous results use the generated bridge `Awaitable` contract because PHP has no native awaitable interface.

The generated internal transport interface contains one typed method per declaration plus typed lifecycle methods. It contains no generic dispatcher. Native Zend and PHP-Wasm adapters implement the same interface. Every adapter publishes a capability manifest. Any missing required capability blocks package generation.

The PHP-Wasm adapter reuses Vrzno's paired weak identity-index pattern and the maintained `weakermap` package. It does not carry another copied `WeakerMap` implementation. Explicit ownership release remains authoritative. Weak finalization is a recovery path.

## ADR 22: Compile once, package many times

### Context

Npm, Cargo, PyPI, C, C++, and future registries need different layouts and metadata. Independent build pipelines would let each ecosystem compile a different Lean component, reinterpret Binding IR, select another dependency graph, or publish a version that no longer identifies the proved artifact.

### Alternatives considered

1. Let every registry backend run the Lean build and generate its own bindings. This duplicates toolchains and makes cross-registry artifact identity accidental.
2. Publish one registry package as the source for every other registry. This makes one host ecosystem authoritative and excludes targets that cannot consume its package shape.
3. Build one host-neutral release bundle, then project it into registry packages. Each backend receives immutable artifacts and one canonical manifest.

### Decision

The pinned Nix flake and canonical resolved graph are the only compilation authorities. They compile each component once and emit one content-addressed release bundle. That bundle owns component and version identity, Binding IR and graph identity, core artifact hashes, capabilities, documentation, assurance metadata, licenses, provenance, and target eligibility.

Registry backends receive the bundle as read-only input. They MAY select applicable files, arrange paths, copy or rename files, render registry metadata from canonical fields, archive, compress, sign, and attest. They MUST NOT invoke Lean, Lake, C or C++ compilers, Rust compilers, Emscripten, linkers, build systems, or package lifecycle scripts. They MUST NOT regenerate binding semantics, resolve another dependency graph, rewrite a core artifact, choose an independent version, or substitute an artifact with the same filename.

The backend execution plan declares `compilerAccess: false`, `scriptPolicy: disabled`, `versionSource: canonical-manifest`, and `semanticSource: canonical-manifest`. Every copied core artifact records equal source and packaged hashes. The policy validator rejects forbidden operations, compiler or linker commands, lifecycle scripts, version drift, semantic-source drift, and core hash changes before a registry archive can enter the release rehearsal.

### Consequences

Adding an ecosystem requires a packaging backend and install test. It does not require another Lean build definition. Registry-specific metadata can describe native conventions but cannot change public semantics. A target that cannot represent the canonical contract reports a capability gap and is omitted.

The release bundle becomes the handoff between expensive trusted compilation and low-authority packaging. Backends can run with a read-only bundle mount, an empty output directory, no compiler toolchain, no network, and disabled package scripts. Node 832 will use execution tracing to verify those environmental constraints.

### Permanent lenses

1. Shared runtime: every registry package points to the same graph and runtime profile. A backend cannot introduce a private runtime.
2. Native bindings: backends package generated direct APIs. They cannot add public wrappers or expose generic dispatch.
3. Assurance: every package carries the same proof, trust, source, toolchain, and artifact identities.
4. Reproducibility: one flake output is the canonical build. Backend outputs are deterministic projections of its manifest.
5. Host neutrality: the bundle is language-neutral. JavaScript remains first-class without becoming the compilation authority.
6. AI reuse: package identities and semantic metadata remain stable across registries.
7. Accessibility: consumers install ordinary ecosystem packages. Contributors do not maintain several build systems.
8. Composition: every package resolves the same dependency graph and declares the same semantic compatibility facts.

### Unresolved work

Node 828 defines the closed canonical manifest. Node 829 builds the flake bundle. Nodes 830 through 832 implement packaging backends, release rehearsal, clean installs, and build tracing.

## Amendment rule

An ADR may change only with evidence, consequences for all eight permanent lenses, migration effects on generated artifacts and lock data, and an explicit update to the risk register and POC gates.
