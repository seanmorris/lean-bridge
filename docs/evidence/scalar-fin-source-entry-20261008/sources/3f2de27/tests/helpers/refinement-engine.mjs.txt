/**
 * Run refinement acceptance through the selected locked engine or the local engine.
 *
 * @file
 */
import { resolve } from "node:path";
import { executeComponentEngineRequest } from "../../src/build/component-engine.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";

/**
 * Replace command transport without bypassing a configured compiler environment.
 *
 * @param options - Engine selection and injectable runners for transport controls.
 * @param options.externalEngine - Locked engine executable; null selects the local engine.
 * @param options.runner - Runner for the external engine process.
 * @param options.execute - Local engine entry point.
 */
export const refinementEngineTransport = ({ externalEngine = process.env.LEAN_BRIDGE_LAKE_ENGINE
	, runner = processBuildRunner
	, execute = executeComponentEngineRequest } = {}) => ({ capture: async command => {
	if(command.command === "docker") throw new Error("Docker is absent in the injected transport");
	if(command.args[0] === "--version") return { stdout: "nix (Nix) 2.24.11", stderr: "", code: 0 };
	const arg = flag => command.args[command.args.indexOf(flag) + 1];
	const requestPath = arg("--request"), inputRoot = arg("--component"), outputRoot = arg("--output");
	if(externalEngine)
		await runner.capture({ command: resolve(externalEngine)
			, args: ["--request", requestPath, "--component", inputRoot, "--output", outputRoot, "--backend", "native-nix"]
			, timeoutMs: 180000 });
	else
		await execute({ requestPath, inputRoot, outputRoot, engineRoot: arg("--engine"), backend: "native-nix" });
	return { stdout: "", stderr: "", code: 0 };
	} });
