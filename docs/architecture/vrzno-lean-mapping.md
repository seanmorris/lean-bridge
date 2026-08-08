# Vrzno and PHP-Wasm to Lean Mapping

| Proven concept | Lean bridge equivalent | Adaptation or constraint |
|---|---|---|
| Vrzno makes JS values feel native in PHP | `JS.Ref`, generated JS capability types, and generated Lean helpers | Lean is statically typed; safe APIs use declared schemas and capabilities, with `JS.Value` as an explicit dynamic escape hatch. |
| Vrzno object/function/class proxies | Generation-safe JS-handle tokens retained in one JS registry | Token contains side, nominal kind, slot, and generation. It is never a raw pointer. |
| PHP extension object lifetime hooks | Lean external/opaque wrappers plus explicit registry root retain/release | Lean uses RC, not PHP's lifecycle or a tracing GC. Ownership must be audited for each call shape. |
| PHP-Wasm version-aware ESM extension helpers | Generated Lean library descriptors | Descriptor includes assets, transitive dependencies, ABI/runtime ranges, symbols, initializer, bindings, proof/trust metadata, and hashes. |
| PHP-Wasm `sharedLibs` | Startup side-module resolver and loader | Recursively resolve, deduplicate, load into one main runtime, register bindings, and initialize exactly once. |
| PHP-Wasm `dynamicLibs` plus PHP `dl()` | Staged capability/lazy library loading | Same descriptors and lock; load on request. Code unload is not promised in v1. |
| PHP-Wasm `locateFile` | Runtime asset locator override | Literal `new URL(..., import.meta.url)` remains the bundler-discoverable default. |
| Emscripten main and side modules | One Lean runtime main module plus runtime-free Lean side modules | Side modules import memory/table/runtime/bridge symbols and must never define a private runtime. |
| PHP-Wasm static/shared/dynamic build variants | Final-static, startup-shared, and lazy-dynamic profiles | All profiles derive from one capsule and canonical locked graph. |
| JavaScript Promise access through Vrzno | Stackless `JS.Promise`/pending-operation protocol | Lean call returns with an empty Wasm stack; settlement later re-enters through a generated adapter. |
| Native-looking exception flow | Versioned error envelope | Preserve JS error identity when safe; attach Lean message/type/trace data without pretending host stacks are proofs. |

## Concepts that do not map directly

- Lean's dependent and higher-order types cannot all become transparent TypeScript. Unsupported declarations must fail generation or require an explicit adapter.
- JavaScript GC and Lean RC do not jointly collect cycles. Version one requires deterministic disposal and explicit ownership cuts.
- A side module can be a separate downloadable Wasm asset while still sharing one runtime. “One runtime” does not mean “only one file” in the dynamic profile.
- Proof metadata does not make the compiler, bridge, Emscripten, browser, or host APIs proved. Those remain named trust boundaries.

## Required direct reuse audit

Implementation must compare against `/app/php-wasm/source/resolveDependencies.mjs`, `/app/php-wasm/source/PhpBase.mjs`, and representative `/app/php-wasm/packages/*` extension descriptors. Reuse the shape where compatible. Any divergence must state the Lean-specific reason and the permanent-lens impact.
