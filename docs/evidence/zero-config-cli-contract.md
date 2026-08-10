# Zero-configuration CLI contract evidence

## Commands

The installed `lean-bridge` command exposes three workflows:

```sh
lean-bridge analyze
lean-bridge build
lean-bridge publish
```

`analyze` inventories a Lean project without changing it. It validates an existing Binding IR or proposes one for conservatively supported copied values. Ambiguous ownership, effects, names, or foreign boundaries produce structured adapter questions.

`analyze --output <directory>` atomically writes `project-analysis.json` and, when available, `binding-ir.json`. `--check` adds `policy-report.json` and enforces the built-in analysis policy. `--policy <path>` selects a closed policy file and implies check mode. The command rejects an existing destination. Without `--output`, it creates no source, generated, lock, cache, or report file.

`build` selects the pinned Debian Docker builder first and falls back to native Nix. It validates the canonical artifact set, package identities, and requested publication targets before moving the output into place.

`publish --dry-run --output <path>` creates two independent source trees, runs two isolated builds, compares every file byte and mode, and writes an authorization for the exact candidate. External registry writes remain blocked under node 879.

## Analysis output and policy

The output directory is an explicit write boundary. The CLI writes each file in a sibling staging directory, checks cancellation between files, and renames the complete directory into place. A failed or cancelled write removes staging state. Analysis that needs input still emits `project-analysis.json` and a failing policy report when requested. It does not invent `binding-ir.json`.

[`schema/analysis-policy.schema.json`](../../schema/analysis-policy.schema.json) defines six optional constraints over the non-negotiable safe baseline:

- maximum warning count;
- maximum undocumented export count;
- minimum proposed export count;
- compiled interface evidence for every export;
- permission to use statically inferred Binding IR; and
- a declared semantic package version.

The baseline always requires a Binding IR, at least one export, zero required adapter hints, and zero error diagnostics. A policy cannot relax those rules. The analyzer does not offer theorem-count or proof-coverage thresholds. Static theorem references remain unverified until Lean elaboration and the build connect them to an artifact.

[`schema/analysis-policy-report.schema.json`](../../schema/analysis-policy-report.schema.json) records the analysis hash, normalized policy and hash, measured counts, pass state, and ordered violations. The CLI also emits `analysis-policy-passed` or `analysis-policy-failed` as a structured diagnostic, so an agent can verify the applied policy without reading terminal prose.

## Agent result

[`schema/cli-result.schema.json`](../../schema/cli-result.schema.json) defines the closed version 2 result. `--json` writes this object to standard output for success, blocked work, required input, execution failure, cancellation, and invalid invocation syntax.

Every command result contains:

- the command, mode, status, and matching process exit code;
- the resolved project path and whether the caller explicitly permitted interaction;
- the configuration file and the source of each resolved setting;
- selected package targets, or an explicit all-applicable-targets state;
- the cache policy and optional native Nix cache directory;
- ordered progress events with sequence, phase, state, message, and optional counts;
- a command-specific result or null;
- diagnostics with stable codes, severity, path, and remedy;
- adapter questions with stable IDs and closed choices; and
- explicit next actions.

Invalid JSON invocations use the same envelope with a null command and mode. Agents do not need to parse the human usage text to identify an unknown flag or malformed configuration.

Schema version 2 replaces version 1. It adds `exitCode`, `configuration`, `selection`, `cache`, `progress`, and `prompts`, plus the `cancelled` status. A consumer must reject an unsupported schema version instead of guessing at missing control fields.

## Configuration precedence

The CLI resolves settings in this order:

1. command flags;
2. `LEAN_BRIDGE_*` environment values;
3. the selected configuration file; and
4. documented defaults.

`--config <path>` selects a file explicitly. `LEAN_BRIDGE_CONFIG` is next. The CLI otherwise reads `lean-bridge.cli.json` from the working directory when it exists. [`schema/cli-config.schema.json`](../../schema/cli-config.schema.json) closes the configuration object.

The supported environment values are:

| Setting | Environment value |
|---|---|
| project | `LEAN_BRIDGE_PROJECT` |
| final output format | `LEAN_BRIDGE_FORMAT` |
| comma-separated targets | `LEAN_BRIDGE_TARGETS` |
| cache policy | `LEAN_BRIDGE_CACHE` |
| native Nix cache directory | `LEAN_BRIDGE_CACHE_DIRECTORY` |
| progress mode | `LEAN_BRIDGE_PROGRESS` |

Configuration and environment values cannot enable interaction. Only the explicit `--interactive` flag grants permission to prompt. Noninteractive execution remains the default in terminals, scripts, and agents.

Example configuration:

```json
{
  "schemaVersion": 1,
  "project": ".",
  "targets": ["npm"],
  "cache": {
    "policy": "use",
    "directory": null
  },
  "format": "json",
  "progress": "none"
}
```

The final result names `cli`, `environment`, `config`, or `default` for every resolved setting. A CI job can therefore reject an unexpected environment override.

## Targets and caches

`--target <name>` is repeatable. Names match package ecosystems such as `npm` or canonical target IDs such as `node-esm`. The build validates each requested name against the canonical publication index. An unknown target or an ineligible projection blocks the build with a stable diagnostic and does not publish a partial output.

The cache policies are:

| Policy | Behavior |
|---|---|
| `use` | Use the selected backend's normal cache behavior. |
| `refresh` | Refresh inputs under native Nix, or bypass Docker's builder-image cache. |
| `off` | Use a fresh Docker overlay or a temporary private native Nix store. |

`--no-cache` is an alias for `--cache off`. `--cache-directory` selects a native Nix store beside the generated build staging area. Docker rejects that option with a clear remedy because the current builder does not mount a shared host cache.

The reproducibility gate never shares an explicit cache directory between its two builds. Each build receives separate writable state.

## Progress and cancellation

`--progress none` suppresses live events. `plain` writes readable progress to standard error. `json` writes one JSON event per line to standard error. The final result on standard output retains the complete ordered event list in every mode.

`auto` selects plain progress only for a human terminal. Scripts and JSON calls default to no live stream, so standard output remains one result object.

The first `SIGINT` or `SIGTERM` aborts the command. The analyzer checks cancellation while walking files and declarations. The build runner terminates an active child process and cleans staging state. The result status is `cancelled`, its diagnostic code is `cli-cancelled`, and the process exits with 130. A second signal terminates immediately.

## Exit codes

| Code | Meaning |
|---:|---|
| 0 | The command succeeded. |
| 1 | The command executed and failed. |
| 2 | Work is blocked or requires input. An existing analysis output also uses this code. |
| 64 | Syntax or configuration is invalid. |
| 130 | The command was cancelled. |

Human output reports the same project, target, cache, diagnostics, prompts, and next actions as the JSON envelope. Human failures go to standard error. JSON results always go to standard output.

## Tests

[`tests/cli-contract.test.mjs`](../../tests/cli-contract.test.mjs) covers configuration precedence, target and cache parsing, analysis policy resolution, malformed policy usage failures, structured prompts, progress streams, cancellation, dry-run authorization, external publication blocking, and the closed CLI schemas.

[`tests/lean-project-analyzer.test.mjs`](../../tests/lean-project-analyzer.test.mjs) covers deterministic output directories, conditional Binding IR output, policy thresholds, stable violations, existing destinations, source-tree preservation, cancellation cleanup, and the closed policy schemas.

[`tests/canonical-build.test.mjs`](../../tests/canonical-build.test.mjs) proves that selected package targets are validated, refresh bypasses the Docker build cache, ineligible targets fail closed, and cancellation terminates a spawned build process.

Run the focused contract:

```sh
node --test tests/lean-project-analyzer.test.mjs tests/cli-contract.test.mjs tests/canonical-build.test.mjs
npm run cli -- --help
```
