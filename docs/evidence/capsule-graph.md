# Canonical capsule graph evidence

Status: verified POC evidence for Phase 8 WP3. The canonical graph is enforced by the shell/bootstrap path and by a complete x86-64 Nix-sandbox build of both runtime profiles. The metadata-only graph derivation remains portable to x86-64 and AArch64 Linux.

## Contract and resolver

The host-neutral capsule schemas are `schema/library-capsule.schema.json` and `schema/library-graph-lock.schema.json`. Alpha, Beta, and Gamma publish JSON capsules under `poc/lean-link-spike/capsules/`; JavaScript asset URLs and native projections remain in the host adapter rather than contaminating this contract.

Each capsule fixes its shared-runtime ABI, Lean commit, patch set, supported composition profiles, target-specific side module and static-object hashes, symbol claims, initializer behavior, exact dependencies, optional generated fragments, and host/thread/effect capabilities. The graph lock fixes each capsule by SHA-256 and fixes dependency edges to the exact content identity.

`src/capsule/contract.mjs` validates descriptors and locks with closed object shapes. Its deterministic resolver selects only the requested transitive closure, orders dependencies first regardless of input order, and rejects cycles, content drift, runtime/profile mismatches, dependency drift, conflicting package hashes, duplicate symbols, duplicate initializers, and unresolved package symbols with structured remediation details.

## Build and runtime enforcement

`scripts/build-lean-link-spike.sh` asks `scripts/resolve-lean-graph.mjs` for the module order and emits canonical resolved graphs for startup, lazy, and final-static profiles. The linker no longer trusts the incidental order of `libraries` in the lock file.

After linking, `scripts/verify-lean-artifacts.mjs` hashes both startup and lazy side modules plus every final-static input object. A mismatch terminates the build. The lazy loader checks the selected side-module digest immediately before asking Emscripten to link it, so corrupted package bytes do not reach the public native API.

The browser and threaded capsules have distinct artifact hashes. Both runtime-loaded modes and final-static composition share the same capsule identities, dependency order, symbols, and initializer contract.

## Reproducibility result

Clang file, debug, and macro prefix maps normalize the checkout root to `/workspace` and every content-addressed runtime build directory to `/workspace/build/lean-runtime/current`. Final-static capsule objects are compiled from project-relative source paths so their LLVM module identifiers are also root-independent. Shipped side modules, static objects, and final Wasm artifacts contain no checkout-specific or cache-key-specific source path.

`npm run test:reproducibility` copies the current tracked and untracked source closure to a fresh `mktemp` checkout, shares only the pinned toolchain installation, rebuilds the browser and threaded Lean runtimes and `Init` archives from extracted source, rebuilds the complete three-library graph, and compares 24 files per profile byte-for-byte. The verified set includes main `.mjs`/Wasm files, Alpha/Beta/Gamma startup and lazy side modules, all six final-static library objects, all three canonical resolution outputs, the generated C ABI header, the artifact manifest, and the relative-path SHA manifest.

Result on 2026-08-09: **24 of 24 browser files and 24 of 24 threaded files were byte-identical across independent checkout roots.**

The previous high-severity gotcha about an absolute `lean.h` include path is therefore fixed for both POC artifact closures. The same gate also caught and eliminated a subtler leak of the content-addressed runtime build ID through `__FILE__` strings before the artifacts were relocked.

## Nix composition boundary

`nix build .#capsule-graph` produces a platform-portable Nix store artifact containing the schemas, resolver, locked capsules, and canonical resolved output for all three composition profiles. This demonstrates that discovery/composition metadata has a reproducible Nix distribution unit without making JavaScript consumers learn Nix.

On x86-64 Linux, `npm run test:nix` builds the full architecture POC in the Nix sandbox. Fixed-output inputs pin the Lean 4.32.2 host release, exact Lean and libuv source commits, Emscripten 6.0.6 binary release, and its Node 24.19.0 host. The derivation applies the admitted Lean patches, copies the immutable Emscripten base cache into a derivation-local writable cache, builds any missing system-library variants offline, compiles both browser and threaded runtime/`Init` closures, links startup/lazy/final-static graphs, validates locked artifact hashes, and runs the test suite. Its output contains the browser and threaded artifact/evidence trees plus the canonical contracts.

The fixed Emscripten release archive carries a development version marker; the derivation reproduces `emsdk install 6.0.6` by normalizing that marker to the selected release identity. Nix does not mutate the project, user cache, or immutable toolchain store path. A full AArch64 toolchain build remains open because the current exact upstream host binaries are x86-64; the host-neutral `capsule-graph` output already evaluates there.
