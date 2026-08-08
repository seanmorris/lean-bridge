# Implementation Approval Checkpoint

## Current state

- Preliminary `/app/README.md`: complete.
- Architecture design package: assembled; review and consistency verification in progress.
- Production/POC runtime code: not started.
- Toolchain, package, Nix, Lean, C/C++, JavaScript runtime, generator, and fixture files: intentionally gated.

## Architecture approval asks the reviewer to accept

1. one `LeanWasmApplication` as the runtime/isolation boundary;
2. required PHP-Wasm-style recursive side-module loading into one main Lean runtime;
3. final static composition as an optimized profile over the same canonical graph;
4. generated TypeScript/validators/docs/schema/assurance as one drift-checked artifact family;
5. generation-safe dual registries, deterministic disposal, and no automatic cross-heap cycle claim;
6. stackless Promise and fixed callback/re-entry baselines;
7. one Nix/content-addressed lock binding sources, dependencies, tools, proofs, wrappers, and artifacts;
8. JavaScript-first capability semantics over a host-neutral core that preserves future WASI projection; and
9. preservation of semantic/proof/build metadata for future AI-native verified component discovery.

## What approval authorizes

Architecture approval authorizes the architecture-testing POC in the order defined by `poc-plan.md`. It does not authorize publishing packages, modifying existing user repositories, claiming production stability, or skipping the separate production-hardening review after measurements.

## What remains unresolved until the POC

- full Lean runtime success under Emscripten main/side linking;
- minimal stable side-module symbol contract and DCE behavior;
- measured many-library startup, memory, size, and call slopes;
- lifecycle correctness under callbacks, re-entry, Promise races, and shutdown;
- bundler coverage for multiple side assets;
- clean bit-for-bit rebuild results; and
- quality of a generated WIT projection for the portable subset.

## Decision record

Human architecture decision: **approved for the architecture-testing POC**.

- Approver: project owner (human user)
- Approved at: 2026-08-08 UTC
- Scope: the ordered falsification-driven POC in `poc-plan.md`
- Production hardening/publishing: not approved by this decision
- Amendments: none; all six permanent architecture lenses remain mandatory

Review-content digest (all files under `docs/architecture` except this mutable approval record, path-sorted SHA-256 manifest hashed again):

`d8cfc7e71383a0e1329c47e0a0b3f980d000a5831a778ede7d4264275a272bf6`

Root README SHA-256:

`e11f227930d45c3b45bcd4fcbc7ce9f26ff9da0cbf0224982fabafb6394d85d3`

These hashes identify the approved review content. If that content changes materially, recompute them and repeat the architecture decision before relying on the amendment.
