/**
 * Implements the component side linker module in the build subsystem.
 *
 * @file
 */

import { mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { processBuildRunner } from "./process-runner.mjs";
import { validateComponentCompilationPlan } from "./component-compilation-plan.mjs";

/**
 * Reports component side linker failures with stable machine-readable codes and structured diagnostic context.
 */
export class ComponentSideLinkerError extends Error
{
	/**
   * Initializes the error used to report component side linker failures, preserving its code, message, and diagnostic context.
   *
   * @param code - Stable machine-readable code that identifies the failure category.
   * @param message - Human-readable explanation of the failure.
   * @param details - Structured diagnostic fields associated with the failure.
   */
	constructor(code, message, details = {})
	{
		super(message);
		this.name = "ComponentSideLinkerError";
		this.code = code;
		this.details = details;
	}
}

const fail = (code, message, details = {}) => {
	throw new ComponentSideLinkerError(code, message, details);
};

const assertAbsent = async output => {
	try
	{
		await stat(output);
		fail("component-side-output-exists", `Component side-module output already exists: ${output}`);
	} catch(error)
	{
		if(error instanceof ComponentSideLinkerError) throw error;
		if(error.code !== "ENOENT") throw error;
	}
};

const linkerCommand = ({ engineRoot, environment }) => environment.LEAN_BRIDGE_EMCC
  ?? (environment.LEAN_WASM_EMSDK === undefined ? null : join(environment.LEAN_WASM_EMSDK, "upstream/emscripten/emcc"))
  ?? join(resolve(engineRoot), ".toolchains/emsdk/upstream/emscripten/emcc");

const linkerIdentity = output => {
	const version = output.match(/emcc .*? ([0-9]+(?:\.[0-9]+)+) \(([0-9a-f]{40})\)/)?.[1] ?? null;
	const commit = output.match(/emcc .*? [0-9]+(?:\.[0-9]+)+ \(([0-9a-f]{40})\)/)?.[1] ?? null;
	if(version === null || commit === null) fail("unrecognized-emscripten-linker", "Emscripten did not report a reviewed version and Git identity", { output });
	return Object.freeze({ version, commit });
};

const runtimeRoot = ({ engineRoot, compilationPlan, environment }) => environment.LEAN_BRIDGE_RUNTIME_ROOT ?? join(
	resolve(engineRoot),
	"build/lean-runtime",
	`${compilationPlan.document.runtime.leanCommit}-${compilationPlan.document.runtime.patchSetSha256}-browser`,
);

const verifyTargetCManifest = async ({ targetC, compilationPlan }) => {
	const path = join(targetC, "lean-target-c-manifest.json");
	const bytes = await readFile(path);
	const manifest = JSON.parse(bytes);
	if(manifest?.schemaVersion !== 1 || manifest.component !== compilationPlan.document.component.id || manifest.compilationPlanSha256 !== compilationPlan.sha256 || manifest.target !== "wasm32-unknown-emscripten-c" || manifest.sourceReadOnly !== true) fail("target-c-manifest-drift", "Target C manifest does not match the component compilation plan");
	if(!Array.isArray(manifest.modules) || JSON.stringify(manifest.modules.map(module => module.module)) !== JSON.stringify(compilationPlan.document.source.compileOrder)) fail("target-c-manifest-drift", "Target C modules do not match the planned compile order");
	for(const module of manifest.modules)
	{
		if(typeof module.targetC !== "string" || module.targetC.startsWith("/") || module.targetC.split("/").includes("..") || !/^[0-9a-f]{64}$/.test(module.targetCSha256)) fail("invalid-target-c-manifest", `Invalid target C record for ${module.module}`);
		const source = await readFile(join(targetC, module.targetC));
		if(sha256(source) !== module.targetCSha256) fail("target-c-drift", `Target C changed before linking: ${module.module}`);
	}
	return Object.freeze({ manifest, sha256: sha256(bytes) });
};

const internalInitializerName = component => `lean_bridge_internal_initialize_${sha256(component).slice(0, 16)}`;

const initializationShim = ({ initializer, internalInitializer }) => `#include <lean/lean.h>
#include <stdint.h>

typedef lean_object *(*lean_bridge_initializer_fn)(uint8_t);

extern lean_object *${initializer}(uint8_t builtin);

static lean_bridge_initializer_fn volatile lean_bridge_component_initializer = ${initializer};

LEAN_EXPORT lean_object *${internalInitializer}(uint8_t builtin) {
  return lean_bridge_component_initializer(builtin);
}
`;

const normalizeMap = ({ map, replacements }) => {
	let result = map;
	for(const [absolute, canonical] of replacements.sort(([left], [right]) => right.length - left.length)) result = result.replaceAll(absolute, canonical);
	return result;
};

/**
 * Verifies the target-C closure and pinned runtime, then links the authorized component side module with deterministic metadata.
 *
 * @param root0 - Verified input roots, compilation plan, and process boundary used for linking.
 * @param root0.targetCRoot - Lean target-C tree whose manifest and generated sources will be linked.
 * @param root0.outputRoot - Absent destination created for the side module and link manifest.
 * @param root0.engineRoot - Pinned component-engine checkout containing runtime headers and toolchain policy.
 * @param root0.compilationPlan - Authorized output names, runtime profile, and input identities for the link.
 * @param root0.runner - Process runner used for isolated external commands.
 * @param root0.environment - Environment used to resolve the pinned Emscripten and runtime closures.
 */
export const linkComponentSideModule = async ({
	targetCRoot
	, outputRoot
	, engineRoot
	, compilationPlan
	, runner = processBuildRunner
	, environment = process.env
}) => {
	validateComponentCompilationPlan(compilationPlan.document);
	const targetC = resolve(targetCRoot);
	const output = resolve(outputRoot);
	await assertAbsent(output);
	const targetManifest = await verifyTargetCManifest({ targetC, compilationPlan });
	const emcc = linkerCommand({ engineRoot, environment });
	let identity;
	try
	{
		const probe = await runner.capture({ command: emcc, args: ["--version"], cwd: targetC, env: environment, timeoutMs: 15_000 });
		identity = linkerIdentity(probe.stdout || probe.stderr);
	} catch(error)
	{
		if(error instanceof ComponentSideLinkerError) throw error;
		fail("emscripten-linker-unavailable", "The pinned Emscripten linker is unavailable", { cause: error.message, command: emcc });
	}
	const runtime = resolve(runtimeRoot({ engineRoot, compilationPlan, environment }));
	const includes = [join(runtime, "cmake/include"), join(runtime, "source/src/include")];
	for(const path of includes)
	{
		try
		{
			await stat(join(path, "lean/lean.h"));
		} catch(error)
		{
			fail("shared-runtime-headers-unavailable", "The shared runtime header closure is unavailable", { path, cause: error.message });
		}
	}
	await mkdir(dirname(output), { recursive: true });
	const staging = await mkdtemp(join(dirname(output), ".lean-bridge-side-module-"));
	try
	{
		const internalInitializer = internalInitializerName(compilationPlan.document.component.id);
		const shim = initializationShim({ initializer: compilationPlan.document.compilerAdapters.initializer, internalInitializer });
		const shimPath = join(staging, "generated/component-initializer.c");
		const sideModulePath = join(staging, compilationPlan.document.outputs.sideModule);
		const linkMapPath = join(staging, compilationPlan.document.outputs.linkMap);
		await mkdir(dirname(shimPath), { recursive: true });
		await mkdir(dirname(sideModulePath), { recursive: true });
		await mkdir(dirname(linkMapPath), { recursive: true });
		await writeFile(shimPath, shim);
		const exports = [...compilationPlan.document.compilerAdapters.directSymbols, compilationPlan.document.compilerAdapters.initializer, internalInitializer].sort();
		const cInputs = targetManifest.manifest.modules.map(module => join(targetC, module.targetC));
		const flags = [
			"-O2", "-fwasm-exceptions", "-flto", "-fPIC", "-ffp-contract=off"
			, `-ffile-prefix-map=${targetC}=/workspace/target-c`
			, `-fdebug-prefix-map=${targetC}=/workspace/target-c`
			, `-fmacro-prefix-map=${targetC}=/workspace/target-c`
			, `-ffile-prefix-map=${runtime}=/workspace/runtime`
			, `-fdebug-prefix-map=${runtime}=/workspace/runtime`
			, `-fmacro-prefix-map=${runtime}=/workspace/runtime`
			, ...includes.map(path => `-I${path}`)
			, "-sSIDE_MODULE=2", "-Wl,--no-entry"
			, ...exports.map(symbol => `-Wl,--export=${symbol}`)
			, `-Wl,-Map=${linkMapPath}`
			, "-o", sideModulePath
		];
		try
		{
			await runner.capture({ command: emcc, args: [...cInputs, shimPath, ...flags], cwd: staging, env: environment, timeoutMs: 10 * 60 * 1000 });
		} catch(error)
		{
			fail("component-side-link-failed", "Emscripten failed to link the component side module", { cause: error.message, linkerDetails: error.details ?? null });
		}
		const [wasm, rawMap] = await Promise.all([readFile(sideModulePath), readFile(linkMapPath, "utf8")]);
		const normalizedMap = normalizeMap({ map: rawMap, replacements: [[staging, "/workspace/output"], [targetC, "/workspace/target-c"], [runtime, "/workspace/runtime"], [resolve(engineRoot), "/workspace/engine"]] });
		await writeFile(linkMapPath, normalizedMap);
		const manifest = Object.freeze({
			schemaVersion: 1
			, component: compilationPlan.document.component.id
			, compilationPlanSha256: compilationPlan.sha256
			, targetCManifestSha256: targetManifest.sha256
			, linker: identity
			, profile: "side-module-2"
			, artifact: Object.freeze({ path: compilationPlan.document.outputs.sideModule, bytes: wasm.length, sha256: sha256(wasm) })
			, linkMap: Object.freeze({ path: compilationPlan.document.outputs.linkMap, sha256: sha256(normalizedMap) })
			, generatedInitializer: Object.freeze({ path: "generated/component-initializer.c", sha256: sha256(shim), symbol: internalInitializer })
			, exports: Object.freeze({ directSymbols: compilationPlan.document.compilerAdapters.directSymbols, initializer: compilationPlan.document.compilerAdapters.initializer, internalInitializer })
			, policies: Object.freeze({ linksRuntime: false, importsSharedMemory: true, importsSharedTable: true, publicGenericDispatch: false })
		});
		await writeFile(join(staging, "side-module-link-manifest.json"), canonicalJson(manifest));
		await rename(staging, output);
		return Object.freeze({ output, manifest, manifestSha256: sha256(canonicalJson(manifest)) });
	} catch(error)
	{
		await rm(staging, { recursive: true, force: true });
		throw error;
	}
};
