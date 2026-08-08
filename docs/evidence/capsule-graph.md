# Canonical capsule graph evidence

Status: verified POC evidence for Phase 8 WP3. The Nix derivation packages and validates the canonical graph metadata; the complete Lean/Emscripten Wasm build is still driven by the pinned bootstrap shell and is not yet a pure Nix build.

## Contract and resolver

The host-neutral capsule schemas are `schema/library-capsule.schema.json` and `schema/library-graph-lock.schema.json`. Alpha, Beta, and Gamma publish JSON capsules under `poc/lean-link-spike/capsules/`; JavaScript asset URLs and native projections remain in the host adapter rather than contaminating this contract.

Each capsule fixes its shared-runtime ABI, Lean commit, patch set, supported composition profiles, target-specific side module and static-object hashes, symbol claims, initializer behavior, exact dependencies, optional generated fragments, and host/thread/effect capabilities. The graph lock fixes each capsule by SHA-256 and fixes dependency edges to the exact content identity.

`src/capsule/contract.mjs` validates descriptors and locks with closed object shapes. Its deterministic resolver selects only the requested transitive closure, orders dependencies first regardless of input order, and rejects cycles, content drift, runtime/profile mismatches, dependency drift, conflicting package hashes, duplicate symbols, duplicate initializers, and unresolved package symbols with structured remediation details.

## Build and runtime enforcement

`scripts/build-lean-link-spike.sh` asks `scripts/resolve-lean-graph.mjs` for the module order and emits canonical resolved graphs for startup, lazy, and final-static profiles. The linker no longer trusts the incidental order of `libraries` in the lock file.

After linking, `scripts/verify-lean-artifacts.mjs` hashes both startup and lazy side modules plus every final-static input object. A mismatch terminates the build. The lazy loader checks the selected side-module digest immediately before asking Emscripten to link it, so corrupted package bytes do not reach the public native API.

The browser and threaded capsules have distinct artifact hashes. Both runtime-loaded modes and final-static composition share the same capsule identities, dependency order, symbols, and initializer contract.

## Reproducibility result

Clang file, debug, and macro prefix maps normalize the checkout root to `/workspace`. Final-static capsule objects are compiled from project-relative source paths so their LLVM module identifiers are also root-independent. Shipped side modules, static objects, and final Wasm artifacts contain no `/app` source path.

`npm run test:reproducibility` copies the current tracked and untracked source closure to a fresh `mktemp` checkout, shares only the pinned toolchain installation, rebuilds the browser Lean runtime and `Init` archive from extracted source, rebuilds the complete three-library graph, and compares 23 files byte-for-byte. The verified set includes main `.mjs`/Wasm files, Alpha/Beta/Gamma startup and lazy side modules, all six final-static library objects, all three canonical resolution outputs, the artifact manifest, and the relative-path SHA manifest.

Result on 2026-08-08: **23 of 23 files were byte-identical across `/app` and `/tmp/lean-wasm-repro.*` checkouts.**

The previous high-severity gotcha about an absolute `lean.h` include path is therefore fixed for the browser POC artifact closure. A second-root threaded run and a pure Nix derivation of the full Lean/Emscripten build remain production-hardening work.

## Nix composition boundary

`nix build .#capsule-graph` produces a Nix store artifact containing the schemas, resolver, locked capsules, and canonical resolved output for all three composition profiles. This demonstrates that discovery/composition metadata has a reproducible Nix distribution unit without making JavaScript consumers learn Nix.

It does not yet claim that the 22 MB Lean `Init` archive and final Wasm artifacts are built inside the Nix sandbox. That requires a production derivation for the pinned Lean source, Emscripten SDK, patched runtime, and both runtime profiles; the shell build remains the evidence-producing POC until that derivation exists.
