# Recommended Architecture

## System boundary

A `LeanWasmApplication` is the isolation and ownership boundary. It owns one:

- matched Lean runtime and RC heap;
- WebAssembly memory and indirect-call table;
- Emscripten main module and bridge kernel;
- JS-value and Lean-value registries;
- callback-signature, pending-operation, error, and trace domains;
- resolved library graph and initialization state; and
- capability policy and shutdown sequence.

Creating another application deliberately creates another isolated runtime. Installing another library into the same application does not.

## Components

### Library capsule

An independently published capsule contains a canonical manifest, generated host/schema/assurance fragments, relocatable static link inputs, a side-module shared object, initialization and symbol metadata, hashes, licenses, and conformance vectors. It does not contain a private Lean runtime.

The manifest identity is `publisher/package/version/buildHash`. Public declaration, type, handle-kind, callback-signature, error, theorem, assumption, and evidence IDs are package-qualified and collision checked.

### Main runtime

The Emscripten main module supplies Lean allocation/RC, task/runtime support, memory/table, bridge-core ABI, registries, fixed callback adapters, and host imports. The main module is long-lived and initialized once on its owning JavaScript agent.

### Side-module loader

The generated loader accepts library descriptors or capabilities. It recursively resolves direct dependencies from the canonical lock, verifies hashes and compatibility, rejects cycles/conflicts, locates assets, loads side modules into the existing main module, registers generated metadata, and invokes one idempotent initializer per build. Startup and lazy loading share the resolver. Code stays loaded until application shutdown in v1.

### Static compositor

For a known release graph, the compositor consumes the same lock and capsule inputs, merges schemas and assurance data, generates a root initializer/export plan, and final-links reachable objects with exactly one runtime. Static and dynamic profiles expose the same TypeScript declarations and observable semantics.

### Binding generator

Lean declarations and explicit bridge annotations produce:

- package descriptors and binding IR;
- ESM lifting/lowering wrappers;
- strict `.d.ts` declarations;
- validators/codecs and conformance vectors;
- documentation and examples;
- ABI/schema/export/initializer manifests; and
- proof, assumption, trust, source, build, and artifact provenance.

Generated outputs are deterministic and carry input hashes. CI regenerates from a clean tree and rejects drift.

## Value model

Every type chooses value or identity semantics explicitly.

- Scalars use specialized ABI lanes where safe.
- Strings, bytes, arrays, records, and acyclic inductives are copied according to a generated schema.
- Stateful Lean objects and closures use Lean handles.
- JavaScript objects, classes, functions, Promises, iterators, and platform resources use JS handles.
- Scoped zero-copy byte views are opt-in, epoch checked, and invalidated by scope end, memory growth, or shutdown.
- A dynamic `JS.Value` API is an explicit escape hatch, not the default public surface.

Handles encode side, nominal kind, slot, and generation. Runtime identity is private to the generated wrapper. Tokens are not pointers. Wrong-runtime, wrong-kind, disposed, or stale-generation uses fail before invocation.

## Identity and ownership

Each registry canonicalizes wrappers. Exporting the same Lean object twice returns the same live JavaScript wrapper; interning the same JavaScript object twice returns the same live JS token. All libraries in an application use the same registries, so cross-library values require no proxy translation.

Ownership uses explicit borrows and leases:

- call-scoped borrows cannot escape a generated call frame;
- retained parameters/results acquire a lease and release exactly once;
- explicit `dispose()` and structured resource scopes are authoritative;
- `FinalizationRegistry` only queues best-effort fallback release;
- shutdown rejects new work, drains/invalidates pending work, releases bridge owners in reverse dependency order, and invalidates the runtime epoch.

Version one does not promise automatic collection of JavaScript↔Lean cycles or generic weak Lean handles. APIs that create retained back-edges must expose a deterministic ownership cut.

## Calls, callbacks, and re-entry

Generated scalar adapters may use direct Wasm signatures but are semantically equivalent to the versioned frame ABI. Rich calls validate inputs, acquire borrows/leases, lower into a scoped arena, invoke the Lean adapter, lift the result, then unwind cleanup in reverse acquisition order.

Callbacks use a generated signature ID and a finite set of compatible Wasm function-table adapters. Nested same-agent re-entry creates a new frame/arena and shares registries. Cross-agent synchronous re-entry is not allowed; workers communicate asynchronously. Configured depth and resource budgets prevent unbounded recursion.

## Async

The portable baseline is stackless. A Lean-side `JS.Promise` capability initiates host work, stores a pending record, and returns with no suspended Wasm stack. Settlement later re-enters through a generated adapter, reacquires declared leases, and completes exactly once. Cancellation, late settlement, shutdown, and callback exceptions all use the same state machine.

Asyncify, JSPI, or pthread-backed Lean `Task` integration may become explicit target profiles only after separate measurement and support checks.

## Errors

All boundary failures use a versioned envelope with origin, stable code, message, structured details, cause, Lean declaration/trace data where available, JS error handle where safe, call/library/build IDs, and cleanup state. Ordinary Lean domain errors are generated as typed results or declared exceptions. ABI corruption, impossible registry states, or cleanup double-faults may poison the application instance; unrelated instances remain isolated.

## Reproducible composition and proof identity

One content-addressed lock names exact sources, Lean/Emscripten/generator versions, flags, features, libraries, schemas, dependencies, initializers, proof/trust fragments, licenses, and hashes. Nix derivations build capsules and composed profiles from that closure. Clean builds compare artifact hashes; nondeterminism is a failure to diagnose, not something hidden by the package manager.

Proof records distinguish theorem-checked behavior from trusted compiler/runtime/FFI/host assumptions. They link Lean declarations and theorem dependencies through generator, ABI, wrapper, lock, and final artifact identities. Reproducible build evidence and behavioral proof evidence reinforce but do not substitute for one another.

## JavaScript and WASI

JavaScript/TypeScript is the primary initial adapter and receives first-class object, closure, Promise, browser, Node, and bundler support. The canonical schema remains host-neutral for copied data, resources, errors, dependency graphs, and assurance metadata. JS-only features are capability tagged.

A future generator may project the portable subset into WIT/WASI Component Model or a native ABI. Version one does not depend on Component Model support and does not weaken JS semantics to pretend every capability is portable.

## Packaging

The ESM package root exports descriptors and generated APIs. Literal `new URL("./library.so.wasm", import.meta.url)` references let bundlers discover static assets. The application factory accepts an optional locator/CDN policy. Raw ESM, Node, browser main thread, worker, Vite, Rollup, Webpack, and React are required validation targets.

Standalone self-contained artifacts may exist only under an explicit `./standalone` export and never participate in normal graph composition.

## Security and observability

Safe APIs receive explicit host capabilities rather than ambient unrestricted global access. Descriptors and modules are integrity checked against the lock. Decoders enforce type, depth, node, byte, offset, and allocation limits. Dynamic APIs, unsafe pointer/handle access, and arbitrary host globals require visibly unsafe capabilities.

Debug snapshots and bounded redaction-aware traces expose registries, leases, callbacks, pending work, memory/table state, module loads, and initializer counts. Observability is removable/sampled in release builds and carries no semantic authority.
