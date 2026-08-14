# CLI implementation

This directory implements the `lean-bridge` command surface.

- [`contract.mjs`](contract.mjs) validates command inputs, structured results, diagnostics, and exit codes.
- [`commands.mjs`](commands.mjs) dispatches analysis, build, package, publication rehearsal, and verification workflows.
- [`run.mjs`](run.mjs) connects process arguments and output streams to the command contract.

CLI modules call domain modules under `src`. They do not duplicate analysis, build, or release policy.

See the [Lean author guide](../../docs/lean-author-guide.md) and [zero-configuration CLI evidence](../../docs/evidence/zero-config-cli-contract.md).
