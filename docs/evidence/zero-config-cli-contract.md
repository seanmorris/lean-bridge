# Zero-configuration CLI contract evidence

## Result

The repository now installs a `lean-bridge` command with three workflows:

```sh
lean-bridge analyze
lean-bridge build
lean-bridge publish
```

Every command defaults to noninteractive execution and concise human output. `--json` or `--format json` emits one machine-readable result object for scripts and agents. `--interactive` grants later analyzer implementations permission to ask only for unresolved adapter hints. It does not enable prompts by default.

`publish --dry-run --bundle <path> --output <path>` is operational. It runs the existing local release rehearsal, emits registry-ready archives and an in-toto statement, and reports zero external registry writes through the CLI result.

The general analyzer, Docker or Nix build selector, and external publisher belong to nodes 877, 876, and 879. Their commands currently return `blocked` with stable diagnostic codes and the responsible plan node. The CLI does not report those workflows as successful before their implementations exist.

## Agent contract

[`schema/cli-result.schema.json`](../../schema/cli-result.schema.json) defines a closed version 1 envelope:

- command and execute or dry-run mode;
- status: `ok`, `blocked`, `needs-input`, or `failed`;
- resolved project path and interactive permission;
- command result or null;
- structured diagnostics with code, severity, message, source path, and remedy; and
- explicit next actions.

JSON mode writes the envelope to standard output for every command result, including blocked and failed results. Human mode writes successful output to standard output and errors to standard error. Exit code 0 means success, 1 means execution failure, 2 means blocked or input required, and 64 means invalid command syntax.

The parser rejects unknown commands, command-inappropriate flags, repeated flags, missing values, unsupported formats, and simultaneous `--json` and `--format`. `--dry-run` belongs only to `publish`. `analyze` receives no output option because its contract is read-only.

## Tests

[`tests/cli-contract.test.mjs`](../../tests/cli-contract.test.mjs) verifies:

- noninteractive defaults and absolute path resolution;
- command-specific options and dry-run mode;
- closed structured diagnostics for agents;
- stable blocked-command exit behavior in JSON and human formats;
- the executable does not claim deferred commands are complete;
- publish dry-run produces a real no-publish publication index; and
- the published JSON schema closes the result and diagnostic objects.

Run the focused gate:

```sh
node --test tests/cli-contract.test.mjs
npm run cli -- --help
```
