/**
 * Build an ordinary Lean project into prepared, ABI-specific PHP-Wasm packages.
 *
 * @file
 */
import { cp, lstat, mkdir, mkdtemp, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson } from "../capsule/node.mjs";
import { assertExportConfigurationCapabilities, readExportConfiguration } from "../analyze/export-configuration.mjs";
import { buildPhpWasmCopiedComponent, buildPhpWasmCopiedRuntime } from "./php-wasm-copied-component.mjs";
import { phpWasmCopiedPins as pins, readVerifiedPhpWasmCopiedRuntime } from "./php-wasm-copied-artifacts.mjs";
import { buildPhpWasmCopiedPackages, readVerifiedPhpWasmCopiedPackageSet } from "../release/php-wasm-copied-package.mjs";
import { processBuildRunner } from "./process-runner.mjs";
import { CanonicalBuildError } from "./build-error.mjs";
import { prepareLakeEntryIntent } from "./lake-entry-intent.mjs";
import { verifyLakeSnapshotSourceTree } from "./lake-dependency-snapshot.mjs";
import { writePhpWasmPackageSet } from "../release/package-set-assembly.mjs";
import { readVerifiedPhpWasmCompilerInputs } from "../release/php-wasm-compiler-inputs.mjs";

const installedEngine = fileURLToPath(new URL("../../", import.meta.url));
const absent = async path => {
	try
	{ await lstat(path); }
	catch(error)
	{ if(error.code === "ENOENT") return; throw error; }
	throw new CanonicalBuildError("output-exists", `Build output already exists: ${path}`);
};
const directory = async (path, variable) => {
	if(typeof path !== "string" || !path || !(await stat(path).catch(() => null))?.isDirectory())
		throw new CanonicalBuildError("php-wasm-toolchain-unavailable", `Missing PHP-Wasm build input: ${variable}`, { hint: `Set ${variable} to the prepared directory. See docs/contributing/author-toolchain/#php-wasm.` });
	return resolve(path);
};

/**
 * Verify the copied startup handoff and retain one compiled artifact per ABI.
 *
 * @param options - Ordinary source, separate PHP-Wasm toolchain and output policy.
 */
export const buildPhpWasmProject = async options => {
	const { projectRoot, outputRoot, engineRoot = installedEngine, environment = process.env, signal, onProgress, lakeSnapshot } = options;
	signal?.throwIfAborted();
	const project = resolve(projectRoot), output = resolve(outputRoot ?? join(project, "build/lean-bridge-php-wasm"));
	if(output === project || project.startsWith(`${output}/`)) throw new CanonicalBuildError("invalid-output-root", "PHP-Wasm output cannot replace the source project");
	await absent(output);
	const record = await readExportConfiguration(project, { signal });
	assertExportConfigurationCapabilities(record.configuration, { target: "php-wasm", fields: ["modules", "exports", "specializations", "contracts", "generators"], targetFields: ["npm", "composer"] });
	const config = record.configuration.targets?.["php-wasm"] ?? {};
	// Source-only capture admits declarations; the wasm32 compiler admits types.
	const intent = await prepareLakeEntryIntent({ projectRoot: project, lakeSnapshot, signal, purpose: "analysis" });
	const emsdkRoot = await directory(environment.LEAN_BRIDGE_PHP_EMSDK ?? join(engineRoot, ".toolchains/emsdk-php-wasm"), "LEAN_BRIDGE_PHP_EMSDK");
	const rawInputs = ["LEAN_BRIDGE_PHP_SOURCE", "LEAN_BRIDGE_PHP_COPIED_RUNTIME", "LEAN_BRIDGE_PHP_LEAN_RUNTIME"].some(name => environment[name] !== undefined);
	if(environment.LEAN_BRIDGE_PHP_INPUTS !== undefined && rawInputs)
		throw new CanonicalBuildError("conflicting-php-wasm-inputs", "LEAN_BRIDGE_PHP_INPUTS cannot be combined with raw PHP source or runtime overrides");
	const defaultInputs = join(engineRoot, "runtime/php-wasm");
	const inputRoot = environment.LEAN_BRIDGE_PHP_INPUTS ?? (!rawInputs && await lstat(defaultInputs).catch(error => { if(error.code === "ENOENT") return null; throw error; }) ? defaultInputs : null);
	const inputs = inputRoot === null ? null : await readVerifiedPhpWasmCompilerInputs(await directory(inputRoot, "LEAN_BRIDGE_PHP_INPUTS"), { signal });
	let phpSource = inputs ? null : await directory(environment.LEAN_BRIDGE_PHP_SOURCE ?? join(engineRoot, "build/php-wasm-sdk/php8.4-src"), "LEAN_BRIDGE_PHP_SOURCE");
	const preparedRuntime = inputs || environment.LEAN_BRIDGE_PHP_COPIED_RUNTIME === undefined ? null : await directory(environment.LEAN_BRIDGE_PHP_COPIED_RUNTIME, "LEAN_BRIDGE_PHP_COPIED_RUNTIME");
	const leanRuntimeRoot = inputs || preparedRuntime ? null : await directory(environment.LEAN_BRIDGE_PHP_LEAN_RUNTIME ?? join(engineRoot, `build/lean-runtime/${pins.leanCommit}-${pins.patchSetSha256}-browser-php-wasm-3.1.68`), "LEAN_BRIDGE_PHP_LEAN_RUNTIME");
	let leanPrefix = environment.LEAN_BRIDGE_LEAN_PREFIX;
	if(!leanPrefix)
	{
		try
		{ leanPrefix = (await processBuildRunner.capture({ command: "lean", args: ["--print-prefix"], cwd: project, env: environment, signal })).stdout.trim(); }
		catch(error)
		{ signal?.throwIfAborted(); throw new CanonicalBuildError("php-wasm-toolchain-unavailable", "The pinned host Lean compiler is unavailable", { hint: "Set LEAN_BRIDGE_LEAN_PREFIX to the pinned Lean installation.", details: error.details }); }
	}
	await directory(leanPrefix, "LEAN_BRIDGE_LEAN_PREFIX");
	await mkdir(dirname(output), { recursive: true });
	const staging = await mkdtemp(join(dirname(output), ".lean-bridge-php-wasm-project-"));
	try
	{
		const runtimeRoot = join(staging, "php-wasm/runtime"), componentRoot = join(staging, "php-wasm/component");
		if(inputs)
		{
			phpSource = join(staging, ".compiler-inputs/php");
			for(const [path, bytes] of inputs.files)
			{
				if(!path.startsWith("php/") && !path.startsWith("runtime/")) continue;
				const destination = path.startsWith("runtime/") ? join(runtimeRoot, path.slice(8)) : join(staging, ".compiler-inputs", path);
				await mkdir(dirname(destination), { recursive: true }); await writeFile(destination, bytes, { flag: "wx" });
			}
			if((await readVerifiedPhpWasmCopiedRuntime(runtimeRoot)).identity !== inputs.manifest.runtimeIdentity) throw new Error("Prepared PHP-Wasm runtime changed while staging");
		} else if(preparedRuntime)
		{
			const expected = await readVerifiedPhpWasmCopiedRuntime(preparedRuntime);
			await cp(preparedRuntime, runtimeRoot, { recursive: true });
			if((await readVerifiedPhpWasmCopiedRuntime(runtimeRoot)).identity !== expected.identity) throw new Error("Prepared PHP-Wasm runtime changed while copying");
		} else await buildPhpWasmCopiedRuntime({ outputRoot: runtimeRoot, leanRuntimeRoot, emsdkRoot, signal });
		onProgress?.({ phase: "build", state: "info", message: "Compiling checked PHP-Wasm Lean exports" });
		const built = await buildPhpWasmCopiedComponent({ projectRoot: project, outputRoot: componentRoot, runtimeRoot, leanPrefix, emsdkRoot, phpSource, configurationSha256: record.sha256, lakeSnapshot: intent.lakeSnapshot, signal });
		if(inputs)
		{
			if(built.receipt.phpHeadersSha256 !== inputs.manifest.phpHeadersSha256) throw new Error("Prepared PHP-Wasm headers changed while staging");
			await rm(join(staging, ".compiler-inputs"), { recursive: true });
		}
		signal?.throwIfAborted();
		const packages = await buildPhpWasmCopiedPackages({ componentRoot, runtimeRoot, outputRoot: join(staging, "packages/php-wasm"), leanPrefix, npmSettings: config.npm, composerSettings: config.composer });
		await readVerifiedPhpWasmCopiedPackageSet(packages.output);
		await verifyLakeSnapshotSourceTree({ snapshot: intent.lakeSnapshot, projectRoot: project, signal });
		if((await readExportConfiguration(project, { signal })).sha256 !== record.sha256) throw new Error("Export configuration changed during PHP-Wasm packaging");
		const manifest = {
			schemaVersion: 1, profile: "php-wasm-copied-v1"
			, component: built.model.component
			, runtimeIdentity: built.receipt.runtimeIdentity
			, bindingIrSha256: built.model.bindingIrSha256
			, configurationSha256: record.sha256
			, source: { treeSha256: intent.document.source.treeSha256, lakeSnapshotSha256: intent.lakeSnapshot.sha256, toolchain: intent.document.source.toolchain }
			, packageSet: "packages/php-wasm/php-wasm-package-set.json"
			, packages: packages.report.archives.map(archive => ({ ecosystem: archive.ecosystem, role: archive.role, name: archive.name, version: archive.version, archive: archive.archive, bytes: archive.bytes, sha256: archive.sha256, path: `packages/php-wasm/archives/${archive.archive}` })) };
		await writeFile(join(staging, "php-wasm-release.json"), canonicalJson(manifest), { flag: "wx" });
		await writePhpWasmPackageSet({ root: staging, model: built.model, report: packages.report, signal });
		signal?.throwIfAborted(); await absent(output);
		await rename(staging, output);
		return { ...manifest, output, targets: ["php-wasm"] };
	} catch(error)
	{
		await rm(staging, { recursive: true, force: true });
		if(error instanceof CanonicalBuildError) throw error;
		throw new CanonicalBuildError(error.code ?? "php-wasm-project-build-failed", error.message, { details: error.details });
	}
};
