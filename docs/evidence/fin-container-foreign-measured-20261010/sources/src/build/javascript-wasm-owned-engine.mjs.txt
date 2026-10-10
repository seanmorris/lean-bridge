/**
 * Compile owned npm components through the authenticated source-only engine.
 *
 * @file
 */
import { mkdir, mkdtemp, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { compilerExportSelection, readExportConfiguration } from "../analyze/export-configuration.mjs";
import { reviewedOwnedSourceSelection } from "../analyze/reviewed-owned-source.mjs";
import { createMetadataRequest } from "../analyze/elaborated-metadata.mjs";
import { createEngineExecutionRequest, identifyBuildEngine, identifyComponentInputClosure } from "./engine-execution-request.mjs";
import { readLakeEntryIntent } from "./lake-entry-intent.mjs";
import { validateLockedLakeResolution } from "./lake-workspace.mjs";
import { readLakeGeneratedSources } from "./lake-generated-workspace.mjs";
import { verifyLakeEntryModules } from "./lake-entry-modules.mjs";
import { buildOwnedJavaScriptWasmComponent } from "./javascript-wasm-owned-component.mjs";
import { readVerifiedOwnedJavaScriptWasmComponent } from "./javascript-wasm-owned-artifacts.mjs";
import { ownedJavaScriptOutputContract } from "./javascript-wasm-owned-output.mjs";
import { nativeArtifactPaths } from "./native-artifacts.mjs";
import { processBuildRunner } from "./process-runner.mjs";

const same = (a, b) => canonicalJson(a) === canonicalJson(b);
const fail = message => { throw Object.assign(new Error(message), { code: "invalid-owned-javascript-engine-output" }); };
const inside = (parent, child) => { const path = relative(parent, child); return !isAbsolute(path) && path !== ".." && !path.startsWith(`..${sep}`); };
const reportFor = (request, component, backend) => ({ schemaVersion: 1
	, kind: "lean-bridge-owned-javascript-execution", backend
	, component: request.document.component.id
	, requestSha256: request.sha256
	, engineIdentitySha256: request.document.engine.identitySha256
	, inputClosureSha256: request.document.component.inputClosureSha256
	, componentReceiptSha256: component.identity
	, bindingIrSha256: component.model.bindingIrSha256
	, sourceReadOnly: true, authorizedOutputsOnly: true
	, runtimeBinaryIncluded: false });

const verifySource = async ({ component, root, intent, inputRoot, engineRoot, signal }) => {
	const source = component.receipt.sourceIdentity, snapshot = intent.lakeSnapshot;
	const record = await readExportConfiguration(join(inputRoot, "lake/root"), { signal });
	const configuration = record.configuration, review = intent.document.reviewedBindingIr;
	const selection = review ? reviewedOwnedSourceSelection(review) : null;
	const contract = await ownedJavaScriptOutputContract({ intent, inputRoot, signal });
	if(!same(component.model.component, intent.document.component)
		|| source.sourceTreeSha256 !== intent.document.source.treeSha256
		|| `leanprover/lean4:v${source.leanVersion}` !== intent.document.source.toolchain
		|| source.exportConfigurationSha256 !== record.sha256
		|| !same(source.reviewedBindingIr ?? null, review ?? null)
		|| source.sourceNoticesSha256 !== contract.notices.sha256
		|| source.extractorSha256 !== sha256(await readFile(join(engineRoot, "src/analyze/NativeExports.lean")))
		|| source.lakeDependencies?.snapshotSha256 !== snapshot.sha256
		|| !same(source.lakeDependencies?.snapshot, snapshot.document)) fail("Owned JavaScript component differs from the captured source, compiler extractor or review");
	const configurationSource = record.path === null ? null : await readFile(join(inputRoot, "lake/root", record.path), "utf8");
	if(source.exportConfigurationSource !== configurationSource) fail("Owned JavaScript component changed the author configuration");
	for(const [path, bytes] of contract.notices.files)
		if(!(await readFile(join(root, path))).equals(bytes)) fail("Owned JavaScript source notices differ from the captured input");
	const modules = intent.document.modules.map(item => item.module);
	const evidence = source.lakeDependencies;
	if(evidence.resolutionSha256 !== sha256(canonicalJson(evidence.resolution))) fail("Owned JavaScript Lake resolution identity changed");
	let resolution = evidence.resolution;
	if(evidence.generatedSourcesSha256)
	{
		const generated = await readLakeGeneratedSources({ snapshot
			, snapshotRoot: join(inputRoot, "lake")
			, modules, artifactPath: join(root, "lake-generated-sources.json")
			, expectedSha256: evidence.generatedSourcesSha256, signal });
		try
		{ if(!same(generated.document.resolution, resolution)) fail("Owned JavaScript generated resolution changed"); }
		finally
		{ await generated.dispose(); }
		resolution = resolution.result.resolution;
	}
	else validateLockedLakeResolution({ snapshot, resolution, modules });
	verifyLakeEntryModules(intent.document.modules, resolution);
	if(evidence.resolution.leanCompilerSha256 !== source.leanCompilerSha256
		|| evidence.resolution.resolverSha256 !== sha256(await readFile(join(engineRoot, "src/build/ResolveLakeWorkspace.lean")))
		|| source.modules.length !== resolution.modules.length
		|| new Set(source.modules.map(item => item.module)).size !== source.modules.length) fail("Owned JavaScript compiler or module closure changed");
	for(const item of source.modules)
	{
		const expected = resolution.modules.find(module => module.module === item.module);
		if(!expected || !same(item.source, { ...expected.source, path: expected.path })) fail("Owned JavaScript module source differs from the resolved capture");
	}
	const request = createMetadataRequest({ profile: "native-library-v1"
		, modules: source.modules.map(item => item.module), exportModules: modules
		, exports: selection?.exports ?? configuration.exports ?? []
		, resources: selection?.resources ?? configuration.resources ?? []
		, arities: selection?.arities ?? Object.entries(configuration.arities ?? {})
		, ...compilerExportSelection(configuration)
		, ...(selection?.ownedAggregates ? { ownedAggregates: selection.ownedAggregates } : {}) }
	, { toolchain: intent.document.source.toolchain
		, leanCompilerSha256: source.leanCompilerSha256
		, extractorSha256: source.extractorSha256
		, ...(review ? { reviewedBindingIrSha256: sha256(canonicalJson(review)) } : {})
		, modules: source.modules.map(item => ({ name: item.module
			, sourcePath: item.source.path, sourceSha256: item.source.sha256
			, interfaceSha256: item.interface.interfaceSha256 })) });
	if(!same(request, source.request)) fail("Owned JavaScript compiler invocation differs from the authorized exports and ownership policy");
};

/**
 * Verify engine output against independently retained source and request bytes.
 *
 * @param options - Request, authenticated source capture and output directory.
 * @param options.outputRoot - Engine output containing only component and report.
 * @param options.request - Retained closed engine request.
 * @param options.intent - Retained source-only ownership intent.
 * @param options.inputRoot - Original read-only input capture.
 * @param options.engineRoot - Engine sources authenticated by the request.
 * @param options.backend - Expected execution backend, not an output hint.
 * @param options.signal - Optional cancellation signal.
 */
export const readVerifiedOwnedJavaScriptEngineOutput = async ({ outputRoot, request, intent, inputRoot, engineRoot, backend, signal }) => {
	signal?.throwIfAborted();
	const output = resolve(outputRoot), root = join(output, "component");
	if(request.document.schemaVersion !== 4 || await realpath(output) !== output) fail("Owned JavaScript output requires its own request and a regular output directory");
	const reconstructed = await createEngineExecutionRequest({ engineRoot, inputRoot, entryIntent: intent, purpose: "owned-javascript", targets: ["npm"], cachePolicy: request.document.cache.policy });
	if(request.sha256 !== reconstructed.sha256 || !same(request.document, reconstructed.document)) fail("Owned JavaScript output request differs from the original captured inputs");
	const authorized = ["engine-execution-report.json", ...request.document.output.authorizedFiles.map(path => `component/${path}`)].sort();
	if(!same(await nativeArtifactPaths(output), authorized)) fail("Owned JavaScript engine released unauthorized or missing outputs");
	const component = await readVerifiedOwnedJavaScriptWasmComponent(root);
	await verifySource({ component, root, intent, inputRoot, engineRoot, signal });
	const bytes = await readFile(join(output, "engine-execution-report.json"), "utf8");
	const report = reportFor(request, component, backend);
	if(bytes !== canonicalJson(report)) fail("Owned JavaScript execution report differs from the requested operation");
	signal?.throwIfAborted();
	return { ...component, root, report };
};

/**
 * Execute a schema-4 request with only the engine's pinned Lean and target SDK.
 *
 * @param options - Verified request, read-only inputs and isolated compiler environment.
 * @param options.verifiedRequest - Closed request with checked engine and input identities.
 * @param options.inputs - Read-only source mount.
 * @param options.output - New authorized output directory.
 * @param options.engine - Pinned engine source root.
 * @param options.backend - Actual backend identifier.
 * @param options.runner - Optional compiler process runner.
 * @param options.environment - Engine-provided pinned compiler locations.
 * @param options.signal - Optional cancellation signal.
 */
export const executeOwnedJavaScriptEngine = async ({ verifiedRequest, inputs, output, engine, backend, runner = processBuildRunner, environment, signal }) => {
	if(inside(inputs, output) || inside(engine, output)) fail("Owned JavaScript output must be outside source and engine mounts");
	const intent = await readLakeEntryIntent({ inputRoot: inputs, expectedSha256: verifiedRequest.document.component.sourceIntentSha256, purpose: "owned-javascript", ownedGraphs: true, signal });
	const reconstructed = await createEngineExecutionRequest({ engineRoot: engine
		, inputRoot: inputs, entryIntent: intent, purpose: "owned-javascript"
		, targets: verifiedRequest.document.targets
		, cachePolicy: verifiedRequest.document.cache.policy });
	if(verifiedRequest.sha256 !== reconstructed.sha256 || !same(verifiedRequest.document, reconstructed.document)) fail("Owned JavaScript request changed its source or output authorization");
	const leanPrefix = environment.LEAN_BRIDGE_LEAN_PREFIX ?? environment.LEAN_WASM_HOST_LEAN_PREFIX;
	const emsdkRoot = environment.LEAN_BRIDGE_JS_EMSDK ?? environment.LEAN_WASM_EMSDK;
	const leanRuntimeRoot = environment.LEAN_BRIDGE_JS_TARGET_RUNTIME ?? environment.LEAN_BRIDGE_RUNTIME_ROOT;
	if([leanPrefix, emsdkRoot, leanRuntimeRoot].some(path => typeof path !== "string" || !isAbsolute(path))) fail("Owned JavaScript engine requires its pinned Lean, Emscripten and target runtime inputs");
	await mkdir(dirname(output), { recursive: true });
	if(await realpath(dirname(output)) !== dirname(output)) fail("Owned JavaScript output parent must not contain symlinks");
	const working = await mkdtemp(join(dirname(output), ".lean-owned-javascript-engine-"));
	try
	{
		await buildOwnedJavaScriptWasmComponent({ projectRoot: join(inputs, "lake/root")
			, outputRoot: join(working, "component")
			, sourceCaptureRoot: join(inputs, "lake")
			, lakeSnapshot: intent.lakeSnapshot, leanPrefix, emsdkRoot
			, leanRuntimeRoot, runner, environment, signal });
		const component = await readVerifiedOwnedJavaScriptWasmComponent(join(working, "component"));
		const report = reportFor(verifiedRequest, component, backend);
		await writeFile(join(working, "engine-execution-report.json"), canonicalJson(report), { flag: "wx", signal });
		await readVerifiedOwnedJavaScriptEngineOutput({ outputRoot: working, request: verifiedRequest, intent, inputRoot: inputs, engineRoot: engine, backend, signal });
		if((await identifyBuildEngine(engine)).identitySha256 !== verifiedRequest.document.engine.identitySha256
			|| (await identifyComponentInputClosure(inputs)).identitySha256 !== verifiedRequest.document.component.inputClosureSha256) fail("Owned JavaScript engine or source changed during compilation");
		signal?.throwIfAborted();
		await rename(working, output);
		return { output, component, report };
	} finally
	{ await rm(working, { recursive: true, force: true }); }
};
