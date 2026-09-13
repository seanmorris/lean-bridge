/**
 * Implements the Lean component compiler module in the build subsystem.
 *
 * @file
 */

import { mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { processBuildRunner } from "./process-runner.mjs";
import { validateComponentCompilationPlan } from "./component-compilation-plan.mjs";
import { generateComponentScalarAdapters } from "./component-scalar-adapters.mjs";
import { validateCompilerAdapterPlan } from "./compiler-adapters.mjs";
import { readLakeDependencySnapshot, verifyLakeDependencySnapshot, writeLakeDependencySnapshot } from "./lake-dependency-snapshot.mjs";
import { resolveLakeBuildWorkspace } from "./lake-build-workspace.mjs";
import { lakeNativeInputs } from "./lake-native-inputs.mjs";
import { readExportConfiguration } from "../analyze/export-configuration.mjs";
import { createMetadataRequest, identifyLeanInterface } from "../analyze/elaborated-metadata.mjs";

/**
 * Reports Lean component compiler failures with stable machine-readable codes and structured diagnostic context.
 */
export class LeanComponentCompilerError extends Error
{
	/**
   * Initializes the error used to report Lean component compiler failures, preserving its code, message, and diagnostic context.
   *
   * @param code - Stable machine-readable code that identifies the failure category.
   * @param message - Human-readable explanation of the failure.
   * @param details - Structured diagnostic fields associated with the failure.
   */
	constructor(code, message, details = {})
	{
		super(message);
		this.name = "LeanComponentCompilerError";
		this.code = code;
		this.details = details;
	}
}

const fail = (code, message, details = {}) => {
	throw new LeanComponentCompilerError(code, message, details);
};

const assertAbsent = async output => {
	try
	{
		await stat(output);
		fail("lean-component-output-exists", `Lean component compiler output already exists: ${output}`);
	} catch(error)
	{
		if(error instanceof LeanComponentCompilerError) throw error;
		if(error.code !== "ENOENT") throw error;
	}
};

const readChecked = async (path, expected, label) => {
	const bytes = await readFile(path);
	if(expected.bytes !== undefined && bytes.length !== expected.bytes) fail("lean-component-input-drift", `${label} byte length changed`, { path, expected: expected.bytes, actual: bytes.length });
	const actual = sha256(bytes);
	if(actual !== expected.sha256) fail("lean-component-input-drift", `${label} identity changed`, { path, expected: expected.sha256, actual });
	return bytes;
};

const modulePaths = (root, module) => {
	const relative = module.replaceAll(".", "/");
	return Object.freeze({ olean: join(root, "olean", `${relative}.olean`), c: join(root, "c", `${relative}.c`) });
};

const parseLeanIdentity = output => {
	const version = output.match(/Lean \(version ([^,]+),/)?.[1] ?? null;
	const commit = output.match(/commit ([0-9a-f]{40}),/)?.[1] ?? null;
	if(version === null || commit === null) fail("unrecognized-lean-compiler", "Lean compiler did not report a reviewed version and Git identity", { output });
	return Object.freeze({ version, commit });
};

const compilerCommand = ({ engineRoot, environment }) => environment.LEAN_BRIDGE_LEAN
  ?? (environment.LEAN_WASM_HOST_LEAN_PREFIX === undefined ? null : join(environment.LEAN_WASM_HOST_LEAN_PREFIX, "bin/lean"))
  ?? join(resolve(engineRoot), ".toolchains/elan/bin/lean");

/**
 * Compiles lean component sources into the explicit representation consumed by the isolated component build pipeline.
 *
 * @param root0 - Named inputs and dependency overrides used to compile lean component sources.
 * @param root0.inputRoot - Filesystem root containing the input.
 * @param root0.outputRoot - Filesystem root containing the output.
 * @param root0.engineRoot - Filesystem root containing the engine.
 * @param root0.compilationPlan - Validated compilation plan binding authorized inputs, outputs, toolchain, and runtime profile.
 * @param root0.runner - Process runner used for isolated external commands.
 * @param root0.environment - Environment variables used to resolve tools and policy.
 */
export const compileLeanComponentSources = async ({
	inputRoot
	, outputRoot
	, engineRoot
	, compilationPlan
	, runner = processBuildRunner
	, environment = process.env
}) => {
	validateComponentCompilationPlan(compilationPlan.document);
	const inputs = resolve(inputRoot);
	const output = resolve(outputRoot);
	await assertAbsent(output);
	let lean = compilerCommand({ engineRoot, environment });
	const compilerEnvironment = {
		...environment
		, ELAN_HOME: environment.ELAN_HOME ?? join(resolve(engineRoot), ".toolchains/elan")
	};
	let identity;
	try
	{
		const probe = await runner.capture({ command: lean, args: ["--version"], cwd: inputs, env: compilerEnvironment, timeoutMs: 15_000 });
		identity = parseLeanIdentity(probe.stdout || probe.stderr);
	} catch(error)
	{
		if(error instanceof LeanComponentCompilerError) throw error;
		fail("lean-compiler-unavailable", "The pinned Lean compiler is unavailable", { cause: error.message, command: lean });
	}
	if(identity.commit !== compilationPlan.document.runtime.leanCommit) fail("lean-compiler-drift", "Lean compiler commit differs from the component runtime", { compiler: identity.commit, runtime: compilationPlan.document.runtime.leanCommit });
	const expectedToolchainVersion = compilationPlan.document.source.toolchain.match(/:v?(.+)$/)?.[1] ?? null;
	if(expectedToolchainVersion !== identity.version) fail("lean-toolchain-drift", "Lean compiler version differs from lean-toolchain", { compiler: identity.version, source: compilationPlan.document.source.toolchain });
	const staging = await mkdtemp(join(dirname(output), ".lean-bridge-target-c-"));
	const sourceByModule = new Map(compilationPlan.document.source.modules.map(module => [module.module, module]));
	const inputIdentities = new Map();
	let lake = null, snapshot = null;
	try
	{
		if(compilationPlan.document.schemaVersion >= 2)
		{
			snapshot = await readLakeDependencySnapshot({ snapshotRoot: join(inputs, "lake"), expectedSha256: compilationPlan.document.source.lakeSnapshotSha256 });
			const prefix = await runner.capture({ command: lean, args: ["--print-prefix"], cwd: inputs, env: compilerEnvironment, timeoutMs: 15000 });
			lake = await resolveLakeBuildWorkspace({ snapshot, modules: compilationPlan.document.source.requestedModules, leanPrefix: prefix.stdout.trim() });
			if(lake.resolution.leanCommit !== identity.commit || lake.resolution.leanVersion !== identity.version)
				fail("lean-compiler-drift", "Lake resolver differs from the selected component compiler");
			lean = join(prefix.stdout.trim(), "bin/lean");
			compilerEnvironment.LEAN_SYSROOT = prefix.stdout.trim();
			for(const module of lake.resolution.modules)
			{
				if(module.module === compilationPlan.document.compilerAdapters.module) fail("lean-component-input-drift", "Source module shadows the generated adapter");
				sourceByModule.set(module.module, { module: module.module, path: `${module.module.replaceAll(".", "/")}.lean`, bytes: module.source.bytes, sha256: module.source.sha256 });
			}
			const capturedRoot = new Map(snapshot.document.rootInputs.map(file => [file.path, file]));
			for(const module of compilationPlan.document.source.modules)
			{
				const actual = lake.resolution.modules.find(item => item.module === module.module);
				if((module.origin?.kind !== "generated" && (capturedRoot.get(module.path)?.sha256 !== module.sha256 || capturedRoot.get(module.path)?.bytes !== module.bytes))
					|| actual?.path !== `root/${module.path}` || actual.source.sha256 !== module.sha256 || actual.source.bytes !== module.bytes
					|| (module.origin && canonicalJson(module.origin) !== canonicalJson(actual.source.origin ?? { kind: "captured", snapshotSha256: snapshot.sha256 })))
					fail("lean-component-input-drift", "Planned root modules differ from the locked snapshot");
			}
			if(compilationPlan.document.schemaVersion >= 3 && (lake.generatedSources?.sha256 ?? null) !== compilationPlan.document.source.generatedSourcesSha256)
				fail("lean-component-input-drift", "Generated public sources changed after elaboration");
			if(lakeNativeInputs(lake.resolution).length || lake.generatedSources)
				await writeLakeDependencySnapshot({ snapshot, outputRoot: join(staging, "native") });
			if(lake.generatedSources) await writeFile(join(staging, "lake-generated-sources.json"), canonicalJson(lake.generatedSources.document), { mode: 0o444 });
		}
		const sourceOrder = lake ? lake.resolution.modules.map(module => module.module) : compilationPlan.document.source.compileOrder.slice(0, -1);
		const leanRoot = join(staging, "lean-root");
		for(const name of sourceOrder)
		{
			const module = sourceByModule.get(name);
			const path = lake ? join(lake.sourceRoot, module.path) : join(inputs, "source", module.path);
			const bytes = await readChecked(path, module, `Lean source module ${module.module}`);
			const compilePath = join(leanRoot, module.path);
			await mkdir(dirname(compilePath), { recursive: true });
			await writeFile(compilePath, bytes, { mode: 0o444 });
			inputIdentities.set(module.module, module.sha256);
		}
		const generatedPath = join(inputs, "generated/LeanBridgeGenerated.lean");
		const generatedBytes = await readChecked(generatedPath, { sha256: compilationPlan.document.compilerAdapters.leanSourceSha256 }, "generated Lean compiler adapter");
		const adapterPlan = JSON.parse(await readChecked(join(inputs, "generated/compiler-adapters.json"), { sha256: compilationPlan.document.compilerAdapters.planSha256 }, "compiler adapter plan"));
		validateCompilerAdapterPlan(adapterPlan);
		if(lake && canonicalJson([...adapterPlan.imports].sort()) !== canonicalJson(compilationPlan.document.source.requestedModules))
			fail("lean-component-input-drift", "Generated adapter imports differ from the selected root modules");
		const generatedSource = join(leanRoot, `${compilationPlan.document.compilerAdapters.module}.lean`);
		await writeFile(generatedSource, generatedBytes, { mode: 0o444 });
		inputIdentities.set(compilationPlan.document.compilerAdapters.module, compilationPlan.document.compilerAdapters.leanSourceSha256);
		const compileEnvironment = {
			...compilerEnvironment
			, LEAN_PATH: join(staging, "olean")
		};
		const records = [];
		for(const module of [...sourceOrder, compilationPlan.document.compilerAdapters.module])
		{
			const generated = module === compilationPlan.document.compilerAdapters.module;
			const source = generated ? generatedSource : join(leanRoot, sourceByModule.get(module).path);
			const paths = modulePaths(staging, module);
			await mkdir(dirname(paths.olean), { recursive: true });
			await mkdir(dirname(paths.c), { recursive: true });
			try
			{
				await runner.capture({
					command: lean
					, args: ["-R", leanRoot, "-o", paths.olean, "-c", paths.c, source]
					, cwd: inputs
					, env: compileEnvironment
					, timeoutMs: 5 * 60 * 1000
				});
			} catch(error)
			{
				fail("lean-component-compile-failed", `Lean failed to compile ${module}`, { module, cause: error.message, compilerDetails: error.details ?? null });
			}
			if(generated) await writeFile(paths.c, `${await readFile(paths.c, "utf8")}\n${generateComponentScalarAdapters(adapterPlan.privateAbi)}`);
			const [cBytes, oleanBytes] = await Promise.all([readFile(paths.c), readFile(paths.olean)]);
			records.push(Object.freeze({
				module
				, sourceSha256: inputIdentities.get(module)
				, targetC: `c/${module.replaceAll(".", "/")}.c`
				, targetCSha256: sha256(cBytes)
				, olean: `olean/${module.replaceAll(".", "/")}.olean`
				, oleanSha256: sha256(oleanBytes)
			}));
		}
		if(lake && (compilationPlan.document.schemaVersion >= 3 || lakeNativeInputs(lake.resolution).length || lake.generatedSources))
		{
			// Adding C inputs must not bypass the existing foreign/unsafe body gate.
			const checker = join(resolve(engineRoot), "src/analyze/NativeExports.lean");
			const request = join(staging, "native-body-request.json");
			const elaborated = compilationPlan.document.schemaVersion >= 3;
			const expectedBytes = elaborated ? await readChecked(join(inputs, "generated/lake-entry-exports.json"), { sha256: compilationPlan.document.source.elaborationSha256 }, "elaborated public API") : null;
			const rich = elaborated && JSON.parse(expectedBytes.toString()).schemaVersion === 3;
			if(elaborated && !rich) fail("lean-entry-elaboration-drift", "Target compilation requires the shared compiler metadata report");
			const configuration = elaborated ? (await readExportConfiguration(join(inputs, "source"))).configuration : null;
			let exportRequest = elaborated ? { modules: sourceOrder, exportModules: compilationPlan.document.source.requestedModules, exports: configuration.exports ?? [], resources: [], arities: [] }
				: { modules: sourceOrder, exports: adapterPlan.exports.map(item => item.sourceDeclaration), resources: [], arities: [] };
			const interfaces = [];
			if(rich)
			{
				for(const record of records.slice(0, -1)) interfaces.push({ module: record.module
					, sourceSha256: record.sourceSha256
					, ...await identifyLeanInterface(join(staging, record.olean)) });
				exportRequest = createMetadataRequest(exportRequest, { toolchain: compilationPlan.document.source.toolchain
					, snapshotSha256: snapshot.sha256
					, generatedSourcesSha256: lake.generatedSources?.sha256 ?? null
					, leanCompilerSha256: lake.document.leanCompilerSha256
					, extractorSha256: sha256(await readFile(checker))
					, modules: lake.resolution.modules.map((module, index) => ({ name: module.module, sourcePath: module.path, sourceSha256: module.source.sha256, interfaceSha256: interfaces[index].interfaceSha256 })) });
			}
			await writeFile(request, canonicalJson(exportRequest));
			try
			{
				const checked = await runner.capture({ command: lean, args: ["--run", checker, rich ? "--metadata" : "--check-bodies", request], cwd: inputs, env: compileEnvironment, timeoutMs: 120000 });
				if(elaborated)
				{
					const actual = { schemaVersion: 3
						, kind: "lean-bridge-lake-entry-elaboration"
						, snapshotSha256: snapshot.sha256
						, generatedSourcesSha256: lake.generatedSources?.sha256 ?? null
						, leanCompilerSha256: lake.document.leanCompilerSha256
						, extractorSha256: sha256(await readFile(checker))
						, request: exportRequest
						, interfaces
						, metadata: JSON.parse(checked.stdout) };
					if(expectedBytes.toString() !== canonicalJson(actual)) fail("lean-entry-elaboration-drift", "Freshly compiled public API differs from the elaborated adapter contract");
					if(rich) for(const record of interfaces)
						if((await identifyLeanInterface(modulePaths(staging, record.module).olean)).interfaceSha256 !== record.interfaceSha256)
							fail("lean-entry-elaboration-drift", "Lean interface metadata changed during target extraction");
				}
			} catch(error)
			{
				if(error instanceof LeanComponentCompilerError) throw error;
				fail("unreviewed-native-implementation", "Native C inputs do not authorize foreign or unsafe Lean implementations", { cause: error.message, compilerDetails: error.details ?? null });
			}
			await rm(request);
		}
		for(const module of compilationPlan.document.source.modules.filter(module => module.origin?.kind !== "generated")) await readChecked(join(inputs, "source", module.path), module, `Lean source module ${module.module}`);
		await readChecked(generatedPath, { sha256: compilationPlan.document.compilerAdapters.leanSourceSha256 }, "generated Lean compiler adapter");
		await readChecked(join(inputs, "generated/compiler-adapters.json"), { sha256: compilationPlan.document.compilerAdapters.planSha256 }, "compiler adapter plan");
		if(lake)
		{
			await verifyLakeDependencySnapshot({ snapshot, snapshotRoot: join(inputs, "lake") });
			await readChecked(lean, { sha256: lake.document.leanCompilerSha256 }, "Lean compiler");
			await lake.verify();
		}
		await rm(leanRoot, { recursive: true, force: true });
		const manifest = Object.freeze({
			schemaVersion: lake?.generatedSources ? 3 : lake ? 2 : 1
			, component: compilationPlan.document.component.id
			, compilationPlanSha256: compilationPlan.sha256
			, compiler: identity
			, target: "wasm32-unknown-emscripten-c"
			, modules: Object.freeze(records)
			, sourceReadOnly: true
			, ...(lake ? { lakeDependencies: lake.evidence } : {})
		});
		await writeFile(join(staging, "lean-target-c-manifest.json"), canonicalJson(manifest));
		await rename(staging, output);
		return Object.freeze({ output, manifest, manifestSha256: sha256(canonicalJson(manifest)) });
	} catch(error)
	{
		await rm(staging, { recursive: true, force: true });
		throw error;
	}
	finally
	{
		await lake?.dispose();
	}
};
