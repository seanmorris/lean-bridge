# CLI reference

Use this page when scripting an installed `lean-bridge` CLI. The [author tutorial](../lean/first-component.md) covers a first build; the [publishing guide](../publishing.md) covers release preparation. Application users calling an already prepared package do not need the CLI.

This page is generated from the command contract and result schema. Site builds reject a stale generated page.

## Commands and options

The following is the CLI's actual help output. Run `lean-bridge --help` to compare it with your installed version.

{{CLI_HELP}}

`analyze` reads the project without changing its Lean source. An explicit `--output` writes analysis files. `build` creates local artifacts. `publish --dry-run` performs release preparation and verification without registry uploads; it can still build artifacts and invoke configured authorization providers.

`--bundle` and `--authorization` are also accepted by the parser for an explicit bundle-and-authorization publication path. They are not prerequisites for the ordinary component workflow. Follow [Approve a production release](../publish/production-release.md) for that path rather than combining examples from different release modes.

## Defaults and configuration

For `lean-bridge build` with no CLI configuration or environment overrides and no interactive terminal, the parser returns:

{{CLI_DEFAULTS}}

Values resolve in this order: command-line option, environment, CLI configuration, default. The project defaults to the working directory. `--config` selects a configuration file; otherwise the CLI checks `LEAN_BRIDGE_CONFIG` and `lean-bridge.cli.json`. Relative paths in configuration resolve beside that file.

Environment overrides include `LEAN_BRIDGE_PROJECT`, `LEAN_BRIDGE_TARGETS` (comma-separated), `LEAN_BRIDGE_FORMAT`, `LEAN_BRIDGE_CACHE`, `LEAN_BRIDGE_CACHE_DIRECTORY`, and `LEAN_BRIDGE_PROGRESS`. Repeated `--target` options form a sorted, deduplicated selection. Without a selection, the CLI considers all applicable targets; it does not make unsupported targets executable.

Configuration is closed: unknown fields fail. Version 1 covers project, targets, cache, format, and progress. Version 2 adds publication settings. See the [configuration schema](../../schema/cli-config.schema.json) for the exact shape.

## JSON results and progress

Use `--json --progress none` when a script needs one final JSON result on standard output. `--progress json` emits progress records on standard error. Parse the final record's `status`, `diagnostics`, and `nextActions`; do not infer success from the last progress message.

The [result schema](../../schema/cli-result.schema.json) requires these fields:

{{CLI_RESULT_FIELDS}}

The command-specific `result` contains analysis, build, or publication data. A blocked command can return useful diagnostics without producing a usable package. Prompts require the explicit `--interactive` option; attaching a terminal does not authorize a release.

## Exit codes

{{CLI_EXIT_CODES}}

`needsInput` is the exit-code constant for a `needs-input` result. Both `blocked` and `needs-input` exit with 2. Invalid arguments or configuration exit with 64.

## Verify and continue

The source owner is [the CLI contract](../../src/cli/contract.mjs). Its [contract tests](../../tests/cli-contract.test.mjs) exercise parsing, precedence, closed records, cancellation, and process output. The documentation checks compare this page with that contract and execute the CLI entry point's help and rejection paths. Contributors follow [reference generation](../../site/README.md#content-and-ownership) to update the page.

Next, [resolve a diagnostic](../lean/diagnostics.md), [build a component](../lean/first-component.md), or [prepare a local handoff](../publish/local-handoff.md).
