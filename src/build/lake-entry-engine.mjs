/**
 * Plan public APIs inside the isolated Lean build engine.
 *
 * @file
 */
import { mkdir, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson } from "../capsule/node.mjs";
import { inspectLeanProject } from "../analyze/lean-project.mjs";
import { completeComponentEngineBuild } from "./component-engine.mjs";
import { createComponentBuildPlan } from "./component-plan.mjs";
import { generateCompilerAdapters } from "./compiler-adapters.mjs";
import { prepareComponentCompilationPlan, writeComponentCompilationInputs } from "./component-compilation-plan.mjs";
import { createEngineExecutionRequest, identifyComponentInputClosure } from "./engine-execution-request.mjs";
import { readLakeEntryIntent } from "./lake-entry-intent.mjs";
import { resolveLakeBuildWorkspace } from "./lake-build-workspace.mjs";
import { elaborateLakeEntryModules } from "./lake-entry-elaboration.mjs";
import { processBuildRunner } from "./process-runner.mjs";

/**
 * Generate sources and obtain compiler metadata before constructing any adapters.
 *
 * @param options - Read-only source-intent request and engine context.
 * @param options.verifiedRequest - Verified source-intent execution request.
 * @param options.inputs - Original closed source mount.
 * @param options.output - New output destination.
 * @param options.engine - Installed bridge source root.
 * @param options.backend - Selected backend name.
 * @param options.runner - Optional process runner for final compilation/linking.
 * @param options.environment - Selected compiler environment.
 */
export const executeLakeEntryComponent = async ({ verifiedRequest, inputs, output, engine, backend, runner, environment }) => {
	const requested = verifiedRequest.document;
	const intent = await readLakeEntryIntent({ inputRoot: inputs, expectedSha256: requested.component.sourceIntentSha256 });
	const reconstructed = await createEngineExecutionRequest({ engineRoot: engine, inputRoot: inputs, entryIntent: intent, targets: requested.targets, cachePolicy: requested.cache.policy });
	if(canonicalJson(reconstructed.document) !== canonicalJson(requested)) throw new Error("Source intent differs from the requested component or output inventory");
	const originalFiles = verifiedRequest.input.files.map(file => file.path);
	if(originalFiles.some(path => path !== "lake-entry-intent.json" && !path.startsWith("lake/"))) throw new Error("Source-only requests cannot supply adapters or semantic metadata");
	await mkdir(dirname(output), { recursive: true });
	const working = await mkdtemp(join(dirname(output), ".lean-bridge-entry-engine-"));
	let workspace;
	try
	{
		const projectRoot = join(inputs, "lake/root"), inventory = await inspectLeanProject(projectRoot);
		const graph = JSON.parse(await readFile(join(engine, "poc/lean-link-spike/graph-lock.json"), "utf8"));
		const lean = environment.LEAN_BRIDGE_LEAN ?? (environment.LEAN_WASM_HOST_LEAN_PREFIX ? join(environment.LEAN_WASM_HOST_LEAN_PREFIX, "bin/lean") : join(engine, ".toolchains/elan/bin/lean"));
		const prefix = await processBuildRunner.capture({ command: lean
			, args: ["--print-prefix"]
			, cwd: projectRoot
			, env: { ...environment, ELAN_HOME: environment.ELAN_HOME ?? join(engine, ".toolchains/elan") }
			, timeoutMs: 15000 });
		const leanPrefix = prefix.stdout.trim();
		workspace = await resolveLakeBuildWorkspace({ snapshot: intent.lakeSnapshot, modules: intent.document.modules.map(module => module.module), leanPrefix });
		if(workspace.resolution.leanCommit !== graph.runtime.leanCommit) throw new Error("Public entry compiler differs from the selected shared runtime");
		const analysis = await elaborateLakeEntryModules({ inventory, entries: intent.document.modules, workspace, leanPrefix, engineRoot: engine });
		const componentPlan = createComponentBuildPlan({ analysis, runtime: graph.runtime, targets: requested.targets, lakeSnapshotSha256: intent.lakeSnapshot.sha256 });
		if(canonicalJson(componentPlan.document.component) !== canonicalJson(intent.document.component)) throw new Error("Elaborated component differs from the requested package identity");
		const compilerAdapters = generateCompilerAdapters({ analysis, componentPlan });
		const compilationPlan = await prepareComponentCompilationPlan({ projectRoot, analysis, componentPlan, compilerAdapters });
		const compiledInputs = join(working, "component");
		await writeComponentCompilationInputs({ projectRoot, outputRoot: compiledInputs, analysis, componentPlan, compilerAdapters, lakeSnapshot: intent.lakeSnapshot });
		const before = await identifyComponentInputClosure(compiledInputs);
		const completed = join(working, "execution");
		const result = await completeComponentEngineBuild({ verifiedRequest, inputs: compiledInputs, originalInputs: inputs, output: completed, engine, backend, runner, environment, analysis, componentPlan, compilationPlan, compilerAdapters });
		if((await identifyComponentInputClosure(compiledInputs)).identitySha256 !== before.identitySha256) throw new Error("Engine-generated compilation inputs changed during the build");
		await workspace.verify();
		await rename(completed, output);
		return { ...result, output, bundle: { ...result.bundle, output: join(output, "bundle") } };
	} finally
	{ await workspace?.dispose(); await rm(working, { recursive: true, force: true }); }
};
