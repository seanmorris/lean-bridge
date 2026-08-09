# Direct-Call and Native-Object Conformance Evidence

Status: browser, threaded, lazy, and final-static consumer fixtures use generated native APIs. Private lifecycle and lowering probes live under `tests/internal/abi`.

## Named loading

The application loader accepts a generated package catalog. A consumer requests a package by its stable name:

```ts
const beta = await libraries.load("beta");
const answer = beta.chain(9);
```

`load` returns a frozen generated API object. It never returns the value produced by the dynamic linker. Concurrent requests share one pending load, later requests return the same object, and recursive resolution loads only the requested transitive closure. An unknown name fails before linking. Package aliases are rejected when they identify more than one descriptor.

The final-static path uses the same call convention. The package runtime marks locked components as prelinked, then `load` projects the same frozen API without invoking the dynamic linker. Runtime initialization remains deferred until a generated function or constructor requires it.

## Consumer fixtures

The browser and threaded fixtures exercise:

- `new alpha.Box(value)`, `read()`, `identity()`, and `dispose()`;
- copied records containing booleans, fixed-width integers, Unicode strings, bytes, and typed integer arrays;
- JavaScript callbacks passed into Lean;
- Lean closures returned as ordinary JavaScript functions;
- nested callback re-entry;
- structured errors and disposed-resource failures;
- lazy and prelinked composition; and
- cross-runtime identity rejection and runtime shutdown.

The public fixtures read runtime diagnostics for test assertions. They do not access linker handles, private symbols, raw modules, numeric identities, calling conventions, or handwritten projections.

## Internal ABI tests

Tests that inspect raw lifecycle symbols, value frames, initialization states, iterator lowering, generic branch symbols, overload adapters, registry tokens, or finalizer queues live under `tests/internal/abi`. These tests verify bridge implementation mechanics. They do not provide usage examples or define the consumer contract.

## Purity gate

`tests/public-surface-conformance.test.mjs` scans the consumer fixtures and public documentation code examples. It rejects generic dispatch, raw symbols, linker calls, WebAssembly objects, ownership flags, and direct projection helpers. The same test invokes the generated-package gate for JavaScript, Python, C, and Rust, which audits public modules, declarations and stubs, package metadata, headers, and generated READMEs.

The repository suite contains 187 passing tests after this split.
