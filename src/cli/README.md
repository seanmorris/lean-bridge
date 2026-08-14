# CLI implementation

This directory implements the `lean-bridge` command boundary. It converts process arguments and configuration into domain calls, then renders a stable result for a person, script, or CI job.

## Request lifecycle

```text
argv + environment + streams
            |
            v
      parse and validate
            |
            v
       command handler
            |
            v
  analyze, build, or release domain
            |
            v
 structured result + diagnostics + exit code
```

The CLI coordinates modules under [`../analyze`](../analyze/README.md), [`../build`](../build/README.md), and [`../release`](../release/README.md). It does not reimplement their validation or policy.

## Modules

[`contract.mjs`](contract.mjs) owns the process-independent command contract. It parses supported arguments, validates configuration and result records, defines exit codes, normalizes diagnostics, and represents prompt and cancellation outcomes. Callers can use this layer without writing to a terminal.

[`commands.mjs`](commands.mjs) creates the command handlers and dispatches analysis, canonical build, package preparation, publication rehearsal, and verification work. Dependencies are injected so tests can run handlers without invoking real toolchains.

[`run.mjs`](run.mjs) adapts the contract to a process. It connects arguments, standard streams, progress rendering, signals, and the final process status.

## Results and failure behavior

Every command returns a structured result before the process adapter chooses an exit code. Diagnostics identify the failed stage and provide stable details for automation. Expected user errors, cancellation, and internal failures remain distinct outcomes.

Progress output describes active stages but is not part of artifact identity. Machine-readable files, manifests, and receipts come from the relevant domain modules. A consumer should verify those records instead of parsing terminal prose.

Prompts are explicit contract events. Commands intended for clean CI execution expose non-interactive inputs and do not infer confirmation from an attached terminal. Cancellation propagates through the handler boundary so interrupted work does not report success.

## Adding or changing a command

1. Put reusable behavior in the owning domain directory.
2. Add argument and configuration validation to `contract.mjs`.
3. Add a handler with injected dependencies in `commands.mjs`.
4. Map its result, diagnostics, cancellation, and exit status in `run.mjs`.
5. Add contract tests for valid input, invalid input, success, expected failure, and cancellation.
6. Update the relevant user guide and `lean-bridge --help` expectations.

Avoid exposing private ABI names or transport choices in public options. The generated API and package receipt remain the user-facing contract.

## Verification and guides

[`../../tests/cli-contract.test.mjs`](../../tests/cli-contract.test.mjs) covers parsing, handlers, diagnostics, prompts, cancellation, and process results. Onboarding exercises the installed executable through [`../../tests/onboarding-acceptance.test.mjs`](../../tests/onboarding-acceptance.test.mjs). User workflows live in the [Lean author guide](../../docs/lean-author-guide.md), and the [zero-configuration CLI evidence](../../docs/evidence/zero-config-cli-contract.md) records the executed behavior.
