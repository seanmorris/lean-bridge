# Repository scripts

Scripts expose contributor and CI entrypoints over modules in [`../src`](../src/README.md).

## Groups

- `build-*` and `compile-*` create pinned runtime, component, and package artifacts.
- `check-*` and `verify-*` enforce structure, reproducibility, receipts, and release authorization.
- `test-*` execute clean downstream consumers through installed packages.
- `benchmark-*`, `collect-*`, and `performance-*` produce measured evidence.
- `generate-*` render reviewed projections and fixtures from canonical inputs.

[`lean-bridge.mjs`](lean-bridge.mjs) is the local CLI entrypoint. [`consumer-ci.mjs`](consumer-ci.mjs) records and summarizes downstream support observations. [`performance-ci.mjs`](performance-ci.mjs) assembles the complete performance workflow.

Prefer the npm commands in [`../package.json`](../package.json) over invoking a helper directly. Package scripts supply required build paths and arguments.
