/**
 * Native Perl target orchestration, kept separate from wasm32 build policies.
 *
 * @file
 */
import { mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { buildNativeComponent, buildNativeSharedRuntime } from "./native-component.mjs";
import { compileCpanXsVariant } from "./perl-xs.mjs";
import { stageCpanPackage, archiveCpanPackage, perlRuntimeVersion } from "../release/cpan-package.mjs";
import { installCpanArchive } from "../release/cpan-install.mjs";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { processBuildRunner } from "./process-runner.mjs";
import { CanonicalBuildError } from "./build-error.mjs";

/**
 * Validate author intent without accepting host build paths in source config.
 *
 * @param config - Parsed native source configuration to validate.
 */
export const validateNativeConfiguration = config => {
	const allowed = ["schemaVersion", "module", "modules", "exports", "resources", "arities", "cpanVersion"];
	if(!config || typeof config !== "object" || Array.isArray(config) || config.schemaVersion !== 1
    || Object.keys(config).some(key => !allowed.includes(key))) throw new TypeError("invalid lean-bridge.native.json fields or version");
	if(config.module !== undefined && !/^LeanBridge::[A-Za-z][A-Za-z0-9_]*(?:::[A-Za-z][A-Za-z0-9_]*)*$/.test(config.module)) throw new TypeError("invalid Perl module name");
	for(const key of ["modules", "exports", "resources"]) if(config[key] !== undefined && (!Array.isArray(config[key])
    || config[key].some(name => typeof name !== "string" || !/^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)*$/.test(name))
    || new Set(config[key]).size !== config[key].length)) throw new TypeError(`invalid native ${key}`);
	if(config.arities !== undefined && (!config.arities || Array.isArray(config.arities) || typeof config.arities !== "object"
    || Object.entries(config.arities).some(([name, arity]) => !/^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)*$/.test(name)
      || !Number.isSafeInteger(arity) || arity < 0 || arity > 32))) throw new TypeError("invalid native arities");
	if(config.cpanVersion !== undefined && !/^\d+\.\d{3}(?:_\d{2})?$/.test(config.cpanVersion)) throw new TypeError("invalid CPAN version");
	return config;
};

/**
 * Build Lean once, compile XS per Perl ABI, then archive the checked inputs.
 *
 * @param root0 - Named inputs for this native build or packaging operation.
 * @param root0.projectRoot - Ordinary Lean project root to compile without modifying source.
 * @param root0.outputRoot - New output directory; existing output must not be overwritten.
 * @param root0.environment - Explicit environment passed to build subprocesses.
 * @param root0.signal - Optional cancellation signal for child build processes.
 * @param root0.onProgress - Optional callback receiving build progress messages.
 */
export async function buildPerlProject({ projectRoot, outputRoot, environment = process.env, signal, onProgress })
{
	const project = resolve(projectRoot), output = resolve(outputRoot ?? join(project, "build/lean-bridge-perl"));
	if(output === project || project.startsWith(`${output}/`)) throw new CanonicalBuildError("invalid-output-root", "Perl output cannot replace the source project");
	try
	{ await readdir(output); throw new Error(`output already exists: ${output}`); }
	catch(error)
	{ if(error.code !== "ENOENT") throw error; }
	await mkdir(dirname(output), { recursive: true });
	const working = await mkdtemp(join(dirname(output), ".perl-project-"));
	try
	{
		let config = { schemaVersion: 1 };
		try
		{ config = validateNativeConfiguration(JSON.parse(await readFile(join(project, "lean-bridge.native.json"), "utf8"))); }
		catch(error)
		{ if(error.code !== "ENOENT") throw error; }
		const leanPrefix = environment.LEAN_BRIDGE_LEAN_PREFIX ?? (await processBuildRunner.capture({ command: "lean", args: ["--print-prefix"], cwd: project, env: environment, signal })).stdout.trim();
		const perls = environment.LEAN_BRIDGE_PERLS ? JSON.parse(environment.LEAN_BRIDGE_PERLS) : ["perl"];
		if(!Array.isArray(perls) || !perls.length || perls.some(perl => typeof perl !== "string" || !perl)) throw new TypeError("LEAN_BRIDGE_PERLS must be a JSON array of interpreter paths");
		const runtimeRoot = join(working, "native/runtime"), nativeRoot = join(working, "native/component");
		onProgress?.({ phase: "build", state: "info", message: "Compiling checked native Lean exports" });
		await buildNativeSharedRuntime({ outputRoot: runtimeRoot, leanPrefix });
		const built = await buildNativeComponent({ projectRoot: project
			, outputRoot: nativeRoot
			, runtimeRoot
			, leanPrefix
			, moduleName: config.module
			, modules: config.modules
			, exports: config.exports
			, resources: config.resources
			, arities: config.arities
			, signal });
		const version = config.cpanVersion ?? "0.001", floor = environment.LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR ?? "2.38";
		const runtimePackage = join(working, "packages/runtime"), componentPackage = join(working, "packages/component");
		await stageCpanPackage({ outputRoot: runtimePackage, runtimeRoot, leanPrefix, version: perlRuntimeVersion, glibcMinimumVersion: floor });
		await stageCpanPackage({ outputRoot: componentPackage, componentRoot: nativeRoot, runtimeRoot, leanPrefix, version, glibcMinimumVersion: floor });
		const archives = join(working, "archives"), installRoot = join(working, ".build-runtime");
		for(const perl of perls)
		{
			signal?.throwIfAborted();
			onProgress?.({ phase: "build", state: "info", message: `Compiling XS for ${perl}` });
			await compileCpanXsVariant({ packageRoot: runtimePackage, perl, environment });
			const runtimeArchive = await archiveCpanPackage({ packageRoot: runtimePackage, outputRoot: archives });
			const installed = await installCpanArchive({ archive: runtimeArchive.path, workingRoot: working, prefix: installRoot, perl, mode: "prebuilt-only", environment });
			await compileCpanXsVariant({ packageRoot: componentPackage, perl, environment: { ...environment, PERL5LIB: installed.perl5lib } });
		}
		const runtimeArchive = await archiveCpanPackage({ packageRoot: runtimePackage, outputRoot: archives });
		const componentArchive = await archiveCpanPackage({ packageRoot: componentPackage, outputRoot: archives });
		await rm(installRoot, { recursive: true, force: true });
		const manifest = { schemaVersion: 1
			, profile: "native-library-v1"
			, backend: "perl"
			, ecosystem: "cpan"
			, component: built.model.component
			, nativeRuntimeIdentity: built.receipt.runtimeIdentity
			, runtimeIdentity: runtimeArchive.receipt.runtimeIdentity
			, bindingIrSha256: built.model.bindingIrSha256
			, configurationSha256: sha256(canonicalJson(config))
			, glibcMinimumVersion: floor
			, packages: [runtimeArchive.receipt, componentArchive.receipt] };
		await writeFile(join(working, "native-release.json"), canonicalJson(manifest));
		await rename(working, output);
		return { schemaVersion: 1, project, output, targets: ["cpan"], ...manifest };
	} catch(error)
	{
		await rm(working, { recursive: true, force: true });
		if(error instanceof CanonicalBuildError) throw error;
		throw new CanonicalBuildError("native-perl-build-failed", error.message, { details: error.details });
	}
}
