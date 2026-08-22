/**
 * Collects complete host-tool capability reports for local and CI execution profiles.
 *
 * @file
 */

import { access, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { delimiter, join } from "node:path";
import { platform, release, arch, cpus, totalmem } from "node:os";

/** @typedef {{ id: string, commands: readonly string[], args: readonly string[], minimumMajor?: number }} ToolDefinition */
/** @typedef {{ required: readonly string[], alternatives: readonly (readonly string[])[] }} ProfileDefinition */
/** @typedef {{ exitCode: number, stdout: string, stderr: string, errorCode: string | null }} ProbeResult */
/** @typedef {{ capture(command: string, args: readonly string[], environment: NodeJS.ProcessEnv): Promise<ProbeResult> }} ProbeRunner */
/** @typedef {{ id: string, available: boolean, compatible: boolean, command: string | null, version: string | null, requirement: string | null, failure: string | null, remediation: string | null }} ToolObservation */
/** @typedef {{ schemaVersion: number, kind: string, profile: string, accepted: boolean, host: { platform: string, release: string, architecture: string, cpuCount: number, memoryBytes: number }, requirements: ProfileDefinition, missing: readonly string[], unsatisfiedAlternatives: readonly (readonly string[])[], tools: readonly ToolObservation[] }} ToolchainPreflightReport */

/** @type {readonly ToolDefinition[]} */
const toolDefinitions = Object.freeze([
	{ id: "lean", commands: ["lean"], args: ["--version"] }
	, { id: "lake", commands: ["lake"], args: ["--version"] }
	, { id: "emcc", commands: ["emcc"], args: ["--version"] }
	, { id: "node", commands: ["node"], args: ["--version"], minimumMajor: 22 }
	, { id: "npm", commands: ["npm"], args: ["--version"] }
	, { id: "nix", commands: ["nix"], args: ["--version"] }
	, { id: "docker", commands: ["docker"], args: ["info", "--format", "{{.ServerVersion}}"] }
	, { id: "clang", commands: ["clang"], args: ["--version"] }
	, { id: "clang++", commands: ["clang++"], args: ["--version"] }
	, { id: "cmake", commands: ["cmake"], args: ["--version"] }
	, { id: "ninja", commands: ["ninja"], args: ["--version"] }
	, { id: "wasm-objdump", commands: ["wasm-objdump"], args: ["--version"] }
	, { id: "wasm-tools", commands: ["wasm-tools"], args: ["--version"] }
	, { id: "cargo", commands: ["cargo"], args: ["--version"] }
	, { id: "php", commands: ["php"], args: ["--version"] }
	, { id: "phpize", commands: ["phpize"], args: ["--version"] }
	, { id: "python", commands: ["python3", "python"], args: ["--version"] }
	, { id: "dotnet", commands: ["dotnet"], args: ["--version"] }
	, { id: "java", commands: ["java"], args: ["-version"] }
	, { id: "ruby", commands: ["ruby"], args: ["--version"] }
	, { id: "chromium", commands: ["chromium", "chromium-browser", "google-chrome"], args: ["--version"] }
]);

/** @type {Readonly<Record<string, ProfileDefinition>>} */
const profiles = Object.freeze({
	core: { required: ["node", "npm"], alternatives: [] }
	, component: { required: ["lean", "lake", "emcc", "node", "npm", "wasm-objdump", "wasm-tools"], alternatives: [["nix", "docker"]] }
	, native: { required: ["lean", "lake", "clang", "clang++", "cmake", "ninja", "node", "npm"], alternatives: [] }
	, php: { required: ["lean", "lake", "clang", "clang++", "cmake", "ninja", "node", "npm", "php", "phpize"], alternatives: [] }
	, managed: { required: ["lean", "lake", "clang", "clang++", "node", "npm", "dotnet", "java", "ruby"], alternatives: [] }
	, browser: { required: ["node", "npm", "chromium"], alternatives: [] }
	, performance: { required: ["lean", "lake", "emcc", "node", "npm", "wasm-objdump", "wasm-tools"], alternatives: [] }
	, reproducibility: { required: ["node", "npm"], alternatives: [["nix", "docker"]] }
	, full: {
		required: toolDefinitions.map(tool => tool.id).filter(id => !new Set(["nix", "docker"]).has(id))
		, alternatives: [["nix", "docker"]]
	}
});

/**
 * Reduces process output to one stable version line.
 *
 * @param {string} value - Process output to reduce to one version line.
 */
const firstLine = value => value.trim().split(/\r?\n/, 1)[0] ?? "";

/**
 * Extracts the first semantic major component from version output.
 *
 * @param {string} value - Version output containing a semantic major component.
 */
const versionMajor = value => {
	const match = /(?:^|\D)(\d+)(?:\.\d+|\D|$)/.exec(value);
	return match === null ? null : Number(match[1]);
};

/**
 * Returns a value-free remediation for an unavailable tool.
 *
 * @param {ToolDefinition} definition - Tool needing an actionable installation hint.
 */
const remediationFor = definition => definition.id === "docker"
	? "Install Docker and ensure its daemon is reachable by the current user."
	: `Install ${definition.id} and make an executable available on PATH.`;

/**
 * Resolves one executable file without accepting executable directories.
 *
 * @param {string} command - Command name to find on PATH.
 * @param {NodeJS.ProcessEnv} environment - Environment containing PATH.
 */
const resolveExecutable = async (command, environment) => {
	for(const directory of String(environment.PATH ?? "").split(delimiter).filter(Boolean))
	{
		const path = join(directory, command);
		try
		{
			if(!(await stat(path)).isFile()) continue;
			await access(path, constants.X_OK);
			return path;
		} catch(error)
		{
			const code = error !== null && typeof error === "object" && "code" in error ? error.code : null;
			if(typeof code !== "string" || !new Set(["EACCES", "ENOENT", "ENOTDIR"]).has(code)) throw error;
		}
	}
	return null;
};

/** @type {ProbeRunner} */
const defaultRunner = Object.freeze({
	/**
	 * Captures one executable probe without invoking a shell.
	 *
	 * @param {string} command - Executable path selected from PATH.
	 * @param {readonly string[]} args - Version or daemon probe arguments.
	 * @param {NodeJS.ProcessEnv} environment - Explicit process environment.
	 */
	async capture(command, args, environment) {
		const { execFile } = await import("node:child_process");
		return await new Promise(resolve => {
			execFile(command, args, { env: environment, timeout: 15_000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
				resolve({
					exitCode: error === null ? 0 : typeof error.code === "number" ? error.code : 1
					, stdout
					, stderr
					, errorCode: typeof error?.code === "string" ? error.code : null
				});
			});
		});
	}
});

/**
 * Probes one tool definition and returns a closed capability observation.
 *
 * @param {ToolDefinition} definition - Tool command and version probe.
 * @param {{ environment: NodeJS.ProcessEnv, runner: ProbeRunner, resolveCommand: (command: string, environment: NodeJS.ProcessEnv) => Promise<string | null> }} options - Probe dependencies.
 * @returns {Promise<ToolObservation>} Closed tool observation.
 */
const probeTool = async (definition, { environment, runner, resolveCommand }) => {
	let command = null;
	for(const candidate of definition.commands)
	{
		command = await resolveCommand(candidate, environment);
		if(command !== null) break;
	}
	if(command === null)
	{
		return Object.freeze({
			id: definition.id
			, available: false, compatible: false, command: null, version: null
			, requirement: definition.minimumMajor === undefined ? null : `major >= ${definition.minimumMajor}`
			, failure: "command-not-found", remediation: remediationFor(definition)
		});
	}
	const result = await runner.capture(command, definition.args, environment);
	const output = firstLine(result.stdout || result.stderr);
	if(result.exitCode !== 0)
	{
		return Object.freeze({
			id: definition.id
			, available: true, compatible: false, command, version: output || null
			, requirement: definition.minimumMajor === undefined ? null : `major >= ${definition.minimumMajor}`
			, failure: definition.id === "docker" ? "daemon-unavailable" : result.errorCode ?? `exit-${result.exitCode}`
			, remediation: remediationFor(definition)
		});
	}
	const major = versionMajor(output);
	const compatible = definition.minimumMajor === undefined || major !== null && major >= definition.minimumMajor;
	return Object.freeze({
		id: definition.id
		, available: true
		, compatible
		, command
		, version: output || "available"
		, requirement: definition.minimumMajor === undefined ? null : `major >= ${definition.minimumMajor}`
		, failure: compatible ? null : "incompatible-version"
		, remediation: compatible ? null : `Install ${definition.id} major ${definition.minimumMajor} or newer.`
	});
};

/**
 * Returns the closed set of supported preflight profile names.
 */
export const toolchainPreflightProfiles = Object.freeze(Object.keys(profiles));

/**
 * Probes every known tool and evaluates one named capability profile after all probes finish.
 *
 * @param {object} root0 - Preflight controls and dependency overrides.
 * @param {string} [root0.profile] - Named capability profile to evaluate.
 * @param {NodeJS.ProcessEnv} [root0.environment] - Environment used for PATH lookup and subprocess execution.
 * @param {ProbeRunner} [root0.runner] - Injectable command runner used by deterministic tests.
 * @param {(command: string, environment: NodeJS.ProcessEnv) => Promise<string | null>} [root0.resolveCommand] - Injectable executable resolver used by deterministic tests.
 * @returns {Promise<ToolchainPreflightReport>} Complete machine-readable capability report.
 */
export const collectToolchainPreflight = async ({
	profile = "full"
	, environment = process.env
	, runner = defaultRunner
	, resolveCommand = resolveExecutable
} = {}) => {
	if(!Object.hasOwn(profiles, profile)) throw new Error(`Unknown toolchain preflight profile ${profile}`);
	const tools = await Promise.all(toolDefinitions.map(definition => probeTool(definition, { environment, runner, resolveCommand })));
	const byId = new Map(tools.map(tool => [tool.id, tool]));
	const selected = profiles[profile];
	const missing = selected.required.filter(id => !byId.get(id)?.compatible);
	const unsatisfiedAlternatives = selected.alternatives.filter(group => !group.some(id => byId.get(id)?.compatible));
	return Object.freeze({
		schemaVersion: 1
		, kind: "lean-bridge-toolchain-preflight"
		, profile
		, accepted: missing.length === 0 && unsatisfiedAlternatives.length === 0
		, host: Object.freeze({ platform: platform(), release: release(), architecture: arch(), cpuCount: cpus().length, memoryBytes: totalmem() })
		, requirements: Object.freeze({ required: Object.freeze([...selected.required]), alternatives: Object.freeze(selected.alternatives.map(group => Object.freeze([...group]))) })
		, missing: Object.freeze(missing)
		, unsatisfiedAlternatives: Object.freeze(unsatisfiedAlternatives.map(group => Object.freeze([...group])))
		, tools: Object.freeze(tools)
	});
};

/**
 * Renders a complete preflight report without hiding optional or failed probes.
 *
 * @param {ToolchainPreflightReport} report - Report returned by collectToolchainPreflight.
 */
export const renderToolchainPreflight = report => {
	const lines = [
		`profile=${report.profile}`
		, `accepted=${report.accepted}`
		, `os=${report.host.platform} ${report.host.release} ${report.host.architecture}`
		, `cpu_count=${report.host.cpuCount}`
		, `memory_bytes=${report.host.memoryBytes}`
	];
	for(const tool of report.tools)
	{
		lines.push(`${tool.id}=${tool.compatible ? tool.version : `unavailable (${tool.failure}; ${tool.remediation})`}`);
	}
	if(report.missing.length > 0) lines.push(`missing=${report.missing.join(",")}`);
	for(const group of report.unsatisfiedAlternatives) lines.push(`missing_one_of=${group.join("|")}`);
	return `${lines.join("\n")}\n`;
};
