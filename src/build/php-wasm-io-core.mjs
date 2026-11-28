/**
 * Compile the private synchronous IO objects for the single-threaded Zend host.
 * Nothing here is a public PHP FFI or a native Task scheduler.
 *
 * @file
 */
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson } from "../capsule/node.mjs";
import { compileHostSources } from "./host-elaboration.mjs";
import { readVerifiedPhpWasmCopiedRuntime } from "./php-wasm-copied-artifacts.mjs";
import { phpWasmToolchain } from "./php-wasm-copied-component.mjs";
import { linkPhpWasmIOExtension } from "./php-wasm-io-extension.mjs";
import { phpWasmIOCoreRecipe } from "./php-wasm-io-replay.mjs";
import { processBuildRunner } from "./process-runner.mjs";

/**
 * Stage generated objects in the caller's private workspace. The caller owns
 * final linking: a Zend extension must export get_module, not these wire symbols.
 *
 * @param options - Captured project sources, private app directory, and pinned tools and runtime.
 */
export const compilePhpWasmIOCore = async options => {
	const { app, projectContract: contract, leanPrefix, runtimeRoot, emsdkRoot, signal } = options;
	if(!contract?.synchronousIO || !Array.isArray(contract.nativeEffects) || contract.nativeEffects.length
		|| contract.ir || contract.hostImportsSourceSha256 !== null || contract.leanResources?.length
		|| contract.taskExports?.length || contract.asyncIterators?.length || contract.taskIOErrors?.length)
		throw new TypeError("PHP-Wasm synchronous IO requires explicit in-memory effects (nativeEffects: []) and no host, lease or scheduler contract");
	const runner = options.runner ?? processBuildRunner;
	const run = (command, args, cwd, env) => runner.capture({ command, args, cwd, env, signal });
	const runtime = await readVerifiedPhpWasmCopiedRuntime(runtimeRoot);
	const environment = options.environment ?? process.env;
	const lean = join(leanPrefix, "bin/lean");
	if((await run(lean, ["--githash"], app, environment)).stdout.trim() !== runtime.manifest.pins.leanCommit)
		throw new Error("PHP-Wasm IO requires the Lean compiler matching its target runtime");
	const compiler = await phpWasmToolchain(emsdkRoot, runner, signal);
	if(canonicalJson(compiler.compiler) !== canonicalJson(runtime.manifest.compiler)) throw new Error("PHP-Wasm IO compiler/runtime mismatch");
	const built = await compileHostSources({ app
		, sources: options.sources, projectContract: contract, ir: null
		, environment, run, leanPrefix, signal, target: "php-wasm" });
	const { componentIdentity, gen, wire, delivery, owner, integers } = await phpWasmIOCoreRecipe({ ...built, runtimeIdentity: runtime.identity });
	const save = (name, bytes) => writeFile(join(app, name), bytes, { flag: "wx" });
	await save("BridgeCAsync.lean", gen.entryLean);
	await run(join(leanPrefix, "bin/lean"), ["-j1", "-c", "entry.c", "BridgeCAsync.lean"], app, built.env);
	await save("checked-entry.c", `#include "entry.c"\n${gen.declarations}\n`);
	await save(gen.prefix + ".h", gen.header); await save("adapter.c", gen.source); await save("host-wire.c", wire.source);
	await save("task-delivery.h", delivery); await save("task-owner-policy.h", owner);
	if(integers) await save("task-integers.h", integers);
	const objects = [], flags = ["-O2"
		, "-g0", "-fPIC", "-fvisibility=hidden", "-ffp-contract=off"
		, "-DLEAN_EMSCRIPTEN"
		, "-Werror=implicit-function-declaration"
		, "-I"
		, join(runtimeRoot, "include")
		, `-ffile-prefix-map=${app}=/build/php-wasm-io`];
	for(const file of [...built.objects, "checked-entry.c", "adapter.c", "host-wire.c"])
	{
		const object = join(app, file.slice(0, -2) + ".o");
		await compiler.run(compiler.emcc, [...flags, "-c", join(app, file), "-o", object]); objects.push(object);
	}
	const core = { objects
		, wire, api: built.api, evidence: built.evidence, componentIdentity
		, runtimeIdentity: runtime.identity
		, runtimeLibrary: join(runtimeRoot, runtime.manifest.library) };
	if(options.zend) core.zend = await linkPhpWasmIOExtension({ ...options.zend, app, core, compiler, flags });
	await compiler.verify();
	if((await readVerifiedPhpWasmCopiedRuntime(runtimeRoot)).identity !== runtime.identity) throw new Error("PHP-Wasm IO runtime changed during build");
	return core;
};
