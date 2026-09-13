/**
 * Capture author inputs and run compiler-owned analysis through the pinned engine.
 *
 * @file
 */
import { lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { inspectLeanProject } from "./lean-project.mjs";
import { reviewedProjectAnalysis, validateCompilerProjectAnalysis } from "./project-analysis.mjs";
import { detectBuildBackend, runDockerComponentEngine, runNativeComponentEngine } from "../build/canonical-build.mjs";
import { identifyBuildEngine, identifyComponentInputClosure, writeEngineExecutionRequest } from "../build/engine-execution-request.mjs";
import { prepareLakeEntryIntent, writeLakeEntryInputs } from "../build/lake-entry-intent.mjs";
import { verifyLakeSnapshotProject } from "../build/lake-dependency-snapshot.mjs";
import { processBuildRunner } from "../build/process-runner.mjs";

const installedEngineRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const fail = message => { throw Object.assign(new Error(message), { code: "invalid-compiler-analysis" }); };
const same = (a, b) => canonicalJson(a) === canonicalJson(b);
const inside = (parent, child) => { const path = relative(parent, child); return !isAbsolute(path) && path !== ".." && !path.startsWith(`..${sep}`); };
const readOutput = async path => {
	const before = await lstat(path);
	if(!before.isFile() || before.size > 32 * 1024 * 1024 || await realpath(path) !== path) fail("Analysis output must be a bounded regular file without symlinks");
	const bytes = await readFile(path), after = await lstat(path);
	if(bytes.length !== before.size || before.ino !== after.ino || before.dev !== after.dev || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs) fail("Analysis output changed while reading it");
	return bytes;
};
const readEngineAnalysis = async (output, request, inventory, intent, backend, engine) => {
	if(await realpath(output) !== output || !same((await readdir(output)).sort(), ["analysis", "engine-execution-report.json"])
		|| !same(await readdir(join(output, "analysis")), ["project-analysis.json"])) fail("Analysis engine released unauthorized output");
	const bytes = await readOutput(join(output, "analysis/project-analysis.json"));
	const reportBytes = await readOutput(join(output, "engine-execution-report.json"));
	const report = JSON.parse(reportBytes.toString("utf8"));
	const expected = { schemaVersion: 1
		, kind: "lean-bridge-analysis-execution"
		, component: request.document.component.id
		, requestSha256: request.sha256
		, engineIdentitySha256: request.document.engine.identitySha256
		, inputClosureSha256: request.document.component.inputClosureSha256
		, analysisSha256: sha256(bytes)
		, sourceReadOnly: true
		, authorizedOutputsOnly: true
		, adaptersCompiled: false
		, backend };
	if(!same(report, expected) || reportBytes.toString() !== canonicalJson(report)) fail("Analysis execution report differs from the requested operation");
	const analysis = JSON.parse(bytes.toString("utf8"));
	validateCompilerProjectAnalysis(analysis, inventory, intent);
	if(analysis.elaboration.extractorSha256 !== sha256(await readFile(join(engine, "src/analyze/NativeExports.lean")))) fail("Analysis names a different compiler extractor");
	if(bytes.toString() !== canonicalJson(analysis)) fail("Analysis output must use canonical JSON");
	return analysis;
};

/**
 * Analyze through the isolated compiler, retaining the explicit reviewed-IR path.
 *
 * @param projectRoot - Original author checkout, never a compiler working directory.
 * @param options - Backend, cancellation and test injection controls.
 * @param options.targets - Requested consumer targets, without host-authored types.
 * @param options.cache - Existing CLI backend cache policy.
 * @param options.signal - Optional cancellation signal.
 * @param options.onProgress - Optional progress observer.
 * @param options.engineRoot - Installed pinned engine sources.
 * @param options.runner - Optional backend process runner.
 * @param options.environment - Backend selection and tool configuration.
 */
export const analyzeCompilerProject = async (projectRoot, { targets = []
	, cache = { policy: "use", directory: null }
	, signal
	, onProgress
	, engineRoot = installedEngineRoot
	, runner = processBuildRunner
	, environment = process.env } = {}) => {
	signal?.throwIfAborted();
	const root = await realpath(projectRoot), engine = await realpath(engineRoot);
	const inventory = await inspectLeanProject(root, { signal });
	if(inventory.inputs.some(input => input.path.endsWith(".binding-ir.json")))
	{
		const report = await reviewedProjectAnalysis(root, inventory, signal);
		if(!same(await inspectLeanProject(root, { signal }), inventory)) fail("Reviewed project inputs changed during analysis");
		return report;
	}
	const intent = await prepareLakeEntryIntent({ projectRoot: root, purpose: "analysis", signal });
	if(!same(intent.document.source.inputs, inventory.inputs)) fail("Project source changed before compiler analysis");
	const cancellable = { capture: async request => {
		try
		{ return await runner.capture({ ...request, signal }); }
		catch(error)
		{ signal?.throwIfAborted(); throw error; }
	} };
	const selection = await detectBuildBackend({ environment, runner: cancellable });
	signal?.throwIfAborted();
	onProgress?.({ phase: "elaborate", state: "started", message: "Compiling fresh Lean interfaces in the pinned engine" });
	const parent = await realpath(selection.backend === "docker" && environment.LEAN_BRIDGE_DOCKER_STAGING_ROOT ? environment.LEAN_BRIDGE_DOCKER_STAGING_ROOT : tmpdir());
	if(inside(root, parent)) fail("Analysis staging must be outside the author project");
	const working = await mkdtemp(join(parent, ".lean-bridge-analysis-"));
	try
	{
		const inputRoot = join(working, "component"), requestPath = join(working, "request/engine-execution-request.json");
		await writeLakeEntryInputs({ intent, outputRoot: inputRoot, signal });
		const request = await writeEngineExecutionRequest({ output: requestPath
			, engineRoot: engine, inputRoot, entryIntent: intent
			, purpose: "analysis", targets, cachePolicy: cache.policy });
		const outputRoot = join(working, "output/execution");
		await mkdir(dirname(outputRoot));
		const effectiveEnvironment = { ...environment
			, ...(cache.policy === "off" ? { LEAN_BRIDGE_NIX_STORE: join(working, "nix-store") } : cache.directory ? { LEAN_BRIDGE_NIX_STORE: cache.directory } : {})
			, ...(cache.policy === "refresh" ? { LEAN_BRIDGE_NIX_REFRESH: "1" } : {}) };
		const options = { engineRoot: engine, inputRoot, requestPath, outputRoot, selection, runner: cancellable, environment: effectiveEnvironment, cache };
		if(selection.backend === "docker") await runDockerComponentEngine(options);
		else await runNativeComponentEngine(options);
		signal?.throwIfAborted();
		const analysis = await readEngineAnalysis(outputRoot, request, inventory, intent, selection.backend === "docker" ? "docker-nix" : "native-nix", engine);
		if((await identifyBuildEngine(engine)).identitySha256 !== request.document.engine.identitySha256
			|| (await identifyComponentInputClosure(inputRoot)).identitySha256 !== request.document.component.inputClosureSha256) fail("Engine or transported source changed during analysis");
		await verifyLakeSnapshotProject({ snapshot: intent.lakeSnapshot, projectRoot: root, signal });
		const current = await prepareLakeEntryIntent({ projectRoot: root, purpose: "analysis", signal });
		if(current.sha256 !== intent.sha256) fail("Source or dependencies changed during analysis");
		onProgress?.({ phase: "elaborate", state: "completed", message: "Compiler metadata and source identities verified" });
		return analysis;
	} finally
	{
		await rm(working, { recursive: true, force: true });
	}
	};
