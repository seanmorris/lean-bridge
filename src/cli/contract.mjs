import { resolve } from "node:path";

const commands = new Set(["analyze", "build", "publish"]);
const formats = new Set(["human", "json"]);
const statuses = new Set(["ok", "blocked", "needs-input", "failed"]);
const severities = new Set(["info", "warning", "error"]);

export class CliContractError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "CliContractError";
    this.code = code;
    this.details = details;
  }
}

const fail = (code, message, details = {}) => {
  throw new CliContractError(code, message, details);
};

const exactKeys = (value, keys, label) => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail("invalid-cli-result", `${label} must be an object`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail("invalid-cli-result", `${label} fields must be closed`, { actual, expected });
  }
};

const optionDefinitions = Object.freeze({
  "--project": Object.freeze({ name: "project", value: true, commands }),
  "--format": Object.freeze({ name: "format", value: true, commands }),
  "--json": Object.freeze({ name: "json", value: false, commands }),
  "--interactive": Object.freeze({ name: "interactive", value: false, commands }),
  "--help": Object.freeze({ name: "help", value: false, commands }),
  "--output": Object.freeze({ name: "output", value: true, commands: new Set(["build", "publish"]) }),
  "--bundle": Object.freeze({ name: "bundle", value: true, commands: new Set(["publish"]) }),
  "--dry-run": Object.freeze({ name: "dryRun", value: false, commands: new Set(["publish"]) }),
});

export const cliUsage = `Usage: lean-bridge <command> [options]

Commands:
  analyze              Inspect a Lean project without changing it
  build                Build the canonical artifact set
  publish              Verify and publish configured package projections

Common options:
  --project <path>      Lean project root, defaults to the current directory
  --format human|json  Output format, defaults to human
  --json                Alias for --format json
  --interactive         Permit prompts for unresolved adapter hints
  --help                Show command help

Build options:
  --output <path>       Local build output

Publish options:
  --bundle <path>       Existing canonical release bundle
  --output <path>       Local rehearsal or publication output
  --dry-run             Run every local gate without registry writes
`;

export const parseCliArguments = (argv, { cwd = process.cwd() } = {}) => {
  if (!Array.isArray(argv)) fail("invalid-cli-arguments", "CLI arguments must be an array");
  if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h") {
    return Object.freeze({ kind: "help", command: null, format: "human" });
  }
  if (argv[0] === "--version" || argv[0] === "-v") {
    return Object.freeze({ kind: "version", command: null, format: "human" });
  }
  const command = argv[0];
  if (!commands.has(command)) fail("unknown-command", `unknown command ${command}`);
  const parsed = {
    project: cwd,
    format: "human",
    interactive: false,
    help: false,
    output: null,
    bundle: null,
    dryRun: false,
  };
  const seen = new Set();
  for (let index = 1; index < argv.length; index += 1) {
    const flag = argv[index];
    const definition = optionDefinitions[flag];
    if (!definition || !definition.commands.has(command)) fail("unknown-option", `${command} does not support ${flag}`);
    if (seen.has(definition.name)) fail("duplicate-option", `${flag} may be specified once`);
    seen.add(definition.name);
    if (definition.value) {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("--")) fail("missing-option-value", `${flag} requires a value`);
      parsed[definition.name] = value;
      index += 1;
    } else {
      parsed[definition.name] = true;
    }
  }
  if (seen.has("json") && seen.has("format")) fail("duplicate-option", "choose either --json or --format");
  if (parsed.json) parsed.format = "json";
  delete parsed.json;
  if (!formats.has(parsed.format)) fail("invalid-output-format", `unsupported output format ${parsed.format}`);
  if (parsed.help) return Object.freeze({ kind: "help", command, format: parsed.format });
  return Object.freeze({
    kind: "command",
    command,
    mode: command === "publish" && parsed.dryRun ? "dry-run" : "execute",
    project: resolve(cwd, parsed.project),
    output: parsed.output === null ? null : resolve(cwd, parsed.output),
    bundle: parsed.bundle === null ? null : resolve(cwd, parsed.bundle),
    format: parsed.format,
    interactive: parsed.interactive,
  });
};

export const validateCliResult = result => {
  exactKeys(result, [
    "schemaVersion", "command", "mode", "status", "project", "interactive", "result", "diagnostics", "nextActions",
  ], "CLI result");
  if (result.schemaVersion !== 1) fail("unsupported-cli-result", "CLI result version is not supported");
  if (!commands.has(result.command)) fail("invalid-cli-result", `unknown result command ${result.command}`);
  if (!new Set(["execute", "dry-run"]).has(result.mode)) fail("invalid-cli-result", `unknown result mode ${result.mode}`);
  if (result.mode === "dry-run" && result.command !== "publish") fail("invalid-cli-result", "dry-run mode belongs to publish");
  if (!statuses.has(result.status)) fail("invalid-cli-result", `unknown result status ${result.status}`);
  if (typeof result.project !== "string" || result.project === "") fail("invalid-cli-result", "result project must be a path");
  if (typeof result.interactive !== "boolean") fail("invalid-cli-result", "result interactive flag must be boolean");
  if (result.result !== null && (typeof result.result !== "object" || Array.isArray(result.result))) {
    fail("invalid-cli-result", "command result must be an object or null");
  }
  if (!Array.isArray(result.diagnostics) || !Array.isArray(result.nextActions)) {
    fail("invalid-cli-result", "diagnostics and next actions must be arrays");
  }
  for (const diagnostic of result.diagnostics) {
    exactKeys(diagnostic, ["code", "severity", "message", "path", "hint"], "diagnostic");
    if (typeof diagnostic.code !== "string" || diagnostic.code === "") fail("invalid-cli-result", "diagnostic code is required");
    if (!severities.has(diagnostic.severity)) fail("invalid-cli-result", `invalid diagnostic severity ${diagnostic.severity}`);
    if (typeof diagnostic.message !== "string" || diagnostic.message === "") fail("invalid-cli-result", "diagnostic message is required");
    for (const field of ["path", "hint"]) {
      if (diagnostic[field] !== null && typeof diagnostic[field] !== "string") fail("invalid-cli-result", `diagnostic ${field} must be a string or null`);
    }
  }
  if (result.nextActions.some(action => typeof action !== "string" || action === "")) {
    fail("invalid-cli-result", "next actions must be non-empty strings");
  }
  if (result.status === "ok" && result.diagnostics.some(item => item.severity === "error")) {
    fail("contradictory-cli-result", "successful result contains an error diagnostic");
  }
  return true;
};

export const diagnostic = ({ code, severity = "error", message, path = null, hint = null }) =>
  Object.freeze({ code, severity, message, path, hint });
