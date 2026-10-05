/**
 * Transport owned npm compilation through the canonical Nix or Docker engine.
 *
 * @file
 */
import { cp, mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, sep } from "node:path";
import { canonicalJson } from "../capsule/node.mjs";
import { detectBuildBackend, runDockerComponentEngine, runNativeComponentEngine } from "./canonical-build.mjs";
import { writeEngineExecutionRequest } from "./engine-execution-request.mjs";
import { writeLakeEntryInputs } from "./lake-entry-intent.mjs";
import { readVerifiedOwnedJavaScriptEngineOutput } from "./javascript-wasm-owned-engine.mjs";
import { readVerifiedOwnedJavaScriptWasmComponent } from "./javascript-wasm-owned-artifacts.mjs";
import { CanonicalBuildError } from "./build-error.mjs";

const inside = (parent, child) => { const path = relative(parent, child); return !isAbsolute(path) && path !== ".." && !path.startsWith(`..${sep}`); };

/**
 * Select the requested backend before reading any host Lean or Emscripten inputs.
 * Compilation returns only independently verified component artifacts.
 *
 * @param options - Original source, engine, cache policy and process transport.
 * @param options.project - Original source root, never used as a compiler workspace.
 * @param options.engineRoot - Installed engine source root.
 * @param options.environment - Explicit backend and isolated cache configuration.
 * @param options.runner - Backend process transport.
 * @param options.intent - Independently captured source-only ownership intent.
 * @param options.cache - Existing CLI cache policy.
 * @param options.signal - Optional cancellation signal.
 */
export const prepareIsolatedOwnedJavaScriptCompiler = async ({ project, engineRoot, environment, runner, intent, cache, signal }) => {
	const cancellable = { capture: async request => {
		try
		{ return await runner.capture({ ...request, signal }); }
		catch(error)
		{ signal?.throwIfAborted(); throw error; }
	} };
	const selection = await detectBuildBackend({ environment, runner: cancellable });
	if(selection.backend === "docker" && cache.directory !== null && cache.directory !== undefined)
		throw new CanonicalBuildError("cache-directory-unsupported", "An explicit cache directory requires the native Nix backend");
	const backend = selection.backend === "docker" ? "docker-nix" : "native-nix";
	const compile = async ({ componentRoot }) => {
		const parent = await realpath(selection.backend === "docker" && environment.LEAN_BRIDGE_DOCKER_STAGING_ROOT ? environment.LEAN_BRIDGE_DOCKER_STAGING_ROOT : tmpdir());
		if(inside(project, parent) || inside(engineRoot, parent)) throw new CanonicalBuildError("invalid-output-root", "Owned engine staging must be outside the source and engine trees");
		const working = await mkdtemp(join(parent, ".lean-owned-javascript-isolated-"));
		try
		{
			const inputRoot = join(working, "input"), requestPath = join(working, "request/engine-execution-request.json");
			await writeLakeEntryInputs({ intent, outputRoot: inputRoot, signal });
			const request = await writeEngineExecutionRequest({ output: requestPath
				, engineRoot, inputRoot, entryIntent: intent
				, purpose: "owned-javascript", targets: ["npm"]
				, cachePolicy: cache.policy });
			const outputRoot = join(working, "output/execution");
			await mkdir(dirname(outputRoot));
			const effectiveEnvironment = { ...environment
				, ...(cache.policy === "off" ? { LEAN_BRIDGE_NIX_STORE: join(working, "nix-store") } : cache.directory ? { LEAN_BRIDGE_NIX_STORE: cache.directory } : {})
				, ...(cache.policy === "refresh" ? { LEAN_BRIDGE_NIX_REFRESH: "1" } : {}) };
			const options = { engineRoot, inputRoot, requestPath, outputRoot, selection
				, runner: cancellable, environment: effectiveEnvironment
				, cache: { ...cache, directory: cache.directory ?? null } };
			if(selection.backend === "docker") await runDockerComponentEngine(options);
			else await runNativeComponentEngine(options);
			const checked = await readVerifiedOwnedJavaScriptEngineOutput({ outputRoot, request, intent, inputRoot, engineRoot, backend, signal });
			await mkdir(dirname(componentRoot), { recursive: true });
			await cp(checked.root, componentRoot, { recursive: true, force: false, errorOnExist: true });
			if((await readVerifiedOwnedJavaScriptWasmComponent(componentRoot)).identity !== checked.identity) throw new Error("Owned component changed during output handoff");
			await writeFile(join(dirname(componentRoot), "engine-execution-request.json"), canonicalJson(request.document), { flag: "wx", signal });
			await writeFile(join(dirname(componentRoot), "engine-execution-report.json"), canonicalJson(checked.report), { flag: "wx", signal });
			return checked;
		} finally
		{ await rm(working, { recursive: true, force: true }); }
	};
	return { backend, compile };
};
