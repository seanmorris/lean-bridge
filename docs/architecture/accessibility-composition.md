# Accessibility and Universal Composition Contract

## Decision

Accessibility, ergonomics, practicality, gradual adoption, and composition are load-bearing architecture requirements. They are evaluated in every design and implementation decision and may veto production approval.

Unix-style composition, Nix-style reproducibility, and Lean-based correctness strengthen an ordinary JavaScript or Python package. Consumers remain inside their existing toolchain, package manager, runtime model, and language conventions.

Every semantic contract, ABI, runtime object, proof record, metadata fragment, package, and lock declares how it composes. CI combines independently built inputs at each layer and rejects an abstraction that cannot participate.

## Progressive adoption ladder

1. Install through npm or Python's ordinary package tooling.
2. Import and call using familiar host-language types and errors.
3. Let generated wrappers handle initialization, assets, ownership, disposal, async work, and dependency loading.
4. Inspect generated types, structured diagnostics, performance/resource claims, and assurance summaries when useful.
5. Drill into theorem dependencies, assumptions, artifact hashes, Nix closure, ABI and Lean source only by choice.
6. Author or extend verified Lean components only when the developer's task calls for it.

Each level works without requiring knowledge from the next. Unsafe or advanced controls remain available, explicit, and outside the happy path.

## Accessibility requirements

- Human documentation and CLI output use plain language before formal or runtime terminology.
- Assurance states have text, icons/labels, and machine-readable values; color is never the sole signal.
- Generated APIs expose actionable errors with recovery guidance and source/proof links where available.
- Examples, documentation navigation, and future IDE surfaces support keyboard and screen-reader use.
- Deterministic JSON/NDJSON and schemas make the same capabilities accessible to agents and assistive tools.
- Host projections use idiomatic naming, resource scopes, errors/exceptions, async/await, iterators, package metadata, and documentation conventions.
- JavaScript and Python consumer paths require no raw pointers, numeric handles, Wasm URLs, memory/table configuration, symbol lists, Lean reference counts, or Nix commands.

## Adoption-friction measurements

Every release candidate runs from clean consumer fixtures and records:

| Measure | Desired direction |
|---|---|
| package-manager commands before first call | one |
| manual configuration fields | zero by default |
| handwritten bridge/loader code | zero |
| raw Wasm/Nix/Lean concepts required | zero |
| elapsed install-to-first-call | measured |
| edits migrating an equivalent ordinary package call | minimal and documented |
| diagnostic recovery steps for representative failures | bounded and actionable |
| advanced escape hatches needed by happy-path examples | zero |
| proof/trust inspection steps | optional and directly linked |

Qualitative usability sessions and accessibility audits complement these metrics; a fast but confusing package does not pass.

## Composition layers and evidence

Each layer publishes identities, compatibility rules, and a deterministic failure explanation.

| Layer | Composition contract | Required CI evidence |
|---|---|---|
| semantics | capability IDs, types, pre/postconditions, effects, errors | two independently built libraries pass shared conformance vectors |
| ABI | version, symbols, layouts, calling/ownership rules | generated manifests unify or reject before execution |
| runtime | runtime identity, one memory/table/heap, registries, init/shutdown | side modules import main state; counters and identity survive cross-library calls |
| proof/trust | theorem subjects, assumptions, trust roots, artifact identities | merged graph retains exact provenance and residual obligations |
| metadata | schema/vocabulary versions and extension rules | independently produced fragments merge deterministically |
| package | exact coordinates, features, licenses, capabilities | Nix/npm/Python projections resolve one compatible closure |
| graph | versions, dependencies, initialization, content hashes | startup-side, lazy-side and final-static resolve the same canonical lock |
| host projection | portable contract plus explicit host capabilities | JS and Python fixtures observe equivalent portable behavior |

“It composes” is not accepted from same-build monoliths alone. At least two inputs must be built independently, then composed through the published contract. Negative tests must prove incompatible components fail early and explain why.

## Current POC evidence

The first Lean-generated Alpha side module is built independently from the main module. Structural tests show that it imports the application's memory, indirect function table, Lean runtime/RC functions, allocator functions, and bridge registration symbol rather than defining a private runtime. Startup and lazy loading both allocate, read, preserve, and release a Lean object through the same application domain.

The POC now proves the runtime and composition layer for Alpha, Beta, and Gamma, including cross-library identity, lazy loading, startup loading, static parity, and independent-root artifact reproducibility. Generated proof metadata, zero-configuration JavaScript packaging, and the Python projection remain required before the universal composition claim can pass.
