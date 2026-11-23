/**
 * Compile the private synchronous IO objects for the single-threaded Zend host.
 * Nothing here is a public PHP FFI or a native Task scheduler.
 *
 * @file
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../capsule/node.mjs";
import { generateCTaskExports } from "../backends/c/task-exports.mjs";
import { generateSyncWire } from "../backends/c/sync-wire.mjs";
import { compileHostSources } from "./host-elaboration.mjs";
import { readVerifiedPhpWasmCopiedRuntime } from "./php-wasm-copied-artifacts.mjs";
import { phpWasmToolchain } from "./php-wasm-copied-component.mjs";
import { processBuildRunner } from "./process-runner.mjs";

const asset = path => readFile(new URL("../backends/c/" + path, import.meta.url), "utf8");

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
	const common = { name: "php-wasm-" + sha256(contract.component.id)
		, modules: contract.modules
		, entries: built.entries, synchronousIO: true, integerMode: "words" };
	const skeleton = generateCTaskExports({ ...common, componentIdentity: "0".repeat(64) });
	const wire = generateSyncWire(skeleton.prefix, built.entries, { phpWasm: true });
	const delivery = await asset("task-delivery.h"), integers = skeleton.integerMode ? await asset("task-integers.h") : "";
	const owner = `#if !defined(__wasm32__) || !defined(__EMSCRIPTEN__) || defined(__EMSCRIPTEN_PTHREADS__) || !LB_SYNC_ONLY
#error Expected synchronous IO on a single-threaded PHP-Wasm instance
#endif
static int lb_context(void) { return lean_bridge_native_process_valid(); }
`;
	const componentIdentity = sha256(canonicalJson({ runtime: runtime.identity
		, evidence: built.evidence
		, skeleton
		, wire: sha256(wire.source)
		, delivery: sha256(delivery)
		, owner: sha256(owner)
		, integers: sha256(integers) }));
	const gen = generateCTaskExports({ ...common, componentIdentity });
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
	await compiler.verify();
	if((await readVerifiedPhpWasmCopiedRuntime(runtimeRoot)).identity !== runtime.identity) throw new Error("PHP-Wasm IO runtime changed during build");
	return { objects
		, wire, api: built.api, evidence: built.evidence, componentIdentity
		, runtimeIdentity: runtime.identity
		, runtimeLibrary: join(runtimeRoot, runtime.manifest.library) };
};
