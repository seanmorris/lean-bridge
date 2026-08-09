# Commit-Pinned Source Dossier

Retrieved and reviewed on 2026-08-08 unless otherwise noted.

## Vrzno and PHP-Wasm

- Vrzno: [`seanmorris/vrzno@c3aa3b9dd9de0eab88e3e3c3dc0f86d813ebb53d`](https://github.com/seanmorris/vrzno/tree/c3aa3b9dd9de0eab88e3e3c3dc0f86d813ebb53d)
- Weaker: [`seanmorris/weaker@8e147cc8832589f582ab61a12b9c429dee1e15b0`](https://github.com/seanmorris/weaker/tree/8e147cc8832589f582ab61a12b9c429dee1e15b0), reviewed 2026-08-09. The maintained `weakermap` package supplies the weak-value reverse-map precedent and replacement-safe finalizer behavior.
- PHP-Wasm: [`seanmorris/php-wasm@bd9a46bf4984bfbdfef4bb6f5b04b7dcd6264c89`](https://github.com/seanmorris/php-wasm/tree/bd9a46bf4984bfbdfef4bb6f5b04b7dcd6264c89)
- [PHP-Wasm extension loading](https://php-wasm.seanmorr.is/extensions/using-php-extensions.html)
- [PHP-Wasm build modes](https://php-wasm.seanmorr.is/compiling/php-wasm-rc.html)
- [Vrzno documentation](https://php-wasm.seanmorr.is/extensions/vrzno.html)
- Code-level evidence: `source/resolveDependencies.mjs`, `source/PhpBase.mjs`, and representative `packages/*` descriptors in the pinned PHP-Wasm revision above.

The key observed PHP-Wasm shape is version-aware ESM descriptors exposing `getLibs/getFiles`; the runtime normalizes library definitions, maps names to URLs through its locator, preloads support files, writes startup extension configuration for `sharedLibs`, and stages `dynamicLibs` without auto-registration.

## Lean

- Lean stable baseline: [`leanprover/lean4@f3b06c705e6c85f5314019d5d3baab0fec5b580c`](https://github.com/leanprover/lean4/tree/f3b06c705e6c85f5314019d5d3baab0fec5b580c) (`v4.32.2`)
- [Lean Language Reference](https://lean-lang.org/doc/reference/latest/)
- [Lean foreign-function interface](https://lean-lang.org/doc/reference/latest/Runtime-Code/Foreign-Function-Interface/)
- [Lake build and distribution](https://lean-lang.org/doc/reference/latest/Build-Tools-and-Distribution/Lake/)

## Emscripten

- Emscripten baseline: [`emscripten-core/emscripten@ce75e06884093bcefb86a6b8fd56a5d62a4cc245`](https://github.com/emscripten-core/emscripten/tree/ce75e06884093bcefb86a6b8fd56a5d62a4cc245) (`6.0.6`)
- [Dynamic linking](https://emscripten.org/docs/compiling/Dynamic-Linking.html)
- [`emcc` reference](https://emscripten.org/docs/tools_reference/emcc.html)
- [`EM_JS` header](https://github.com/emscripten-core/emscripten/blob/ce75e06884093bcefb86a6b8fd56a5d62a4cc245/system/include/emscripten/em_js.h)

Emscripten documents one main module with side modules, static object/archive linking, load-time and runtime dynamic loading, and the DCE/export-retention tradeoffs that the POC must measure.

## Comparison projects

- lean4web: [`leanprover-community/lean4web@e6bf6c5835043c3bde64b4d12e6b73f3aed1de5c`](https://github.com/leanprover-community/lean4web/tree/e6bf6c5835043c3bde64b4d12e6b73f3aed1de5c)
- lean4-wasm-in-browser: [`cauli/lean4-wasm-in-browser@2655455848091557c8457b6a3b03c291859890e6`](https://github.com/cauli/lean4-wasm-in-browser/tree/2655455848091557c8457b6a3b03c291859890e6)
- lean2wasm: [`leanprover/lean2wasm@28620e1f33e0772e90b036db12ed099a734b4b19`](https://github.com/leanprover/lean2wasm/tree/28620e1f33e0772e90b036db12ed099a734b4b19)
- Wasm.lean: [`leanprover-community/Wasm.lean@454172e1219ce648732211a7804829809dffd64d`](https://github.com/leanprover-community/Wasm.lean/tree/454172e1219ce648732211a7804829809dffd64d)

## Historical foundations

- [Proof-carrying code, POPL 1997](https://doi.org/10.1145/263699.263712)
- [WebAssembly Component Model and WIT](https://github.com/WebAssembly/component-model/blob/main/design/mvp/WIT.md)
- [SLSA provenance](https://slsa.dev/spec/v1.2/provenance)
- [in-toto](https://in-toto.io/)
- [Reproducible Builds definition](https://reproducible-builds.org/docs/definition/)
- [CompCert semantic-preservation overview](https://compcert.org/man/manual001.html)
- [seL4 proof statements and assumptions](https://sel4.systems/Verification/proofs.html)
- [Project Everest](https://project-everest.github.io/)

## Evidence classification

- A commit pin establishes what source was inspected; it does not establish runtime behavior.
- Documentation supports intended behavior; it does not replace reproduction.
- Source audit is marked `read` or `partial` until a command and raw result are preserved.
- The POC will add reproducible experiment records and update claims to `verified` only where warranted.
