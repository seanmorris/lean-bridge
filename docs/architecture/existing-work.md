# Existing-Work Gap Analysis

Status labels mean: **read** = inspected documentation or source; **verified** = reproduced or checked at the pinned revision; **partial** = useful evidence but not the complete target behavior.

| Project | Status | Relevant capability | Missing for this project | Transferable architecture ideas | Evidence used |
|---|---|---|---|---|---|
| Vrzno | read | Natural bidirectional JS value/object/function access from a Wasm-hosted language | PHP-specific engine integration; no generated Lean types/proofs | Proxy ergonomics, object identity, async import/Promise boundary | Repository and PHP-Wasm Vrzno docs at pinned revision |
| PHP-Wasm | read | Static/shared/dynamic extension packages, version-aware ESM descriptors, asset routing | PHP runtime and INI-specific registration | `getLibs/getFiles`, `sharedLibs`, `dynamicLibs`, `locateFile`, à-la-carte cached `.so` assets | Local source and published extension-loading docs |
| Lean 4 | verified/partial | Generated C, runtime/FFI, module initialization, RC | No official browser package or Vrzno-style JS object bridge | Stable declaration ownership rules, generated-C link inputs, Lake facets | Pinned source and scalar Emscripten path; full side-module runtime remains unverified |
| lean4-wasm-in-browser | read/partial | Persistent Lean compiler/runtime in a browser Wasm environment | Runtime compiler product, custom fork, raw host API | Export retention, persistent runtime initialization, worker constraints | Pinned source audit |
| lean4web | read/partial | Browser-facing Lean tooling | Not a general AOT library/JS object bridge | Packaging and browser integration techniques | Pinned source audit |
| lean2wasm | read/partial | Lean-to-Wasm compilation experiments | No full generated typed bidirectional object/lifetime model | Dependency closure and export discipline | Pinned source audit |
| Wasm.lean | read/partial | WebAssembly concepts represented in Lean | Does not embed arbitrary compiled Lean libraries into JS | Typed Wasm representation and validation ideas | Pinned source audit |
| solana-lean | read/partial | Alternate freestanding/reactor-style Lean Wasm backend | Deep runtime/compiler fork and different product constraints | Smaller import surface and custom build facets | Broader landscape audit; not selected baseline |
| lean4.js | read/partial | JavaScript-oriented Lean developer experience | Not the selected compiled-library runtime model | API naming, generated declaration, and package-DX ideas | Broader landscape audit |

## Gap conclusion

No inspected project supplies the exact combination of:

- Vrzno-like bidirectional JS semantics;
- independently packaged Lean side modules sharing one runtime;
- generated drift-proof TypeScript and validators;
- deterministic cross-heap ownership and identity;
- Nix-locked static and dynamic composition of one graph;
- proof/trust metadata bound to final artifact identity; and
- a host-neutral schema that can later project to WASI.

The recommendation is to reuse upstream Lean, Emscripten dynamic-linking, and PHP-Wasm loader/package techniques, while implementing the Lean-specific binding generator, ownership runtime, descriptor schema, assurance graph, and compositor as new project work.
