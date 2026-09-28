/**
 * Canonical npm delivery for compiler-authenticated ownership graphs.
 *
 * @file
 */
import { lstat, mkdir, mkdtemp, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson } from "../capsule/node.mjs";
import { inspectLeanProject } from "../analyze/lean-project.mjs";
import { readNativeReviewedSource } from "../analyze/reviewed-owned-source.mjs";
import { assertExportConfigurationCapabilities, readExportConfiguration } from "../analyze/export-configuration.mjs";
import { buildOwnedJavaScriptWasmComponent } from "./javascript-wasm-owned-component.mjs";
import { javascriptWasmOwnedPins as pins } from "./javascript-wasm-owned-artifacts.mjs";
import { javascriptWasmOwnedProfile as profile } from "./javascript-wasm-owned-model.mjs";
import { buildOwnedJavaScriptNpmPackages } from "../release/owned-javascript-npm-package.mjs";
import { readVerifiedJavaScriptWasmCompilerInputs } from "../release/javascript-wasm-compiler-inputs.mjs";
import { readVerifiedPackageSetReceipt } from "../release/package-set-receipt.mjs";
import { writeCombinedPackageSet } from "../release/package-set-assembly.mjs";
import { resolveComponentRuntimeRoot } from "../release/component-runtime-root.mjs";
import { processBuildRunner } from "./process-runner.mjs";
import { CanonicalBuildError } from "./build-error.mjs";
import { prepareLakeEntryIntent } from "./lake-entry-intent.mjs";
import { verifyLakeSnapshotSourceTree } from "./lake-dependency-snapshot.mjs";

const installedEngine = fileURLToPath(new URL("../../", import.meta.url));
const absent = async path => {
	if(await lstat(path).catch(error => { if(error.code === "ENOENT") return null; throw error; }))
		throw new CanonicalBuildError("output-exists", `Build output already exists: ${path}`);
};
const directory = async (path, variable) => {
	if(typeof path !== "string" || !path || !(await stat(path).catch(() => null))?.isDirectory())
		throw new CanonicalBuildError("javascript-wasm-toolchain-unavailable", `Missing owned JavaScript build input: ${variable}`, {
			hint: `Set ${variable} to the pinned author toolchain input. Consumers do not need compilers.`
		});
	return resolve(path);
};

/**
 * Choose the ownership compiler from captured author decisions, not type guesses.
 * Revalidate the full review before using its schema version for dispatch.
 *
 * @param projectRoot - Ordinary source directory.
 * @param signal - Optional cancellation signal.
 */
export const usesOwnedJavaScript = async (projectRoot, signal) => {
	const inventory = await inspectLeanProject(projectRoot, { signal });
	const review = await readNativeReviewedSource(projectRoot, inventory, signal, true);
	return Boolean(inventory.configurationRecord.configuration.ownedAggregates || review && JSON.parse(review.source).schemaVersion === 4);
};

/**
 * Compile with the pinned author SDK and publish one complete local handoff.
 * Explicit Nix/Docker requests cannot silently fall back to a host compiler.
 *
 * @param options - Canonical source, SDK, package and output settings.
 */
export const buildOwnedJavaScriptProject = async options => {
	const { projectRoot, outputRoot, engineRoot = installedEngine
		, environment = process.env
		, runner = processBuildRunner, signal, onProgress, lakeSnapshot
		, cache = { policy: "use", directory: null } } = options;
	signal?.throwIfAborted();
	const project = resolve(projectRoot), output = resolve(outputRoot ?? join(project, "build/lean-bridge-release"));
	if(output === project || project.startsWith(`${output}/`)) throw new CanonicalBuildError("invalid-output-root", "JavaScript output cannot replace the source project");
	await absent(output);
	if(cache === null || typeof cache !== "object" || !["use", "refresh", "off"].includes(cache.policy))
		throw new CanonicalBuildError("invalid-cache-policy", "Build cache policy must be use, refresh, or off");
	if(cache.directory !== null && cache.directory !== undefined)
		throw new CanonicalBuildError("cache-directory-unsupported", "Owned JavaScript builds compile fresh and do not implement --cache-directory");
	if(environment.LEAN_BRIDGE_BUILD_BACKEND && environment.LEAN_BRIDGE_BUILD_BACKEND !== "auto")
		throw new CanonicalBuildError("javascript-wasm-backend-unsupported", "Owned JavaScript builds use the pinned Lean/Emscripten author SDK", { hint: "Use the default backend. An explicit Nix or Docker selection is never ignored." });
	const record = await readExportConfiguration(project, { signal });
	assertExportConfigurationCapabilities(record.configuration, { target: "npm"
		, fields: ["package", "modules", "exports", "resources", "arities", "ownedAggregates", "specializations", "contracts", "generators"]
		, targetFields: ["name", "version"] });
	const intent = await prepareLakeEntryIntent({ projectRoot: project, lakeSnapshot, signal, purpose: "analysis", ownedGraphs: true });
	const emsdkRoot = await directory(environment.LEAN_BRIDGE_JS_EMSDK ?? join(engineRoot, ".toolchains/emsdk"), "LEAN_BRIDGE_JS_EMSDK");
	if(environment.LEAN_BRIDGE_JS_INPUTS !== undefined && environment.LEAN_BRIDGE_JS_TARGET_RUNTIME !== undefined)
		throw new CanonicalBuildError("conflicting-javascript-wasm-inputs", "Select prepared JavaScript compiler inputs or a raw target tree, not both");
	const bundled = join(engineRoot, "runtime/javascript-wasm");
	const inputRoot = environment.LEAN_BRIDGE_JS_INPUTS ?? (environment.LEAN_BRIDGE_JS_TARGET_RUNTIME === undefined
		&& await lstat(bundled).catch(error => { if(error.code === "ENOENT") return null; throw error; }) ? bundled : null);
	const inputs = inputRoot === null ? null : await readVerifiedJavaScriptWasmCompilerInputs(await directory(inputRoot, "LEAN_BRIDGE_JS_INPUTS"), { signal });
	const rawTarget = inputs ? null : await directory(environment.LEAN_BRIDGE_JS_TARGET_RUNTIME
		?? join(engineRoot, `build/lean-runtime/${pins.leanCommit}-${pins.patchSetSha256}-browser`), "LEAN_BRIDGE_JS_TARGET_RUNTIME");
	const runtimeRoot = await resolveComponentRuntimeRoot({ engineRoot, environment });
	let leanPrefix = environment.LEAN_BRIDGE_LEAN_PREFIX;
	if(!leanPrefix)
	{
		try
		{ leanPrefix = (await runner.capture({ command: "lean", args: ["--print-prefix"], cwd: project, env: environment, signal })).stdout.trim(); }
		catch(error)
		{ signal?.throwIfAborted(); throw new CanonicalBuildError("javascript-wasm-toolchain-unavailable", "The pinned host Lean compiler is unavailable", { hint: "Set LEAN_BRIDGE_LEAN_PREFIX to Lean 4.32.2.", details: error.details }); }
	}
	await directory(leanPrefix, "LEAN_BRIDGE_LEAN_PREFIX");
	await mkdir(dirname(output), { recursive: true });
	const staging = await mkdtemp(join(dirname(output), ".lean-owned-javascript-project-"));
	try
	{
		const target = inputs ? join(staging, ".compiler-inputs") : rawTarget;
		if(inputs)
		{
			for(const [path, bytes] of inputs.files)
			{
				const destination = join(target, path);
				await mkdir(dirname(destination), { recursive: true }); await writeFile(destination, bytes, { flag: "wx" });
			}
			if((await readVerifiedJavaScriptWasmCompilerInputs(target, { signal })).identity !== inputs.identity) throw new Error("JavaScript compiler inputs changed while staging");
		}
		onProgress?.({ phase: "build", state: "info", message: "Compiling owned Lean exports for the shared JavaScript runtime" });
		const componentRoot = join(staging, "javascript-wasm/component");
		const built = await buildOwnedJavaScriptWasmComponent({ projectRoot: project
			, outputRoot: componentRoot
			, leanPrefix, leanRuntimeRoot: target, emsdkRoot
			, environment, runner, signal
			, configurationSha256: record.sha256, lakeSnapshot: intent.lakeSnapshot });
		const packages = await buildOwnedJavaScriptNpmPackages({ componentRoot, runtimeRoot, outputRoot: join(staging, "packages/npm"), signal });
		const report = await readVerifiedPackageSetReceipt({ receiptPath: join(packages.output, "package-set-receipt.json"), signal });
		if(inputs) await rm(target, { recursive: true });
		const manifest = { schemaVersion: 1, profile, backend: "pinned-author-sdk"
			, component: built.model.component
			, bindingIrSha256: built.model.bindingIrSha256
			, runtimeIdentity: packages.runtimeIdentity
			, configurationSha256: record.sha256
			, source: { treeSha256: intent.document.source.treeSha256
				, lakeSnapshotSha256: intent.lakeSnapshot.sha256
				, toolchain: intent.document.source.toolchain }
			, ...(intent.document.reviewedBindingIr ? { reviewedBindingIrSha256: intent.document.reviewedBindingIr.semanticSha256 } : {})
			, packageSet: "packages/npm/package-set-receipt.json"
			, packages: report.receipt.packages };
		await verifyLakeSnapshotSourceTree({ snapshot: intent.lakeSnapshot, projectRoot: project, signal });
		if((await readExportConfiguration(project, { signal })).sha256 !== record.sha256) throw new Error("Export configuration changed during owned JavaScript packaging");
		await writeFile(join(staging, "javascript-wasm-release.json"), canonicalJson(manifest), { flag: "wx" });
		await writeCombinedPackageSet({ root: staging, roots: ["packages/npm"], component: manifest.component, source: { treeSha256: manifest.source.treeSha256 }, signal });
		signal?.throwIfAborted(); await absent(output); await rename(staging, output);
		return { ...manifest, output, targets: ["npm"] };
	}
	catch(error)
	{
		await rm(staging, { recursive: true, force: true });
		if(error instanceof CanonicalBuildError) throw error;
		throw new CanonicalBuildError(error.code ?? "javascript-wasm-project-build-failed", error.message, { details: error.details });
	}
};
