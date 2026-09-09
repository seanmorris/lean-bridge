# CLI reference

Use this page when scripting an installed `lean-bridge` CLI. The [author tutorial](../lean/first-component.md) covers a first build; the [publishing guide](../publishing.md) covers release preparation. Application users calling an already prepared package do not need the CLI.

This page is generated from the command contract and result schema. Site builds reject a stale generated page.

## Commands and options

The following is the CLI's actual help output. Run `lean-bridge --help` to compare it with your installed version.

```text
Usage: lean-bridge <command> [options]

Commands:
  analyze              Inspect a Lean project without changing it
  build                Build the canonical artifact set
  publish              Verify and publish configured package projections

Common options:
  --project <path>      Lean project root, defaults to configuration, environment, then cwd
  --config <path>       CLI configuration, defaults to LEAN_BRIDGE_CONFIG or lean-bridge.cli.json
  --target <name>       Select a target; repeat for more than one, defaults to all applicable targets
  --format human|json  Final result format, defaults to human
  --json                Alias for --format json
  --progress <mode>     Progress mode: auto, none, plain, or json
  --interactive         Permit prompts for unresolved adapter hints
  --help                Show command help

Analyze options:
  --output <directory>  Atomically write the analysis, Binding IR, and policy report
  --check               Enforce the built-in analysis policy
  --policy <path>       Enforce a closed policy file; implies --check

Build and publish options:
  --cache use|refresh|off  Select cache policy
  --no-cache            Alias for --cache off
  --cache-directory <path> Select an explicit cache directory
  --output <path>       Local build, gate, or publication output

Publish options:
  --manifest <path>     Consume the exact manifest produced by publish --dry-run
  --dry-run             Build twice, compare, authorize, and plan without registry writes

Exit codes:
  0                     Command succeeded
  1                     Command executed and failed
  2                     Command is blocked or requires input
  64                    Command syntax or configuration is invalid
  130                   Command was cancelled
```

`analyze` reads the project without changing its Lean source. An explicit `--output` writes analysis files. `build` creates local artifacts. `publish --dry-run` performs release preparation and verification without registry uploads; it can still build artifacts and invoke configured authorization providers.

`--bundle` and `--authorization` are also accepted by the parser for an explicit bundle-and-authorization publication path. They are not prerequisites for the ordinary component workflow. Follow [Approve a production release](../publish/production-release.md) for that path rather than combining examples from different release modes.

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

Values resolve in this order: command-line option, environment, CLI configuration, default. The project defaults to the working directory. `--config` selects a configuration file; otherwise the CLI checks `LEAN_BRIDGE_CONFIG` and `lean-bridge.cli.json`. Relative paths in configuration resolve beside that file.

Environment overrides include `LEAN_BRIDGE_PROJECT`, `LEAN_BRIDGE_TARGETS` (comma-separated), `LEAN_BRIDGE_FORMAT`, `LEAN_BRIDGE_CACHE`, `LEAN_BRIDGE_CACHE_DIRECTORY`, and `LEAN_BRIDGE_PROGRESS`. Repeated `--target` options form a sorted, deduplicated selection. Without a selection, the CLI considers all applicable targets; it does not make unsupported targets executable.

Configuration is closed: unknown fields fail. Version 1 covers project, targets, cache, format, and progress. Version 2 adds publication settings. See the [configuration schema](../../schema/cli-config.schema.json) for the exact shape.

## JSON results and progress

Use `--json --progress none` when a script needs one final JSON result on standard output. `--progress json` emits progress records on standard error. Parse the final record's `status`, `diagnostics`, and `nextActions`; do not infer success from the last progress message.

The [result schema](../../schema/cli-result.schema.json) requires these fields:

| Required JSON field | Schema |
| --- | --- |
| `schemaVersion` | `2` |
| `command` | `[{"enum":["analyze","build","publish"]},{"type":"null"}]` |
| `mode` | `[{"enum":["execute","dry-run"]},{"type":"null"}]` |
| `status` | `["ok","blocked","needs-input","failed","cancelled"]` |
| `exitCode` | `[0,1,2,64,130]` |
| `project` | `"string"` |
| `interactive` | `"boolean"` |
| `configuration` | `"object"` |
| `selection` | `"object"` |
| `cache` | `"object"` |
| `progress` | `"object"` |
| `result` | `[{"type":"object"},{"type":"null"}]` |
| `diagnostics` | `"array"` |
| `prompts` | `"array"` |
| `nextActions` | `"array"` |

The command-specific `result` contains analysis, build, or publication data. A blocked command can return useful diagnostics without producing a usable package. Prompts require the explicit `--interactive` option; attaching a terminal does not authorize a release.

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

## Verify and continue

The source owner is [the CLI contract](../../src/cli/contract.mjs). Its [contract tests](../../tests/cli-contract.test.mjs) exercise parsing, precedence, closed records, cancellation, and process output. The documentation checks compare this page with that contract and execute the CLI entry point's help and rejection paths. Contributors follow [reference generation](../../site/README.md#content-and-ownership) to update the page.

Next, [resolve a diagnostic](../lean/diagnostics.md), [build a component](../lean/first-component.md), or [prepare a local handoff](../publish/local-handoff.md).
