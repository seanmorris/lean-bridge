# Test suite

This directory validates contracts, generators, runtime behavior, deterministic packages, clean consumers, release controls, documentation, and measured evidence. Tests range from pure record validation to real Lean compilation and independently installed downstream packages.

## Layout

| Path | Purpose |
|---|---|
| Root `*.test.mjs` files | Public module contracts, generators, package builders, release state, and end-to-end integration. |
| [`internal/abi`](internal/abi/) | Focused ABI, loader, runtime lifecycle, callback, finalization, and private adapter behavior. |
| [`fixtures/onboarding`](fixtures/onboarding/) | Plain Lake projects for supported declarations, adapter questions, ambiguity, and documentation analysis. |
| [`fixtures/browser-consumer`](fixtures/browser-consumer/) | Browser, worker, and React entrypoints installed against the generated npm archive. |
| [`helpers`](helpers/) | Shared structural assertions for Lean link artifacts and related integration tests. |

Proof fixtures that require their own source graph live under [`../poc`](../poc/README.md). Tests compile or copy them into ignored build and temporary directories.

## Test layers

### Contract and unit tests

These tests validate schemas, closed object shapes, canonical hashes, state transitions, graph ordering, generated declarations, and error cases without requiring an external compiler. They should cover valid input and the narrow invalid condition named by the test.

### Fixture integration tests

Link-spike, Lean-link, native runtime, performance, and component-engine tests execute pinned build outputs. They establish that individually tested plans still compose across compiler, linker, loader, and generated adapter boundaries.

### Package tests

Package-builder tests inspect archive contents, metadata, paths, modes, hashes, and reproducibility. These tests establish package integrity. They do not by themselves establish downstream runtime support.

### Clean consumer tests

Consumer commands install generated archives into new projects using ordinary ecosystem tooling. A supported target then executes a real Lean component through the documented generated API and verifies its receipt. Partial and blocked targets run the strongest available package or interface check and report the exact missing runtime capability.

[`archive-subjects.test.mjs`](archive-subjects.test.mjs) requires every supported consumer to map to a signed ecosystem archive subject. [`release-receipt.test.mjs`](release-receipt.test.mjs) runs the repository-free verifier outside the checkout and rejects changed archive bytes or an adjacent signer-policy substitution.

[`../scripts/consumer-ci.mjs`](../scripts/consumer-ci.mjs) writes a complete summary row for every declared target, including package installation, real Lean execution, result, performance observation when available, and blocker. The test fails if observed capability and [`../docs/consumer-support.v1.json`](../docs/consumer-support.v1.json) disagree.

### Documentation tests

[`documentation.test.mjs`](documentation.test.mjs) validates internal links, code references, directory explainers, support-table consistency, public example boundaries, repository paths, and writing-rule checks. `npm run test:docs` is the focused local entrypoint.

## Running tests

`npm test` prepares the link, Lean, threaded runtime, performance, and scaling fixtures before running the Node test corpus. `npm run lint` checks JavaScript and TypeScript source style. `npm run typecheck` checks the JavaScript project with TypeScript analysis. `npm run check` adds the environment inventory and runs the complete local sequence.

Focused npm commands in [`../package.json`](../package.json) run individual package, consumer, acceptance, or toolchain paths. Use the narrow command while developing, then run the broader affected layer before committing. Nix-backed consumer commands require the pinned toolchains described in [`../nix`](../nix/README.md).

## Isolation and determinism

Tests may read committed fixtures but do not modify them in place. Use a fresh temporary directory for clean consumers and per-test generated output. Fixed test clocks, normalized archives, deterministic finalization substitutes, and explicit environment records keep assertions independent of filesystem ordering or garbage-collector timing.

Do not import repository-private ABI modules from a public consumer fixture. The fixture should fail if the produced package omits a required public export or runtime artifact.

## Adding coverage

1. Add a focused unit test for the new contract or failure mode.
2. Extend the owning integration fixture when behavior crosses module boundaries.
3. Add archive assertions when package contents change.
4. Add or update a clean consumer when the public generated API changes.
5. Update the support record only when real observed capability changes.
6. Record executed environment and limitations when the test produces evidence.

Keep test names descriptive enough to identify the contract that failed. Durable executed results belong in the [evidence index](../docs/evidence/README.md), while test code remains the repeatable procedure.
