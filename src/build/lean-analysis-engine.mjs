/**
 * Run compiler-only project analysis inside the same pinned source-isolated engine.
 *
 * @file
 */
import { mkdir, mkdtemp, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, sep } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { inspectLeanProject } from "../analyze/lean-project.mjs";
import { compilerProjectAnalysis } from "../analyze/project-analysis.mjs";
import { createEngineExecutionRequest, identifyBuildEngine, identifyComponentInputClosure } from "./engine-execution-request.mjs";
import { readLakeEntryIntent } from "./lake-entry-intent.mjs";
import { resolveLakeBuildWorkspace } from "./lake-build-workspace.mjs";
import { elaborateLakeEntryModules } from "./lake-entry-elaboration.mjs";
import { processBuildRunner } from "./process-runner.mjs";

/**
 * Compile fresh interfaces and return diagnostics without making adapters or binaries.
 *
 * @param options - Validated request, closed source mount and private output.
 * @param options.verifiedRequest - Independently checked engine request.
 * @param options.inputs - Source-only input mount.
 * @param options.output - New output destination.
 * @param options.engine - Installed engine source root.
 * @param options.backend - Selected backend identifier.
 * @param options.runner - Optional compiler process runner.
 * @param options.environment - Pinned compiler environment.
 * @param options.signal - Optional cancellation signal.
 */
export const executeLeanAnalysisEngine = async ({ verifiedRequest, inputs, output, engine, backend, runner = processBuildRunner, environment, signal }) => {
	const within = (parent, child) => { const path = relative(parent, child); return !isAbsolute(path) && path !== ".." && !path.startsWith(`..${sep}`); };
	if(within(inputs, output) || within(engine, output)) throw new Error("Compiler analysis output must be outside its source and engine mounts");
	const requested = verifiedRequest.document;
	const intent = await readLakeEntryIntent({ inputRoot: inputs, expectedSha256: requested.component.sourceIntentSha256, purpose: "analysis", signal });
	const reconstructed = await createEngineExecutionRequest({ engineRoot: engine
		, inputRoot: inputs, entryIntent: intent
		, purpose: "analysis"
		, targets: requested.targets, cachePolicy: requested.cache.policy });
	if(canonicalJson(reconstructed.document) !== canonicalJson(requested)) throw new Error("Compiler analysis intent differs from the request");
	if(await realpath(dirname(output)) !== dirname(output)) throw new Error("Compiler analysis output parent must not contain symlinks");
	const working = await mkdtemp(join(dirname(output), ".lean-bridge-analysis-engine-"));
	let workspace;
	try
	{
		const projectRoot = join(inputs, "lake/root"), inventory = await inspectLeanProject(projectRoot, { signal });
		const graph = JSON.parse(await readFile(join(engine, "poc/lean-link-spike/graph-lock.json"), "utf8"));
		const lean = environment.LEAN_BRIDGE_LEAN ?? (environment.LEAN_WASM_HOST_LEAN_PREFIX ? join(environment.LEAN_WASM_HOST_LEAN_PREFIX, "bin/lean") : join(engine, ".toolchains/elan/bin/lean"));
		const prefix = await runner.capture({ command: lean
			, args: ["--print-prefix"], cwd: projectRoot
			, env: { ...environment, ELAN_HOME: environment.ELAN_HOME ?? join(engine, ".toolchains/elan") }
			, signal, timeoutMs: 15000 });
		const leanPrefix = prefix.stdout.trim();
		workspace = await resolveLakeBuildWorkspace({ snapshot: intent.lakeSnapshot, modules: intent.document.modules.map(item => item.module), leanPrefix, signal });
		if(workspace.resolution.leanCommit !== graph.runtime.leanCommit) throw new Error("Analysis compiler differs from the pinned engine toolchain");
		const extracted = await elaborateLakeEntryModules({ inventory, entries: intent.document.modules, workspace, leanPrefix, engineRoot: engine, runner, signal });
		const analysis = compilerProjectAnalysis(inventory, intent.document.modules, extracted.elaboration);
		await workspace.verify();
		if((await identifyBuildEngine(engine)).identitySha256 !== requested.engine.identitySha256) throw new Error("Analysis engine changed during execution");
		if((await identifyComponentInputClosure(inputs)).identitySha256 !== requested.component.inputClosureSha256) throw new Error("Analysis source mount changed during execution");
		signal?.throwIfAborted();
		const bytes = canonicalJson(analysis);
		const report = { schemaVersion: 1
			, kind: "lean-bridge-analysis-execution"
			, component: requested.component.id
			, requestSha256: verifiedRequest.sha256
			, engineIdentitySha256: requested.engine.identitySha256
			, inputClosureSha256: requested.component.inputClosureSha256
			, analysisSha256: sha256(bytes)
			, sourceReadOnly: true
			, authorizedOutputsOnly: true
			, adaptersCompiled: false, backend };
		await mkdir(join(working, "analysis"));
		await writeFile(join(working, "analysis/project-analysis.json"), bytes, { flag: "wx", signal });
		await writeFile(join(working, "engine-execution-report.json"), canonicalJson(report), { flag: "wx", signal });
		signal?.throwIfAborted();
		await rename(working, output);
		return { output, analysis, report };
	} finally
	{ await workspace?.dispose(); await rm(working, { recursive: true, force: true }); }
};
