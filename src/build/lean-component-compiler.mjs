import { mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { processBuildRunner } from "./process-runner.mjs";
import { validateComponentCompilationPlan } from "./component-compilation-plan.mjs";

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
	const lean = compilerCommand({ engineRoot, environment });
	const compilerEnvironment = {
		...environment,
		ELAN_HOME: environment.ELAN_HOME ?? join(resolve(engineRoot), ".toolchains/elan")
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
	try
	{
		const leanRoot = join(staging, "lean-root");
		for(const module of compilationPlan.document.source.modules)
		{
			const path = join(inputs, "source", module.path);
			const bytes = await readChecked(path, module, `Lean source module ${module.module}`);
			const compilePath = join(leanRoot, module.path);
			await mkdir(dirname(compilePath), { recursive: true });
			await writeFile(compilePath, bytes, { mode: 0o444 });
			inputIdentities.set(module.module, module.sha256);
		}
		const generatedPath = join(inputs, "generated/LeanBridgeGenerated.lean");
		const generatedBytes = await readChecked(generatedPath, { sha256: compilationPlan.document.compilerAdapters.leanSourceSha256 }, "generated Lean compiler adapter");
		await writeFile(join(leanRoot, "LeanBridgeGenerated.lean"), generatedBytes, { mode: 0o444 });
		inputIdentities.set(compilationPlan.document.compilerAdapters.module, compilationPlan.document.compilerAdapters.leanSourceSha256);
		const compileEnvironment = {
			...compilerEnvironment,
			LEAN_PATH: join(staging, "olean")
		};
		const records = [];
		for(const module of compilationPlan.document.source.compileOrder)
		{
			const generated = module === compilationPlan.document.compilerAdapters.module;
			const source = generated ? join(leanRoot, "LeanBridgeGenerated.lean") : join(leanRoot, sourceByModule.get(module).path);
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
		for(const module of compilationPlan.document.source.modules) await readChecked(join(inputs, "source", module.path), module, `Lean source module ${module.module}`);
		await readChecked(generatedPath, { sha256: compilationPlan.document.compilerAdapters.leanSourceSha256 }, "generated Lean compiler adapter");
		await rm(leanRoot, { recursive: true, force: true });
		const manifest = Object.freeze({
			schemaVersion: 1
			, component: compilationPlan.document.component.id
			, compilationPlanSha256: compilationPlan.sha256
			, compiler: identity
			, target: "wasm32-unknown-emscripten-c"
			, modules: Object.freeze(records)
			, sourceReadOnly: true
		});
		await writeFile(join(staging, "lean-target-c-manifest.json"), canonicalJson(manifest));
		await rename(staging, output);
		return Object.freeze({ output, manifest, manifestSha256: sha256(canonicalJson(manifest)) });
	} catch(error)
	{
		await rm(staging, { recursive: true, force: true });
		throw error;
	}
};
