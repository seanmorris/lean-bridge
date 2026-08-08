# Implementation Approval Checkpoint

## Decision

The project owner approved the architecture-testing POC on 2026-08-08 UTC. The decision authorizes the ordered work in [the POC plan](poc-plan.md). It does not authorize a production-stability claim or public package release.

## Evidence completed after approval

- The pinned Lean runtime and complete `Init` closure build for the browser and threaded Wasm profiles.
- Alpha, Beta, and Gamma compile independently without private Lean runtimes.
- All three libraries share one memory, table, runtime, initialization domain, and retained object identity.
- Startup, lazy dynamic, and final-static composition consume one canonical locked graph.
- The POC loader returns native JavaScript functions and classes while keeping raw ABI symbols and handles private.
- Browser and threaded clean rebuilds each produce 23 byte-identical artifacts across independent checkout roots.
- The complete x86-64 graph builds and passes 35 tests in a fixed-input Nix environment.
- The native JavaScript POC has a reproducible [performance baseline](../evidence/performance.md).

## Work that remains inside the approved POC

- Generate the binding IR, descriptors, ESM, strict TypeScript declarations, Python stubs, C/C++ headers, Rust bindings, validators, docs, and assurance metadata from Lean declarations.
- Complete the primitive, copied-value, identity, callback, closure, exception, promise, cancellation, iterator, and streaming matrices.
- Validate raw ESM, browsers, workers, Vite, Rollup, Webpack, React, Python, and a second generated host backend.
- Build and measure 1, 3, 10, and 50-library graphs against standalone-runtime controls.
- Attach theorem provenance and trusted-boundary metadata to exact generated wrappers and artifacts.
- Implement the zero-configuration analyze, build, clean-rebuild, compare, report, and publish pipeline.
- Add AArch64 and declared WASI portability profiles.

## Architecture accepted by the decision

1. One application owns one Lean runtime and ownership domain.
2. PHP-Wasm-style recursive side-module loading binds runtime-free libraries into that application.
3. Final-static composition uses the same capsule graph and semantic lock.
4. Lean declarations and binding metadata generate host APIs, validators, docs, schemas, tests, and assurance records.
5. Generation-safe registries and deterministic disposal control cross-runtime lifetimes.
6. Promise and callback protocols leave no suspended Wasm stack across host asynchronous work.
7. Nix and the semantic lock identify sources, dependencies, tools, proofs, wrappers, targets, and artifacts.
8. JavaScript receives a first-class API through a host-neutral core that can support Python, C, C++, Rust, and WASI projections.
9. Accessibility, diagnostics, install effort, and time to first call are release requirements.
10. Reproducibility blocks publication when two clean builds differ.

The repository history records the evolving design package. Evidence documents bind measured claims to toolchain and artifact hashes. Material architecture changes still require review before production hardening.
