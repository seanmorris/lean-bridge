# Test suite

The test suite validates contracts, generators, runtime behavior, deterministic packages, clean consumers, release controls, documentation, and measured evidence.

## Layout

- Root `*.test.mjs` files cover public modules and end-to-end contracts.
- [`internal`](internal/) contains focused ABI and runtime adapter tests.
- [`fixtures`](fixtures/) contains project and consumer inputs copied into clean directories.
- [`helpers`](helpers/) contains shared structural assertions.

`npm test` builds required Lean and performance fixtures before running the Node test corpus. `npm run test:docs` runs the documentation contract. Consumer-specific commands are defined in [`../package.json`](../package.json) and executed by the downstream matrix.

Tests may read committed fixtures and write under temporary or ignored build directories. They do not modify source fixtures in place.
