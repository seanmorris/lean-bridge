import { resolve } from "node:path";

import { canonicalJson } from "../capsule/node.mjs";
import {
	CliCancellationError,
	CliContractError,
	cliExitCodes,
	cliUsage,
	diagnostic,
	exitCodeForStatus,
	parseCliArguments,
	validateCliResult,
} from "./contract.mjs";

const configurationSources = Object.freeze({
	project: "default"
	, format: "default"
	, targets: "default"
	, cachePolicy: "default"
	, cacheDirectory: "default"
	, progress: "default"
});

const humanResult = response => {
	const targets = response.selection.allTargets ? "all applicable targets" : response.selection.targets.join(", ");
	const lines = [
		`Lean Bridge ${response.command}: ${response.status}`
		, `project: ${response.project}`
		, `targets: ${targets}`
		, `cache: ${response.cache.policy}${response.cache.directory === null ? "" : ` at ${response.cache.directory}`}`
	];
	for(const item of response.diagnostics)
	{
		lines.push(`${item.severity}: ${item.code}: ${item.message}`);
		if(item.path !== null) lines.push(`  path: ${item.path}`);
		if(item.hint !== null) lines.push(`  hint: ${item.hint}`);
	}
	for(const item of response.prompts)
	{
		lines.push(`input: ${item.id}: ${item.message}`);
		lines.push(`  choices: ${item.choices.join(", ")}`);
	}
	for(const action of response.nextActions) lines.push(`next: ${action}`);
	return `${lines.join("\n")}\n`;
};

/**
 * Formats progress event as stable output that the machine-readable CLI contract can consume without heuristics.
 *
 * @param event - Lifecycle event being observed or applied.
 * @param mode - Closed mode that selects the operation policy.
 */
export const renderProgressEvent = (event, mode) => {
	if(mode === "none") return "";
	if(mode === "json") return `${JSON.stringify(event)}\n`;
	return `[${event.sequence}] ${event.command}/${event.phase} ${event.state}: ${event.message}\n`;
};

const normalizeHandlerResult = (request, outcome, events) => {
	const response = {
		schemaVersion: 2
		, command: request.command
		, mode: request.mode
		, status: outcome.status
		, exitCode: exitCodeForStatus(outcome.status)
		, project: request.project
		, interactive: request.interactive
		, configuration: request.configuration
		, selection: request.selection
		, cache: request.cache
		, progress: { mode: request.progress, events }
		, result: outcome.result ?? null
		, diagnostics: outcome.diagnostics ?? []
		, prompts: outcome.prompts ?? []
		, nextActions: outcome.nextActions ?? []
	};
	validateCliResult(response);
	return response;
};

const jsonRequested = (argv, environment) => {
	if(environment?.LEAN_BRIDGE_FORMAT === "json") return true;
	if(argv.includes("--json")) return true;
	return argv.some((value, index) => value === "--format" && argv[index + 1] === "json");
};

const usageErrorResponse = ({ error, cwd }) => {
	const response = {
		schemaVersion: 2
		, command: null
		, mode: null
		, status: "failed"
		, exitCode: cliExitCodes.usage
		, project: resolve(cwd)
		, interactive: false
		, configuration: { path: null, sources: configurationSources }
		, selection: { allTargets: true, targets: [] }
		, cache: { policy: "use", directory: null }
		, progress: { mode: "none", events: [] }
		, result: null
		, diagnostics: [diagnostic({ code: error.code, message: error.message })]
		, prompts: []
		, nextActions: ["Run lean-bridge --help to inspect the supported command contract."]
	};
	validateCliResult(response);
	return response;
};

const cancelledOutcome = error => ({
	status: "cancelled"
	, result: null
	, diagnostics: [diagnostic({
		code: "cli-cancelled"
		, severity: "warning"
		, message: error?.message ?? "Lean Bridge command cancelled"
		, hint: "Run the same command again when you are ready."
	})]
	, prompts: []
	, nextActions: []
});

/**
 * Runs CLI and returns a structured result suitable for the machine-readable CLI contract.
 *
 * @param root0 - Named inputs and dependency overrides used to run CLI.
 * @param root0.argv - Command-line tokens to parse, excluding the runtime executable and script path.
 * @param root0.handlers - Validated command handlers dispatched by the CLI runner.
 * @param root0.cwd - Working directory used to resolve project-relative CLI paths.
 * @param root0.environment - Environment variables used to resolve tools and policy.
 * @param root0.stderrIsTTY - Whether standard error is interactive, used to choose the default progress mode.
 * @param root0.version - CLI implementation version included in machine-readable command results.
 * @param root0.signal - Abort signal used to cancel the operation.
 * @param root0.onProgress - Observer invoked when progress occurs.
 */
export const runCli = async ({
	argv
	, handlers
	, cwd = process.cwd()
	, environment = process.env
	, stderrIsTTY = process.stderr?.isTTY === true
	, version = "0.0.0-poc"
	, signal = undefined
	, onProgress = undefined
}) => {
	let request;
	try
	{
		request = parseCliArguments(argv, { cwd, environment, stderrIsTTY });
	} catch(error)
	{
		if(!(error instanceof CliContractError)) throw error;
		if(jsonRequested(argv, environment))
		{
			const response = usageErrorResponse({ error, cwd });
			return Object.freeze({
				exitCode: cliExitCodes.usage
				, stdout: canonicalJson(response)
				, stderr: ""
				, response
			});
		}
		return Object.freeze({
			exitCode: cliExitCodes.usage
			, stdout: ""
			, stderr: `error: ${error.code}: ${error.message}\n\n${cliUsage}`
			, response: null
		});
	}
	if(request.kind === "help") return Object.freeze({ exitCode: 0, stdout: cliUsage, stderr: "", response: null });
	if(request.kind === "version") return Object.freeze({ exitCode: 0, stdout: `${version}\n`, stderr: "", response: null });

	const events = [];
	const emitProgress = value => {
		const event = Object.freeze({
			schemaVersion: 1
			, type: "progress"
			, sequence: events.length + 1
			, command: request.command
			, phase: value.phase
			, state: value.state
			, message: value.message
			, current: value.current ?? null
			, total: value.total ?? null
		});
		events.push(event);
		if(typeof onProgress === "function" && request.progress !== "none") onProgress(event, request.progress);
		return event;
	};

	emitProgress({ phase: "command", state: "started", message: `${request.command} started` });
	let outcome;
	try
	{
		if(signal?.aborted) throw new CliCancellationError(signal.reason?.message);
		const handler = handlers?.[request.command];
		if(typeof handler !== "function")
		{
			outcome = {
				status: "blocked"
				, diagnostics: [diagnostic({
					code: "command-unavailable"
					, message: `${request.command} is not available in this build`
				})]
				, prompts: []
				, nextActions: ["Install a CLI build that provides this command."]
			};
		} else
		{
			outcome = await handler(request, Object.freeze({ signal, emitProgress }));
			if(signal?.aborted) throw new CliCancellationError(signal.reason?.message);
		}
	} catch(error)
	{
		if(signal?.aborted || error instanceof CliCancellationError || error?.code === "cli-cancelled" || error?.name === "AbortError")
		{
			outcome = cancelledOutcome(error);
		} else
		{
			outcome = {
				status: "failed"
				, diagnostics: [diagnostic({
					code: error.code ?? "unexpected-cli-failure"
					, message: error.message ?? String(error)
				})]
				, prompts: []
				, nextActions: []
			};
		}
	}
	const finalState = ({
		ok: "completed"
		, blocked: "blocked"
		, "needs-input": "blocked"
		, failed: "failed"
		, cancelled: "cancelled"
	})[outcome.status] ?? "failed";
	emitProgress({ phase: "command", state: finalState, message: `${request.command} ${outcome.status}` });
	const response = normalizeHandlerResult(request, outcome, Object.freeze(events));
	const rendered = request.format === "json" ? canonicalJson(response) : humanResult(response);
	const failed = response.status !== "ok";
	return Object.freeze({
		exitCode: response.exitCode
		, stdout: failed && request.format === "human" ? "" : rendered
		, stderr: failed && request.format === "human" ? rendered : ""
		, response
	});
};
