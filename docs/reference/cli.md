# CLI reference

Use this page when scripting an installed `lean-bridge` CLI. The [author tutorial](../lean/first-component.md) covers a first build; the [publishing guide](../publishing.md) covers release preparation. Application users calling an already prepared package do not need the CLI. Recipients can use `verify` to check downloaded archives before installation.

This page is generated from the command contract and result schema. Site builds reject a stale generated page.

## Commands and options

The following is the CLI's actual help output. Run `lean-bridge --help` to compare it with your installed version.

```text
Usage: lean-bridge <command> [options]

Commands:
  analyze              Inspect a Lean project without changing it
  build                Build the canonical artifact set
  publish              Verify and publish configured package projections
  verify               Check a local npm handoff or authenticate a signed archive

Common options:
  --format human|json  Final result format, defaults to human
  --json                Alias for --format json
  --progress <mode>     Progress mode: auto, none, plain, or json
  --help                Show command help

Author options (analyze, build, publish):
  --project <path>      Lean project root, defaults to configuration, environment, then cwd
  --config <path>       CLI configuration, defaults to LEAN_BRIDGE_CONFIG or lean-bridge.cli.json
  --target <name>       Select a target; repeat for more than one, defaults to all applicable targets
  --interactive         Permit prompts for unresolved adapter hints

Analyze options:
  --output <directory>  Atomically write the analysis, Binding IR, and policy report
  --check               Enforce the built-in analysis policy
  --policy <path>       Enforce a closed policy file; implies --check

Build and publish options:
  --cache use|refresh|off  Select cache policy
  --no-cache            Alias for --cache off
  --cache-directory <path> Select an explicit cache directory
  --output <path>       Local build, gate, or publication output
  --target cpan         Build native Perl packages using lean-bridge.exports.json
  --target c|cpp        Build native C/C++ packages for copied primitive exports

Publish options:
  --manifest <path>     Consume the exact manifest produced by publish --dry-run
  --dry-run             Build twice, compare, authorize, and plan without registry writes

Verify options (no project or build tools required):
  --receipt <path>      Required local npm receipt or signed release receipt
  --artifacts <dir>     Local npm archives; defaults to the receipt's directory

Signed verification requires all five options below and the receipt's .sha256 sidecar:
  --archive <path>      Downloaded archive with its original filename
  --policy <path>       Public signer policy
  --policy-sha256 <hash> Policy SHA-256 from a separate trusted source
  --subject <path>      Expected signed release-relative archive path
  --coordinate <name>   Expected ecosystem package coordinate
  Do not combine signed verification with --artifacts.

Exit codes:
  0                     Command succeeded
  1                     Command executed and failed
  2                     Command is blocked or requires input
  64                    Command syntax or configuration is invalid
  130                   Command was cancelled
```

`analyze` compiles fresh Lean interfaces in the pinned Nix or Docker engine without changing the source checkout. A dependency-free Lake project needs no lockfile; dependencies and generators require a reviewed lock. Missing backends or extraction faults never select a source-scanning fallback. Explicit reviewed Binding IR can be validated without a compiler.

An explicit `--output` writes the version-2 analysis report, available Binding IR, and optional policy report. `requireCompiledExports` requires fresh compiler evidence. `build` creates local artifacts. `publish --dry-run` performs release preparation and verification without registry uploads; it can still build artifacts and invoke configured authorization providers.

`verify --receipt <path>` checks a local npm handoff. Add `--artifacts <directory>` only when its two archives are stored outside the receipt's directory. Signed verification requires `--archive`, `--policy`, `--policy-sha256`, `--subject`, and `--coordinate` together, plus the receipt's matching `.sha256` sidecar. Do not combine those options with `--artifacts`. Unknown receipt types and failed authentication are errors; they never select a weaker check. See [Use a prepared release](../consume/receive-package.md) for both commands and Node-only CLI installation.

`--bundle` and `--authorization` are also accepted by the parser for an explicit bundle-and-authorization publication path. They are not prerequisites for the ordinary component workflow. Follow [Release Lean Bridge](../contributing/production-release.md) for that path rather than combining examples from different release modes.

## Defaults and configuration

For `lean-bridge build` with no CLI configuration or environment overrides and no interactive terminal, the parser returns:

```json
{
  "format": "human",
  "interactive": false,
  "selection": {
    "allTargets": true,
    "targets": []
  },
  "cache": {
    "policy": "use",
    "directory": null
  },
  "progress": "none"
}
```

For author commands, values resolve in this order: command-line option, environment, CLI configuration, default. The project defaults to the working directory. `--config` selects a configuration file; otherwise the CLI checks `LEAN_BRIDGE_CONFIG` and `lean-bridge.cli.json`. Relative paths in configuration resolve beside that file.

Environment overrides include `LEAN_BRIDGE_PROJECT`, `LEAN_BRIDGE_TARGETS` (comma-separated), `LEAN_BRIDGE_FORMAT`, `LEAN_BRIDGE_CACHE`, `LEAN_BRIDGE_CACHE_DIRECTORY`, and `LEAN_BRIDGE_PROGRESS`. Repeated `--target` options form a sorted, deduplicated selection. Without a selection, the CLI considers all applicable targets; it does not make unsupported targets executable.

Configuration is closed: unknown fields fail. Version 1 covers project, targets, cache, format, and progress. Version 2 adds publication settings. See the [configuration schema](../../schema/cli-config.schema.json) for the exact shape.

`verify` ignores project configuration and all build/publication environment settings. Only `LEAN_BRIDGE_FORMAT` and `LEAN_BRIDGE_PROGRESS` apply, with explicit flags taking precedence. Relative filesystem arguments resolve from the working directory. Verification rejects author-only flags such as `--project`, `--config`, `--target`, and `--output`; it creates no files, installs no packages, and needs no Lean compiler, runtime, Git, Nix, or Docker.

## JSON results and progress

Use `--json --progress none` when a script needs one final JSON result on standard output. `--progress json` emits progress records on standard error. Parse the final record's `status`, `diagnostics`, and `nextActions`; do not infer success from the last progress message.

The [result schema](../../schema/cli-result.schema.json) requires these fields:

| Required JSON field | Schema |
| --- | --- |
| `schemaVersion` | `2` |
| `command` | `[{"enum":["analyze","build","publish","verify"]},{"type":"null"}]` |
| `mode` | `[{"enum":["execute","dry-run"]},{"type":"null"}]` |
| `status` | `["ok","blocked","needs-input","failed","cancelled"]` |
| `exitCode` | `[0,1,2,64,130]` |
| `project` | `["string","null"]` |
| `interactive` | `"boolean"` |
| `configuration` | `"object"` |
| `selection` | `"object"` |
| `cache` | `"object"` |
| `progress` | `"object"` |
| `result` | `[{"type":"object"},{"type":"null"}]` |
| `diagnostics` | `"array"` |
| `prompts` | `"array"` |
| `nextActions` | `"array"` |

The command-specific `result` contains analysis, build, publication, or verification data. A blocked command can return useful diagnostics without producing a usable package. Prompts require the explicit `--interactive` option; attaching a terminal does not authorize a release.

Verification results keep the version-two envelope with `project: null`, an empty target selection, and caching disabled. Successful local checks include `result.verificationType: "local-npm"` and `result.authenticated: false`, alongside the component, runtime and receipt identities. Signed checks use `result.verificationType: "signed-archive"` and `result.authenticated: true`, alongside the archive identity, trusted policy hash and signature counts. `verified: true` on an unsigned receipt establishes archive consistency, not signer authentication.

## Exit codes

| Outcome | Exit code |
| --- | --- |
| ok | 0 |
| failed | 1 |
| blocked | 2 |
| needsInput | 2 |
| usage | 64 |
| cancelled | 130 |

`needsInput` is the exit-code constant for a `needs-input` result. Both `blocked` and `needs-input` exit with 2. Invalid arguments or configuration exit with 64.

Verification failures, including missing files, malformed receipts, and signature or hash mismatches, exit with 1. Incomplete or mixed verification options exit with 64. Cancellation exits with 130 and produces no successful verification result.

## Verify and continue

The source owner is [the CLI contract](../../src/cli/contract.mjs). Its [contract tests](../../tests/cli-contract.test.mjs) exercise parsing, precedence, closed records, cancellation, and process output. The documentation checks compare this page with that contract and execute the CLI entry point's help and rejection paths. Contributors follow [reference generation](../../site/README.md#content-and-ownership) to update the page.

Next, [resolve a diagnostic](../lean/diagnostics.md), [build a component](../lean/first-component.md), or [prepare a local handoff](../publish/local-handoff.md).
