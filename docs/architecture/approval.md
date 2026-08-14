# Implementation approval checkpoint

## Architecture-testing decision

The project owner approved the falsification-driven proof of concept on 8 August 2026. That decision authorized the ordered work in [the POC plan](poc-plan.md). It did not authorize a production-stability claim or live package publication.

## Current production decision

Production approval remains withheld as of 14 August 2026. The [production-hardening review](../evidence/production-hardening-review-20260814.md) records the executed workflows, all eight architecture-lens results, and the remaining approval conditions.

The repository may build, rehearse, install, and measure local artifacts. No repository workflow holds registry credentials or performs a live registry write.

## Evidence completed after POC approval

- A pinned Lean 4.32.2 toolchain builds the browser, threaded Wasm, native, and Component Model artifact profiles used by the fixtures.
- Independently compiled Alpha, Beta, and Gamma components share the declared runtime, memory, table, initialization, and identity domains.
- Startup, lazy, final-static, native, managed, browser, and WIT/WASI consumers use reviewed graph, runtime, package, and receipt identities.
- Binding IR produces direct generated APIs for JavaScript, TypeScript, PHP, Python, Rust, C, C++, .NET, JVM, Ruby, and WIT.
- Clean package consumers execute real Lean for every row in the versioned consumer support contract.
- Two isolated clean builds compare every package byte and file mode before release authorization.
- Performance CI records generated-call overhead, startup, shared and isolated runtime memory, lifecycle behavior, composition scaling, and clean-build reproducibility with environment identity.
- The automated clean-room role completed analyze, build, publish dry-run, package installation, native calls, and receipt verification without annotations, wrappers, or source changes.

The [evidence index](../evidence/README.md) owns the executed commands, artifacts, measurements, and limitations behind these statements.

## Conditions before production approval

1. A real Lean author completes the clean-room author workflow.
2. Real JavaScript and Python consumers complete their clean package workflows.
3. An independent party reconstructs the release outside this repository's workflow and administration boundary.
4. The owner approves an explicit production deployment profile, including operating systems, architectures, runtime versions, and excluded capabilities.
5. Live publication receives an operated registry adapter, credential boundary, signer policy, and recovery procedure.
6. A human reviewer accepts the assurance chain, trusted boundaries, open risks, and production decision.

The clean-room protocol requires actual human participants. An automated agent cannot satisfy conditions 1 or 2 by generating session records.

## Accepted architecture invariants

1. One application owns one Lean runtime and ownership domain.
2. Runtime-loaded components and final-static composition consume one canonical graph and semantic lock.
3. Binding IR and ABI plans generate host APIs, validators, schemas, documentation, and assurance references.
4. Generated public APIs expose named host-language declarations and keep transport handles, raw symbols, pointers, and generic dispatch private.
5. Generation-safe registries and deterministic disposal control cross-runtime lifetimes; finalization is fallback cleanup.
6. Promise and callback protocols leave no suspended Wasm stack across host asynchronous work.
7. The flake, graph, source closure, toolchain, proof references, generated files, and artifact hashes remain joined by canonical identities.
8. Registry packages project one compiler-free canonical bundle and do not rebuild component artifacts.
9. Accessibility, diagnostics, clean installation, and receipt verification are release evidence.
10. Reproducibility blocks release authorization when two clean builds differ.

Material architecture changes still require evidence, risk review, migration analysis, and owner approval.
