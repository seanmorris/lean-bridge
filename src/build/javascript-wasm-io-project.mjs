/** @file Build a source-checked npm handoff for in-memory Lean IO or threaded tasks. */
import { lstat, mkdir, mkdtemp, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { canonicalJson } from "../capsule/node.mjs";
import { inspectLeanProject } from "../analyze/lean-project.mjs";
import { elaboratedComponent } from "../analyze/semantic-model.mjs";
import { resolveComponentRuntimeRoot } from "../release/component-runtime-root.mjs";
import { javaScriptIOProfile, assertJavaScriptIOConfiguration, writeJavaScriptIOPackages } from "../release/javascript-wasm-io-package.mjs";
import { writeCombinedPackageSet } from "../release/package-set-assembly.mjs";
import { CanonicalBuildError } from "./build-error.mjs";
import { openHostProjectSource } from "./host-project-source.mjs";
import { compileJavaScriptIOComponent } from "./javascript-wasm-io-component.mjs";
import { prepareHostJavaScriptCompiler } from "./javascript-wasm-owned-project.mjs";
import { compileJavaScriptTaskComponent } from "./javascript-wasm-task-component.mjs";
import { assertJavaScriptTaskConfiguration,writeJavaScriptTaskPackages } from "../release/javascript-wasm-task-packages.mjs";
import { readTaskInputs,taskProfile } from "../release/javascript-wasm-task-inputs.mjs";
import { assertPhpWasmTaskConfiguration,phpWasmTaskProfile } from "../release/php-wasm-task-packages.mjs";

const absent = async path => {
	if(await lstat(path).catch(error => { if(error.code === "ENOENT") return null; throw error; }))
		throw new CanonicalBuildError("output-exists", "JavaScript IO output already exists: " + path);
};

/**
 * Compile fresh Lean modules with the selected author SDK, then verify the source again before promoting the handoff.
 *
 * @param options - Canonical build options and observed export configuration.
 */
export const buildJavaScriptIOProject = async options => {
	const {engineRoot, environment, runner, cache, signal, lakeSnapshot, onProgress, record, threaded=false, phpWasm=false} = options;
	const target=phpWasm?"php-wasm":"npm", handoff="packages/"+target;
	const project = await realpath(options.projectRoot), output = resolve(options.outputRoot ?? join(project, "build/lean-bridge-release"));
	let staging, work, source;
	try
	{
		(phpWasm?assertPhpWasmTaskConfiguration:threaded ? assertJavaScriptTaskConfiguration : assertJavaScriptIOConfiguration)(record.configuration);
		if(environment.LEAN_BRIDGE_BUILD_BACKEND !== undefined && environment.LEAN_BRIDGE_BUILD_BACKEND !== "auto")
			throw new CanonicalBuildError("unsupported-build-backend", "In-memory npm exports require the pinned local author SDK; an explicit isolated backend cannot fall back to it");
		if(!cache || !["use", "refresh", "off"].includes(cache.policy)) throw new CanonicalBuildError("invalid-cache-policy", "Expected use, refresh or off");
		if(cache.directory !== null && cache.directory !== undefined) throw new CanonicalBuildError("cache-directory-unsupported", "In-memory npm builds compile fresh; a custom cache is not supported");
		if(output === project || project.startsWith(output + "/")) throw new CanonicalBuildError("invalid-output-root", "Output cannot replace the source project");
		await absent(output);
		const inventory = await inspectLeanProject(project, {signal});
		if(inventory.configurationRecord.sha256 !== record.sha256) throw new Error("Export configuration changed before compiling JavaScript IO");
		const component = elaboratedComponent(inventory.project);
		const sdkRoot=environment.LEAN_BRIDGE_JS_TASK_INPUTS ?? join(engineRoot,"runtime/javascript-task");
		if(threaded && !await lstat(sdkRoot).catch(e => { if(e.code!=="ENOENT") throw e; }))
			throw new CanonicalBuildError("javascript-task-inputs-unavailable","The threaded npm author SDK is not installed. Supply the verified LEAN_BRIDGE_JS_TASK_INPUTS directory or a CLI containing it.");
		const taskInputs=threaded ? await readTaskInputs(sdkRoot,{signal,expectedIdentity: environment.LEAN_BRIDGE_JS_TASK_INPUTS_SHA256}) : null;
		const runtimeRoot = threaded ? null : await resolveComponentRuntimeRoot({engineRoot, environment});
		const compile=threaded ? compileJavaScriptTaskComponent : compileJavaScriptIOComponent;
		const packages=threaded ? writeJavaScriptTaskPackages : writeJavaScriptIOPackages;
		const compiler = await prepareHostJavaScriptCompiler({project, engineRoot, environment, runner, intent: {lakeSnapshot}, signal,taskInputs}, async tools => {
			source = await openHostProjectSource({...tools, project, inventory, component});
			const compilation = await compile({...tools, ...source, app: work});
			const root = join(staging, handoff);
			await mkdir(root, {recursive: true});
			const receipt = await packages({root,phpWasm
				, ...source
				, compilation
				, signal
				, configuration: record.configuration
				, mainModule: threaded ? taskInputs.files.get("task.mjs") : await readFile(join(runtimeRoot, "main.mjs"))
				, mainWasm: threaded ? taskInputs.files.get("task.wasm") : await readFile(join(runtimeRoot, "main.wasm"))});
			return {compilation, receipt};
		});
		await mkdir(dirname(output), {recursive: true});
		staging = await mkdtemp(join(dirname(output), ".lean-js-io-release-"));
		work = await mkdtemp(join(dirname(output), ".lean-js-io-objects-"));
		onProgress?.({phase: "build", state: "info", message: threaded ? "Compiling Lean tasks for the shared pthread runtime" : "Compiling synchronous Lean IO for the JavaScript shared runtime"});
		const {compilation, receipt} = await compiler.compile({staging, configurationSha256: record.sha256});
		const manifest = {schemaVersion: 1
			, profile: phpWasm?phpWasmTaskProfile:threaded ? taskProfile : javaScriptIOProfile
			, ...(threaded ? {taskInputsSha256: taskInputs.identity} : {})
			, backend: compiler.backend
			, component
			, configurationSha256: record.sha256
			, bindingIrSha256: compilation.abi.bindingIrSha256
			, componentIdentity: compilation.abi.componentIdentity
			, runtimeIdentity: receipt.profiles[0].runtimeIdentity
			, source: receipt.source
			, lakeSnapshotSha256: source.snapshot.sha256
			, reviewedSourceSha256: compilation.evidence.reviewedSourceSha256
			, packages: receipt.packages
			, packageSet: handoff+"/package-set-receipt.json"};
		await writeFile(join(staging, phpWasm?"php-wasm-task-release.json":threaded ? "javascript-wasm-task-release.json" : "javascript-wasm-io-release.json"), canonicalJson(manifest), {flag: "wx"});
		await writeCombinedPackageSet({root: staging, roots: [handoff], component, source: receipt.source, signal});
		await source.verify();
		if(threaded) await readTaskInputs(sdkRoot, {signal, expectedIdentity: taskInputs.identity});
		signal?.throwIfAborted(); await absent(output); await rename(staging, output); staging = null;
		return {...manifest, output, targets: [target]};
	} catch(error)
	{
		signal?.throwIfAborted();
		if(error instanceof CanonicalBuildError) throw error;
		throw new CanonicalBuildError(error.code ?? (threaded ? "javascript-wasm-task-project-failed" : "javascript-wasm-io-project-failed"), error.message, {details: error.details});
	} finally
	{
		await source?.dispose();
		if(work) await rm(work, {recursive: true, force: true});
		if(staging) await rm(staging, {recursive: true, force: true});
	}
};
