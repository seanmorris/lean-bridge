import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const commands = new Set(["analyze", "build", "publish"]);
const formats = new Set(["human", "json"]);
const statuses = new Set(["ok", "blocked", "needs-input", "failed", "cancelled"]);
const severities = new Set(["info", "warning", "error"]);
const cachePolicies = new Set(["use", "refresh", "off"]);
const progressModes = new Set(["auto", "none", "plain", "json"]);
const progressStates = new Set(["started", "completed", "blocked", "failed", "cancelled", "info"]);
const targetPattern = /^[a-z0-9][a-z0-9._-]*$/;

export const cliExitCodes = Object.freeze({
  ok: 0,
  failed: 1,
  blocked: 2,
  needsInput: 2,
  usage: 64,
  cancelled: 130,
});

export const exitCodeForStatus = status => ({
  ok: cliExitCodes.ok,
  failed: cliExitCodes.failed,
  blocked: cliExitCodes.blocked,
  "needs-input": cliExitCodes.needsInput,
  cancelled: cliExitCodes.cancelled,
})[status];

export class CliContractError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "CliContractError";
    this.code = code;
    this.details = details;
  }
}

export class CliCancellationError extends Error {
  constructor(message = "Lean Bridge command cancelled") {
    super(message);
    this.name = "CliCancellationError";
    this.code = "cli-cancelled";
  }
}

const fail = (code, message, details = {}) => {
  throw new CliContractError(code, message, details);
};

const exactKeys = (value, keys, label, code = "invalid-cli-result") => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(code, `${label} must be an object`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(code, `${label} fields must be closed`, { actual, expected });
  }
};

const commonCommands = commands;
const buildCommands = new Set(["build", "publish"]);
const optionDefinitions = Object.freeze({
  "--project": Object.freeze({ name: "project", value: true, commands: commonCommands }),
  "--config": Object.freeze({ name: "config", value: true, commands: commonCommands }),
  "--format": Object.freeze({ name: "format", value: true, commands: commonCommands }),
  "--json": Object.freeze({ name: "json", value: false, commands: commonCommands }),
  "--interactive": Object.freeze({ name: "interactive", value: false, commands: commonCommands }),
  "--target": Object.freeze({ name: "targets", value: true, repeatable: true, commands: commonCommands }),
  "--progress": Object.freeze({ name: "progress", value: true, commands: commonCommands }),
  "--help": Object.freeze({ name: "help", value: false, commands: commonCommands }),
  "--cache": Object.freeze({ name: "cachePolicy", value: true, commands: buildCommands }),
  "--no-cache": Object.freeze({ name: "noCache", value: false, commands: buildCommands }),
  "--cache-directory": Object.freeze({ name: "cacheDirectory", value: true, commands: buildCommands }),
  "--output": Object.freeze({ name: "output", value: true, commands: buildCommands }),
  "--bundle": Object.freeze({ name: "bundle", value: true, commands: new Set(["publish"]) }),
  "--authorization": Object.freeze({ name: "authorization", value: true, commands: new Set(["publish"]) }),
  "--dry-run": Object.freeze({ name: "dryRun", value: false, commands: new Set(["publish"]) }),
});

export const cliUsage = `Usage: lean-bridge <command> [options]

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

Build and publish options:
  --cache use|refresh|off  Select cache policy
  --no-cache            Alias for --cache off
  --cache-directory <path> Select an explicit cache directory
  --output <path>       Local build, gate, or publication output

Publish options:
  --bundle <path>       Authorized candidate for a future external publish
  --authorization <path> Reproducibility gate directory for that candidate
  --dry-run             Build twice, compare, and authorize without registry writes

Exit codes:
  0                     Command succeeded
  1                     Command executed and failed
  2                     Command is blocked or requires input
  64                    Command syntax or configuration is invalid
  130                   Command was cancelled
`;

const validateStringArray = (value, label, { code = "invalid-cli-config", minimum = 0, unique = false } = {}) => {
  if (!Array.isArray(value) || value.some(item => typeof item !== "string" || item === "")) {
    fail(code, `${label} must be an array of non-empty strings`);
  }
  if (value.length < minimum) fail(code, `${label} must contain at least ${minimum} item`);
  if (unique && new Set(value).size !== value.length) fail(code, `${label} must not contain duplicates`);
};

export const validateCliConfig = config => {
  if (config === null || typeof config !== "object" || Array.isArray(config)) fail("invalid-cli-config", "CLI configuration must be an object");
  const allowed = new Set(["schemaVersion", "project", "targets", "cache", "format", "progress"]);
  const unknown = Object.keys(config).filter(key => !allowed.has(key));
  if (unknown.length > 0) fail("invalid-cli-config", "CLI configuration fields must be closed", { unknown });
  if (config.schemaVersion !== 1) fail("invalid-cli-config", "CLI configuration version must be 1");
  if (config.project !== undefined && (typeof config.project !== "string" || config.project === "")) fail("invalid-cli-config", "configured project must be a non-empty path");
  if (config.targets !== undefined) {
    validateStringArray(config.targets, "configured targets", { unique: true });
    config.targets.forEach(target => {
      if (!targetPattern.test(target)) fail("invalid-cli-config", `invalid configured target ${target}`);
    });
  }
  if (config.format !== undefined && !formats.has(config.format)) fail("invalid-cli-config", `unsupported configured format ${config.format}`);
  if (config.progress !== undefined && !progressModes.has(config.progress)) fail("invalid-cli-config", `unsupported configured progress mode ${config.progress}`);
  if (config.cache !== undefined) {
    exactKeys(config.cache, ["policy", "directory"], "configured cache", "invalid-cli-config");
    if (!cachePolicies.has(config.cache.policy)) fail("invalid-cli-config", `unsupported configured cache policy ${config.cache.policy}`);
    if (config.cache.directory !== null && (typeof config.cache.directory !== "string" || config.cache.directory === "")) {
      fail("invalid-cli-config", "configured cache directory must be a non-empty path or null");
    }
    if (config.cache.policy === "off" && config.cache.directory !== null) {
      fail("invalid-cli-config", "configured cache directory must be null when caching is off");
    }
  }
  return true;
};

const environmentValue = (environment, name) => {
  const value = environment?.[name];
  return typeof value === "string" && value !== "" ? value : null;
};

const targetList = (values, label) => {
  const targets = [...new Set(values.map(value => value.trim()).filter(Boolean))].sort();
  for (const target of targets) if (!targetPattern.test(target)) fail("invalid-target", `${label} contains invalid target ${target}`);
  return targets;
};

const readConfiguration = ({ cwd, path, explicit }) => {
  if (path === null) return { path: null, directory: cwd, config: {} };
  if (!existsSync(path)) {
    if (explicit) fail("cli-config-not-found", `CLI configuration does not exist: ${path}`);
    return { path: null, directory: cwd, config: {} };
  }
  let config;
  try {
    config = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail("invalid-cli-config-json", `CLI configuration is not valid JSON: ${path}`, { cause: error.message });
  }
  validateCliConfig(config);
  return { path, directory: dirname(path), config };
};

const sourceOf = (cliValue, environmentValue, configValue) =>
  cliValue !== null && cliValue !== undefined ? "cli" :
    environmentValue !== null && environmentValue !== undefined ? "environment" :
      configValue !== null && configValue !== undefined ? "config" : "default";

export const parseCliArguments = (argv, {
  cwd = process.cwd(),
  environment = process.env,
  stderrIsTTY = process.stderr?.isTTY === true,
} = {}) => {
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
    project: null,
    config: null,
    format: null,
    progress: null,
    interactive: false,
    help: false,
    targets: [],
    cachePolicy: null,
    noCache: false,
    cacheDirectory: null,
    output: null,
    bundle: null,
    authorization: null,
    dryRun: false,
  };
  const seen = new Set();
  for (let index = 1; index < argv.length; index += 1) {
    const flag = argv[index];
    const definition = optionDefinitions[flag];
    if (!definition || !definition.commands.has(command)) fail("unknown-option", `${command} does not support ${flag}`);
    if (!definition.repeatable && seen.has(definition.name)) fail("duplicate-option", `${flag} may be specified once`);
    seen.add(definition.name);
    if (definition.value) {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("--")) fail("missing-option-value", `${flag} requires a value`);
      if (definition.repeatable) parsed[definition.name].push(value);
      else parsed[definition.name] = value;
      index += 1;
    } else {
      parsed[definition.name] = true;
    }
  }
  if (seen.has("json") && seen.has("format")) fail("duplicate-option", "choose either --json or --format");
  if (seen.has("noCache") && seen.has("cachePolicy")) fail("duplicate-option", "choose either --no-cache or --cache");
  if (parsed.json) parsed.format = "json";

  const configuredPathValue = parsed.config ?? environmentValue(environment, "LEAN_BRIDGE_CONFIG");
  const implicitPath = join(resolve(cwd), "lean-bridge.cli.json");
  const configPath = configuredPathValue === null ? implicitPath : resolve(cwd, configuredPathValue);
  const configuration = readConfiguration({ cwd: resolve(cwd), path: configPath, explicit: configuredPathValue !== null });
  const config = configuration.config;

  const environmentProject = environmentValue(environment, "LEAN_BRIDGE_PROJECT");
  const projectValue = parsed.project ?? environmentProject ?? config.project ?? ".";
  const projectBase = parsed.project !== null || environmentProject !== null ? resolve(cwd) : configuration.directory;
  const environmentFormat = environmentValue(environment, "LEAN_BRIDGE_FORMAT");
  const format = parsed.format ?? environmentFormat ?? config.format ?? "human";
  if (!formats.has(format)) fail("invalid-output-format", `unsupported output format ${format}`);

  const environmentTargets = environmentValue(environment, "LEAN_BRIDGE_TARGETS");
  const targets = parsed.targets.length > 0
    ? targetList(parsed.targets, "--target")
    : environmentTargets !== null
      ? targetList(environmentTargets.split(","), "LEAN_BRIDGE_TARGETS")
      : targetList(config.targets ?? [], "configured targets");

  const environmentCachePolicy = environmentValue(environment, "LEAN_BRIDGE_CACHE");
  const cliCachePolicy = parsed.noCache ? "off" : parsed.cachePolicy;
  const cachePolicy = cliCachePolicy ?? environmentCachePolicy ?? config.cache?.policy ?? "use";
  if (!cachePolicies.has(cachePolicy)) fail("invalid-cache-policy", `unsupported cache policy ${cachePolicy}`);
  const environmentCacheDirectory = environmentValue(environment, "LEAN_BRIDGE_CACHE_DIRECTORY");
  let cacheDirectoryValue = parsed.cacheDirectory ?? environmentCacheDirectory ?? config.cache?.directory ?? null;
  const cacheDirectoryBase = parsed.cacheDirectory !== null || environmentCacheDirectory !== null ? resolve(cwd) : configuration.directory;
  if (cachePolicy === "off") {
    if (cliCachePolicy === "off") {
      if (parsed.cacheDirectory !== null) fail("contradictory-cache-options", "cache directory cannot be used when caching is off");
      cacheDirectoryValue = null;
    } else if (environmentCachePolicy === "off") {
      if (environmentCacheDirectory !== null) fail("contradictory-cache-options", "LEAN_BRIDGE_CACHE_DIRECTORY cannot be used when LEAN_BRIDGE_CACHE is off");
      cacheDirectoryValue = null;
    }
  }

  const environmentProgress = environmentValue(environment, "LEAN_BRIDGE_PROGRESS");
  const requestedProgress = parsed.progress ?? environmentProgress ?? config.progress ?? "auto";
  if (!progressModes.has(requestedProgress)) fail("invalid-progress-mode", `unsupported progress mode ${requestedProgress}`);
  const progress = requestedProgress === "auto" ? (format === "human" && stderrIsTTY ? "plain" : "none") : requestedProgress;

  if (parsed.help) return Object.freeze({ kind: "help", command, format });
  const sources = Object.freeze({
    project: sourceOf(parsed.project, environmentProject, config.project),
    format: sourceOf(parsed.format, environmentFormat, config.format),
    targets: sourceOf(parsed.targets.length > 0 ? parsed.targets : null, environmentTargets, config.targets),
    cachePolicy: sourceOf(cliCachePolicy, environmentCachePolicy, config.cache?.policy),
    cacheDirectory: cachePolicy === "off"
      ? sourceOf(cliCachePolicy, environmentCachePolicy, config.cache?.policy)
      : parsed.cacheDirectory !== null ? "cli"
        : environmentCacheDirectory !== null ? "environment"
          : config.cache !== undefined ? "config" : "default",
    progress: sourceOf(parsed.progress, environmentProgress, config.progress),
  });
  return Object.freeze({
    kind: "command",
    command,
    mode: command === "publish" && parsed.dryRun ? "dry-run" : "execute",
    project: resolve(projectBase, projectValue),
    output: parsed.output === null ? null : resolve(cwd, parsed.output),
    bundle: parsed.bundle === null ? null : resolve(cwd, parsed.bundle),
    authorization: parsed.authorization === null ? null : resolve(cwd, parsed.authorization),
    format,
    interactive: parsed.interactive,
    configuration: Object.freeze({ path: configuration.path, sources }),
    selection: Object.freeze({ allTargets: targets.length === 0, targets: Object.freeze(targets) }),
    cache: Object.freeze({
      policy: cachePolicy,
      directory: cacheDirectoryValue === null ? null : resolve(cacheDirectoryBase, cacheDirectoryValue),
    }),
    progress,
  });
};

const validateDiagnostic = value => {
  exactKeys(value, ["code", "severity", "message", "path", "hint"], "diagnostic");
  if (typeof value.code !== "string" || value.code === "") fail("invalid-cli-result", "diagnostic code is required");
  if (!severities.has(value.severity)) fail("invalid-cli-result", `invalid diagnostic severity ${value.severity}`);
  if (typeof value.message !== "string" || value.message === "") fail("invalid-cli-result", "diagnostic message is required");
  for (const field of ["path", "hint"]) {
    if (value[field] !== null && typeof value[field] !== "string") fail("invalid-cli-result", `diagnostic ${field} must be a string or null`);
  }
};

const validatePrompt = value => {
  exactKeys(value, ["id", "message", "choices", "required", "declaration"], "prompt");
  if (typeof value.id !== "string" || value.id === "" || typeof value.message !== "string" || value.message === "") {
    fail("invalid-cli-result", "prompt id and message are required");
  }
  validateStringArray(value.choices, "prompt choices", { code: "invalid-cli-result", minimum: 1, unique: true });
  if (typeof value.required !== "boolean") fail("invalid-cli-result", "prompt required flag must be boolean");
  if (value.declaration !== null && typeof value.declaration !== "string") fail("invalid-cli-result", "prompt declaration must be a string or null");
};

const validateProgressEvent = value => {
  exactKeys(value, ["schemaVersion", "type", "sequence", "command", "phase", "state", "message", "current", "total"], "progress event");
  if (value.schemaVersion !== 1 || value.type !== "progress") fail("invalid-cli-result", "progress event version or type is unsupported");
  if (!Number.isSafeInteger(value.sequence) || value.sequence < 1) fail("invalid-cli-result", "progress sequence must be a positive integer");
  if (!commands.has(value.command) || typeof value.phase !== "string" || value.phase === "") fail("invalid-cli-result", "progress command and phase are required");
  if (!progressStates.has(value.state) || typeof value.message !== "string" || value.message === "") fail("invalid-cli-result", "progress state and message are invalid");
  for (const field of ["current", "total"]) {
    if (value[field] !== null && (!Number.isSafeInteger(value[field]) || value[field] < 0)) fail("invalid-cli-result", `progress ${field} must be a non-negative integer or null`);
  }
  if (value.current !== null && value.total !== null && value.current > value.total) fail("invalid-cli-result", "progress current cannot exceed total");
};

export const validateCliResult = result => {
  exactKeys(result, [
    "schemaVersion", "command", "mode", "status", "exitCode", "project", "interactive",
    "configuration", "selection", "cache", "progress", "result", "diagnostics", "prompts", "nextActions",
  ], "CLI result");
  if (result.schemaVersion !== 2) fail("unsupported-cli-result", "CLI result version is not supported");
  if (result.command !== null && !commands.has(result.command)) fail("invalid-cli-result", `unknown result command ${result.command}`);
  if (result.mode !== null && !new Set(["execute", "dry-run"]).has(result.mode)) fail("invalid-cli-result", `unknown result mode ${result.mode}`);
  if (result.command === null !== (result.mode === null)) fail("invalid-cli-result", "result command and mode must both be present or null");
  if (result.mode === "dry-run" && result.command !== "publish") fail("invalid-cli-result", "dry-run mode belongs to publish");
  if (!statuses.has(result.status)) fail("invalid-cli-result", `unknown result status ${result.status}`);
  const expectedExit = result.command === null ? cliExitCodes.usage : exitCodeForStatus(result.status);
  if (result.exitCode !== expectedExit) fail("invalid-cli-result", `exit code ${result.exitCode} contradicts status ${result.status}`);
  if (typeof result.project !== "string" || result.project === "") fail("invalid-cli-result", "result project must be a path");
  if (typeof result.interactive !== "boolean") fail("invalid-cli-result", "result interactive flag must be boolean");
  exactKeys(result.configuration, ["path", "sources"], "configuration");
  if (result.configuration.path !== null && typeof result.configuration.path !== "string") fail("invalid-cli-result", "configuration path must be a string or null");
  exactKeys(result.configuration.sources, ["project", "format", "targets", "cachePolicy", "cacheDirectory", "progress"], "configuration sources");
  for (const value of Object.values(result.configuration.sources)) {
    if (!new Set(["cli", "environment", "config", "default"]).has(value)) fail("invalid-cli-result", `invalid configuration source ${value}`);
  }
  exactKeys(result.selection, ["allTargets", "targets"], "target selection");
  if (typeof result.selection.allTargets !== "boolean") fail("invalid-cli-result", "allTargets must be boolean");
  validateStringArray(result.selection.targets, "selected targets", { code: "invalid-cli-result", unique: true });
  result.selection.targets.forEach(target => {
    if (!targetPattern.test(target)) fail("invalid-cli-result", `invalid selected target ${target}`);
  });
  if (result.selection.allTargets !== (result.selection.targets.length === 0)) fail("invalid-cli-result", "target selection is contradictory");
  exactKeys(result.cache, ["policy", "directory"], "cache selection");
  if (!cachePolicies.has(result.cache.policy)) fail("invalid-cli-result", `invalid cache policy ${result.cache.policy}`);
  if (result.cache.directory !== null && typeof result.cache.directory !== "string") fail("invalid-cli-result", "cache directory must be a string or null");
  exactKeys(result.progress, ["mode", "events"], "progress");
  if (!new Set(["none", "plain", "json"]).has(result.progress.mode)) fail("invalid-cli-result", `invalid resolved progress mode ${result.progress.mode}`);
  if (!Array.isArray(result.progress.events)) fail("invalid-cli-result", "progress events must be an array");
  result.progress.events.forEach((event, index) => {
    validateProgressEvent(event);
    if (event.sequence !== index + 1) fail("invalid-cli-result", "progress events must use contiguous sequence numbers");
    if (result.command !== null && event.command !== result.command) fail("invalid-cli-result", "progress event belongs to another command");
  });
  if (result.result !== null && (typeof result.result !== "object" || Array.isArray(result.result))) {
    fail("invalid-cli-result", "command result must be an object or null");
  }
  if (!Array.isArray(result.diagnostics) || !Array.isArray(result.prompts) || !Array.isArray(result.nextActions)) {
    fail("invalid-cli-result", "diagnostics, prompts, and next actions must be arrays");
  }
  result.diagnostics.forEach(validateDiagnostic);
  result.prompts.forEach(validatePrompt);
  if (result.nextActions.some(action => typeof action !== "string" || action === "")) {
    fail("invalid-cli-result", "next actions must be non-empty strings");
  }
  if (result.status === "ok" && result.diagnostics.some(item => item.severity === "error")) {
    fail("contradictory-cli-result", "successful result contains an error diagnostic");
  }
  if (result.status === "needs-input" && result.prompts.length === 0) {
    fail("contradictory-cli-result", "needs-input result must contain a structured prompt");
  }
  return true;
};

export const diagnostic = ({ code, severity = "error", message, path = null, hint = null }) =>
  Object.freeze({ code, severity, message, path, hint });

export const prompt = ({ id, message, choices, required = true, declaration = null }) =>
  Object.freeze({ id, message, choices: Object.freeze([...choices]), required, declaration });
