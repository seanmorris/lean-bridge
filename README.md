# Lean WebAssembly Bridge

> Architecture brief and active falsification-driven proof of concept.

The review-ready documents are indexed in [the architecture design package](docs/architecture/README.md).
Current implementation evidence covers the [shared Lean runtime](docs/evidence/lean-runtime-link-spike.md) and the [canonical content-addressed capsule graph](docs/evidence/capsule-graph.md).

This project will make compiled Lean libraries feel ordinary to JavaScript and TypeScript developers while preserving Lean's runtime semantics, proof information, and ability to target environments beyond JavaScript.

The bridge is inspired directly by [Vrzno](https://github.com/seanmorris/vrzno) and [PHP-Wasm](https://github.com/seanmorris/php-wasm), but it is not a PHP port. Vrzno supplies the model for natural values and calls across a language boundary. PHP-Wasm supplies the model for independently packaged `.so` libraries that resolve their assets and dependencies, then load into one already-running WebAssembly runtime.

## Non-negotiable architecture invariants

These are decision lenses and veto gates for every subsystem, ADR, generated artifact, benchmark, and review. They are not checklist items that can be satisfied once and forgotten.

1. **One composed application, one Lean runtime.** All libraries in an application instance share one Lean runtime, reference-counting heap, WebAssembly memory and table, symbol space, handle registry, pending-operation registry, initialization domain, and failure domain. A normal Lean library must never embed a private copy of the runtime.
2. **Generated TypeScript and a boring npm experience.** Lean declarations and bridge metadata are the source of truth for runtime wrappers, `.d.ts` files, validators, documentation, schemas, tests, and assurance metadata. JavaScript developers install, import, and call a package without configuring WebAssembly internals or maintaining handwritten types that can drift.
3. **Assurance must remain explainable.** Generated metadata must distinguish machine-checked claims, trusted-boundary assumptions, and unverified behavior. Every architectural choice must preserve enough provenance to explain what is proved, what is merely assumed, and which artifact the proof describes.
4. **Adoption friction is an architectural metric.** JavaScript and Python developers install an ordinary package, import it using familiar language conventions, and make a call. The bridge absorbs Lean, Nix, Wasm, loader, ownership, proof, and ABI mechanics. Learning is optional and progressive; diagnostics and assurance details become available when requested.
5. **Every abstraction composes or it is a dead end.** Semantics, types and effects, ABI, runtime and ownership, errors and async behavior, proofs and assumptions, metadata, packages, locks, and static/dynamic graphs must all declare compatibility and compose in CI across independently built components.

Any design that violates one of these invariants must be rejected or isolated behind an explicitly named compatibility profile. Unix-style composition, Nix-style reproducibility, and Lean-based correctness are invisible pillars for ordinary consumers, not new subjects they must learn.

## Gradual adoption and measurable practicality

The default experience is install, import, call, and dispose using the host ecosystem's normal tools. A developer may progressively inspect generated types, structured errors, performance/resource claims, proof coverage, assumptions, dependency locks, or Lean source, but none of that knowledge is required to receive the default benefit.

Acceptance tests measure time to first successful call, install and configuration steps, unfamiliar concepts exposed, handwritten integration code, diagnostic quality, manual Wasm/Nix/Lean interaction, migration effort from an ordinary package, and the number of escape hatches required. “Verified” software that imposes a parallel package or runtime world has failed the developer-experience requirement.

Accessibility is part of correctness, not release polish. The supported JavaScript and Python fixtures must be installable, discoverable, callable, debuggable, and disposable using familiar package-manager and language conventions. Generated documentation, declarations, diagnostics, examples, assurance views, and command-line output must work with keyboard-only and screen-reader workflows; proof or trust state may never be conveyed by color alone. Failures must identify the consumer action, package, declaration, violated contract, and safe next step without requiring the user to decode a Wasm trap, mangled symbol, ownership flag, or Lean runtime detail.

These are release gates with measured budgets. Production readiness requires clean-room usability tests for a JavaScript developer and a Python developer who have not learned Lean, Nix, Emscripten, or this bridge. If ordinary consumption requires a manual wrapper, generic dispatch call, raw handle, special loader knowledge, or inaccessible assurance UI, the corresponding projection is incomplete.

## Shared Lean runtime and Unix-style library loading

The runtime-loaded profile shall mirror PHP-Wasm's extension architecture deliberately, not merely claim to be “Unix-like.” An application loads one Emscripten main module containing the Lean runtime and bridge kernel. Independently compiled Lean libraries are Emscripten side modules—distributed as WebAssembly shared objects, conventionally named like `.so.wasm`—that leave Lean runtime and bridge symbols unresolved. When loaded, every side module binds those symbols to the main module and therefore executes against the same memory, table, Lean heap, registries, and object identities. A side module is a separately cacheable binary asset, but it is not a separately instantiated Lean application or a second runtime island.

Each library package shall export a versioned, machine-readable descriptor analogous to PHP-Wasm's extension helper packages. The descriptor identifies the side-module asset with a literal `new URL(..., import.meta.url)`, its logical library name and version, ABI and Lean-runtime compatibility ranges, exported and required symbols, initialization entry point, direct dependencies, generated binding/schema fragments, proof and trust metadata, integrity hashes, and any preload assets. Descriptor resolution is recursive, deterministic, cycle-aware, and deduplicated by content identity. Dependencies load before dependants; initialization is idempotent; symbol or version conflicts fail before user code runs.

The public runtime accepts capabilities or package descriptors rather than loose asset URLs. It resolves the full transitive closure, lets the bundler discover literal assets, stages them through the runtime's locator, loads each shared object into the existing main module, registers its generated bindings, and calls its initializer exactly once. The JavaScript surface should be as uneventful as:

```ts
import { createLeanApp } from "@lean-wasm/runtime";
import graph from "@lean-wasm/graph";
import statistics from "@lean-wasm/statistics";

const lean = await createLeanApp({ libraries: [graph, statistics] });
const result = await lean.statistics.mean([1, 2, 3]);
```

No normal consumer should handle `WebAssembly.Memory`, function-table offsets, `dlopen`, mangled symbols, Lean reference counts, or raw numeric handles.

The implementation must reuse or adapt the proven PHP-Wasm shape where it fits:

- version-aware ESM helper packages describe `.so` and support assets;
- a `sharedLibs`-like path resolves and loads libraries automatically at startup;
- a `dynamicLibs`-like path stages libraries for explicit lazy loading;
- `locateFile`-style asset routing makes CDN, browser, worker, Node, and bundler deployment consistent;
- library packages own their dependency and preload metadata;
- static, shared-at-startup, and lazy-dynamic modes are generated from one dependency description.

This reuse must be based on a code-level comparison with PHP-Wasm's resolver and runtime initialization path. Any divergence requires an ADR stating why Lean's runtime, initialization, reference counting, symbol visibility, or proof metadata demands it.

## Static composition and Nix-style reproducibility

Unix-style runtime loading and Nix-style composition are complementary profiles over the same package graph.

Every published Lean library capsule should contain enough information to support both:

- **runtime-loaded composition:** a side module clicks into one main runtime and may be cached, selected, or loaded lazily; and
- **final static composition:** relocatable objects or archives are linked with one Lean runtime into one application Wasm artifact for maximum dead-code elimination and minimum startup overhead.

The package model must never force each library to ship a standalone Lean application. A standalone build may exist only as an explicitly named convenience export for demos or isolated use and must not participate in normal dependency composition.

Nix fixes the complete build closure: exact sources, Lean and Emscripten revisions, flags, generators, dependencies, and composition inputs. The project will make bit-for-bit artifact reproduction an explicit tested requirement rather than assuming that Nix alone makes nondeterministic tools deterministic. The resulting derivation binds together the Wasm binary or side modules, generated TypeScript, validators, documentation, schemas, proof certificates, trust assumptions, and integrity hashes. The promise is: **this is the artifact whose contracts were checked, and this is the complete recipe that rebuilds that artifact.**

The build-time compositor and runtime loader must resolve the same canonical dependency graph and lock data. Given the same lock and target profile, they must agree on versions, feature selections, ABI, initialization order, proof metadata, and content hashes. Runtime loading must reject a graph that differs from the graph authorized by the lock unless an explicit development policy permits it.

## Lean proofs, artifact identity, and trust

A proof is useful only when its relationship to the shipped executable remains legible. Each exported declaration therefore carries metadata linking its Lean source declaration, specification, relevant theorem dependencies, compiler/toolchain identity, generated ABI symbol, wrapper version, and final artifact hash.

The system must report three assurance states without turning ordinary code into a shame category:

- **proved:** backed by named machine-checked theorems under recorded assumptions;
- **trusted boundary:** dependent on compiler correctness, bridge/runtime code, JavaScript host APIs, WASI capabilities, foreign libraries, axioms, or other declared assumptions; and
- **unverified:** usable code with no attached formal guarantee.

This metadata influences package selection, composition, generated documentation, and future editor tooling. It does not imply that the Lean compiler, Emscripten, browser, or host API has been proved correct.

## AI-native verified composition

The long-term goal is to change code generation into verified software composition. An AI or human should first search for an existing component whose semantic contract, proof assumptions, target ABI, performance envelope, license, and reproducible dependency closure satisfy the request. It should compose that component and generate only genuinely novel glue or implementation.

This suggests a future semantic search engine for algorithms and verified components. A query such as “stable topological sort with this complexity bound and these error semantics” should return compatible Lean components together with their theorems, generated JavaScript/TypeScript view, Wasm artifacts, Nix derivations, benchmarks, dependencies, trust boundaries, and licenses. Search ranking should prefer contract compatibility and reusable evidence over textual similarity or popularity alone.

That registry and search engine are a north star, not part of the first bridge implementation. The first version must nevertheless preserve the metadata and content-addressed identities needed to make it possible. Decisions that erase proof provenance, hide dependency assumptions, or bind packages exclusively to JavaScript fail the long-term architecture test.

## JavaScript first, not JavaScript only

The JavaScript/TypeScript layer is a generated adapter and the primary initial developer experience; it is not the bridge's only canonical interface. The core package schema, value model, ownership rules, error envelope, async model, symbol contract, and assurance metadata must be host-neutral wherever the underlying capability permits.

TypeScript is one generated projection. WASI component bindings, native C ABI bindings, or another host adapter may be generated from the same metadata later. JavaScript-specific capabilities—objects, closures, Promises, browser APIs, and Vrzno-style native-feeling access—must be marked as host capabilities rather than silently embedded in otherwise portable algorithm contracts. This keeps the core reusable in WASI ecosystems without reducing JavaScript to a second-class target.

The initial ABI should be narrow, versioned, and generated. Rich values cross it through typed wrappers and generation-safe handles, not by exposing Lean object layouts as a permanent public ABI.

## Boundary semantics

The architecture must define both JavaScript-to-Lean and Lean-to-JavaScript behavior for:

- primitives and copied data structures;
- retained objects, identity, classes, and method receivers;
- functions, closures, callbacks, and nested re-entry;
- exceptions and a versioned error envelope;
- Promises, cancellation, and Lean asynchronous work;
- iterators and streaming values;
- deterministic disposal, borrowed values, retained leases, finalizer fallback, cycles, weak references, and runtime shutdown.

The baseline is a generated typed API over a small shared handle runtime. Handles include side, kind, slot, and generation so stale or cross-runtime references fail deterministically. Explicit `dispose()` and structured scopes are authoritative; JavaScript finalization is only a queued fallback. Version one does not promise automatic collection of cycles spanning the JavaScript and Lean heaps.

Before implementation of each boundary category, the design must include a complete call-cycle sequence showing allocation, conversion, ownership transfer, re-entry, success or failure, and cleanup.

## Native host-language projection and ownership

The public boundary is a generated semantic projection, never a generic foreign-function interface. Every exported Lean declaration appears as a direct, named host-language callable. `ccall`, `cwrap`, frame/opcode dispatchers, raw ABI exports, numeric pointers or handles, and calling-convention details remain private runtime machinery and must not appear in public exports, type declarations, examples, diagnostics, benchmarks, or ordinary extension APIs. Argument adaptation, validation, marshalling, frame construction, handle conversion, callback adaptation, async settlement, error translation, initialization, and cleanup are generated. The consumer experience is import, call, done.

Projection is symmetrical and preserves the distinction between copied values and identity-bearing resources. Copied Lean records and inductives become idiomatic immutable interfaces, records, structs, dataclasses, or discriminated unions. Identity-bearing values become canonical JavaScript/TypeScript or Python classes/resources with generated constructors or factories, properties, methods, static methods, equality and identity behavior, iterators and async iterators, and the target language's deterministic disposal convention. Lean-side projections of host objects and classes use the same declared object model rather than opaque tokens plus loose helper functions.

The generator derives ownership behavior from the canonical binding contract. Borrowed, copied, transferred, retained, leased, weak, and host-owned values have explicit generated behavior; consumers do not pass ownership flags or balance reference counts. One host wrapper represents one live foreign identity within an application. Explicit disposal or structured scope is authoritative, finalization is only a fallback, stale generations fail deterministically, live borrows prevent unsafe release, and runtime shutdown reports the resources preventing closure. A class projection is incomplete until its constructor, method receiver, returned aliases, exceptions, async work, iterators, callbacks, and disposal paths all satisfy the ownership matrix.

Native wrappers are an architectural prerequisite, including for performance work. Benchmarks must measure the API developers are promised—not a privileged raw `ccall` or dispatcher path—and may report an internal ABI baseline only as a separately labelled diagnostic.

## Generated package contract

Lean declarations and bridge annotations generate, as one atomic artifact set:

- Wasm side modules and/or final-link objects;
- ESM runtime wrappers and library descriptors;
- `.d.ts` declarations with no public `any` escape hatch;
- development-time runtime validators;
- API documentation and examples;
- ABI, dependency, initialization, and schema metadata;
- proof, assumption, and trust-boundary metadata;
- conformance tests and hashes that detect drift.

Generation must be deterministic. CI fails if checked-in generated output differs from a clean regeneration, if descriptors disagree with binaries, or if separately composed libraries declare incompatible symbols, types, runtime versions, or proof metadata.

Generated bindings must satisfy the native projection and ownership contract above. No ordinary consumer writes a wrapper function, invokes generic dispatch, or learns the bridge calling convention.

Dynamic loading returns that same generated surface. The ordinary convention is
`const beta = await libraries.load("beta"); beta.chain(9)`: no linker handle,
underscore-prefixed symbol, or follow-up wrapper step. Loading is demand-driven
and idempotent. It links only the minimum required transitive graph, shares one
in-flight operation across concurrent callers, and returns the same frozen API
object thereafter. Unrelated packages, optional capabilities, and the threaded
runtime stay unloaded; runtime initialization and optional resources defer until
their first semantic use wherever the declared behavior permits.

## Required proof of concept

The first proof of concept is not “hello world.” It must demonstrate the architecture's hardest invariant:

1. Build at least three independently compiled Lean libraries that do not contain a Lean runtime.
2. Load their side modules into one main runtime using recursive package descriptors.
3. Pass a retained Lean value from one library to another without copying or losing identity.
4. Pass a JavaScript object and callback through one library into another, including nested re-entry.
5. Dispose all values and return registries and ownership counters to baseline.
6. Prove structurally that there is one memory, one table, one Lean runtime symbol set, and one initialization domain.
7. Build a synthetic 50-library graph and compare download size, initial memory, startup, and steady-state overhead against 50 standalone runtimes.
8. Recompose the same graph statically and verify that static and dynamic profiles expose the same generated TypeScript contract and assurance metadata.
9. Rebuild the locked graph in a clean environment and compare artifact hashes.
10. Consume it from raw ESM and representative Vite, Rollup, Webpack, worker, Node, and React applications without manual Wasm asset configuration.

The proof of concept fails if any library silently instantiates a private runtime, memory, table, registry, or incompatible symbol universe—even if its public API appears to work.

## Development phases

1. **Evidence and source audit:** pin Lean, Emscripten, Vrzno, PHP-Wasm, and comparison-project revisions; read code, not only documentation.
2. **Runtime model:** document Lean values, initialization, calls, reference counting, tasks, exceptions, and supported extension points.
3. **Comparative survey:** record status (`read`, `verified`, or `partial`), evidence, gaps, and transferable architecture ideas for each prior project.
4. **Architecture and ADRs:** specify value/identity/lifetime matrices, call sequences, loader/compositor, package schema, generated TypeScript, host-neutral ABI, errors, async, bundlers, and patch policy.
5. **Review gate:** review the recommendation, risks, unresolved questions, and cross-cutting invariant impacts. Required patches are a last resort.
6. **Proof of concept:** implement and measure the three-library and 50-library scenarios above.
7. **Production implementation:** stabilize generators, runtime, packages, tests, documentation, and releases only after the proof of concept passes.
8. **Future assurance tooling:** explore VS Code verification, boundary, and proof-dependency overlays plus a trust-graph dashboard; do not couple the core bridge to one editor.

## Immediate success criteria

The architecture is ready for production implementation only when:

- independent libraries demonstrably share one runtime and one heap;
- runtime-loaded and static composition consume one canonical locked graph;
- the TypeScript API is fully generated, exposes direct native callables/classes with generated ownership, and passes drift and forbidden-surface checks;
- JavaScript consumers need no routine Wasm configuration;
- clean-room JavaScript and Python consumers pass the accessibility and adoption-effort budgets;
- proof and trust metadata survives compilation and composition;
- the ABI leaves room for a WASI adapter;
- ownership counters return to baseline after stress tests;
- bundler, Node, worker, and React validation passes; and
- every exception to the architecture invariants is explicit, measured, and approved.

## Primary references

- [Vrzno repository](https://github.com/seanmorris/vrzno)
- [PHP-Wasm repository](https://github.com/seanmorris/php-wasm)
- [PHP-Wasm extension loading](https://php-wasm.seanmorr.is/extensions/using-php-extensions.html)
- [Vrzno documentation](https://php-wasm.seanmorr.is/extensions/vrzno.html)
- [Lean 4 repository](https://github.com/leanprover/lean4)
- [Lean Language Reference](https://lean-lang.org/doc/reference/latest/)
- [Lean foreign-function interface](https://lean-lang.org/doc/reference/latest/Runtime-Code/Foreign-Function-Interface/)
- [Emscripten documentation](https://emscripten.org/docs/)
- [Emscripten dynamic linking](https://emscripten.org/docs/compiling/Dynamic-Linking.html)
- [`emcc` reference](https://emscripten.org/docs/tools_reference/emcc.html)
- [`EM_JS` header](https://github.com/emscripten-core/emscripten/blob/main/system/include/emscripten/em_js.h)
- [lean4web](https://github.com/leanprover-community/lean4web)
- [lean4-wasm-in-browser](https://github.com/cauli/lean4-wasm-in-browser)

## Repository status

`/app` is the project root. The architecture is approved for the Phase 8 POC, not for production hardening. The current implementation proves one shared Lean runtime across three independently compiled libraries, lazy native JavaScript projections, a canonical locked graph shared by dynamic and final-static composition, target-specific artifact integrity, and byte-identical browser artifacts across two checkout roots. Generated production bindings, the complete ownership/async surface, bundler/browser applications, scaling benchmarks, and a pure-Nix Wasm toolchain derivation remain later work packages.
