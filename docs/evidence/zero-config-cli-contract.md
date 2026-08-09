# Zero-configuration CLI contract evidence

## Result

The repository now installs a `lean-bridge` command with three workflows:

```sh
lean-bridge analyze
lean-bridge build
lean-bridge publish
```

Every command defaults to noninteractive execution and concise human output. `--json` or `--format json` emits one machine-readable result object for scripts and agents. `--interactive` grants later analyzer implementations permission to ask only for unresolved adapter hints. It does not enable prompts by default.

`analyze` is operational. It inventories a Lean project without changing it, validates an existing Binding IR or proposes one for conservatively supported copied values, and reports narrow adapter questions for unresolved boundaries. [The analyzer evidence](lean-project-analysis.md) records its inference and assurance limits.

`build` is operational. It chooses the pinned Debian Docker builder first, falls back to native Nix, and validates one canonical artifact and package closure before moving the result into place. [The Docker-first build evidence](docker-first-build.md) records its image, flake, source-mount, fallback, and failure policies.

`publish --dry-run --output <path>` is operational. It requires committed source, creates two independent clean source clones, runs the canonical build twice with separate writable state, compares every bundle and package artifact, and emits a content-addressed release authorization only when every byte and mode matches. [The reproducibility gate evidence](reproducibility-release-gate.md) records the isolation, comparison, report, authorization, and CI contracts.

External publication belongs to node 879. That command returns `blocked` with a stable diagnostic code. The CLI does not report registry writes as successful before their implementation exists.

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
- stable success and blocked-command exit behavior in JSON and human formats;
- the executable analyzes the repository and does not claim deferred commands are complete;
- publish dry-run invokes the clean rebuild authorization gate; and
- the published JSON schema closes the result and diagnostic objects.

Run the focused gate:

```sh
node --test tests/cli-contract.test.mjs
npm run cli -- --help
```
