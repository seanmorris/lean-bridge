/** @file Compile a real Lean task with pthreads and run its offline-installed probe package. */
import assert from "node:assert/strict";
import test from "node:test";
import { execFile } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { javascriptWasmOwnedPins as pins } from "../../src/build/javascript-wasm-owned-artifacts.mjs";
import { runInstalledChromium } from "./javascript-wasm-installed-browser.mjs";
import { taskInitIdentity as probeInitIdentity } from "../../src/build/javascript-wasm-task-init-identity.mjs";
import { buildTaskPlugins, threadedPluginNames } from "./javascript-wasm-task-plugins.mjs";

const run = promisify(execFile), name = "@example/threaded-lean-task-probe";
test("offline npm consumer settles and cancels genuine pthread Lean tasks", {
	skip: process.env.LEAN_BRIDGE_JS_THREADED_TASK_TEST !== "1", timeout: 900000
}, async t => {
	const runtime = resolve(process.env.LEAN_BRIDGE_JS_THREAD_CORE);
	const sdk = resolve(process.env.LEAN_BRIDGE_JS_EMSDK), lean = join(resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX), "bin/lean");
	const root = await mkdtemp(join(tmpdir(), "js-threaded-task-"));
	t.after(() => rm(root, {recursive: true, force: true}));
	const source = resolve("tests/fixtures/javascript-wasm-task-runtime"), consumer = join(root, "consumer"), pkg = join(root, "package");
	const registry = resolve("src/runtime/pending-operations.mjs");
	const env = {...process.env, EMSDK: sdk, EM_CONFIG: join(sdk, ".emscripten"), EMCC_CORES: "1", BINARYEN_CORES: "1"};
	const command = (cmd, args, cwd = root, timeout = 60000) => run(cmd, args, {cwd, env, timeout, maxBuffer: 4 << 20});
	assert.equal((await command(lean, ["--githash"])).stdout.trim(), pins.leanCommit);
	const emcc = join(sdk, "upstream/emscripten/emcc");
	assert.ok((await command(emcc, ["--version"])).stdout.split("\n")[0].endsWith(` ${pins.emscriptenVersion} (${pins.emscriptenCommit})`), "wrong Emscripten toolchain");
	const stampCommand = 'source scripts/lean-runtime-config.sh; echo "$LEAN_WASM_LEAN_COMMIT $LEAN_WASM_PATCH_SET_SHA $LEAN_WASM_RUNTIME_PROFILE"';
	const profile = {...env, LEAN_WASM_PROJECT_ROOT: process.cwd(), LEAN_WASM_RUNTIME_PROFILE: "threaded-task"};
	const {stdout: stamp} = await run("bash", ["-c", stampCommand], {env: profile});
	assert.equal((await readFile(join(runtime, "source/.lean-wasm-patched"), "utf8")).trim(), stamp.trim());
	assert.match(await readFile(join(runtime, "cmake/CMakeCache.txt"), "utf8"), /^MULTI_THREAD:BOOL=ON$/mu);
	await mkdir(pkg); await mkdir(consumer);
	await command(lean, ["-j1", "-R", source, "-c", join(root, "ThreadProbe.c"), join(source, "ThreadProbe.lean")]);
	const core = join(runtime, "cmake"), lib = join(core, "lib/lean");
	const backend = resolve("src/backends/javascript");
	const config = ["--offline", "--ignore-scripts", "--cache", join(root, "cache")];
	const shared = process.env.LEAN_BRIDGE_JS_TASK_PLUGINS === "1";
	const plugins = shared ? await buildTaskPlugins({lean, emcc, root, core, command, npmConfig: config}) : null;
	const archive = process.env.LEAN_BRIDGE_JS_THREAD_INIT ?? join(lib, "libInit.a");
	if(process.env.LEAN_BRIDGE_JS_THREAD_INIT)
	{
		const receipt = JSON.parse(await readFile(join(dirname(archive), "inputs.json"), "utf8"));
		assert.equal(receipt.commit, pins.leanCommit);
		assert.deepEqual(receipt.identity, await probeInitIdentity(runtime, archive), "Init archive does not match the pinned threaded build");
	}
	const flags = ["-O2", "-g0", "-flto", "-pthread", "-fwasm-exceptions"
		, "-DLEAN_EMSCRIPTEN", "-DLEAN_MULTI_THREAD", "-I", root
		, "-I", join(core, "include"), "-I", backend
		, join(source, "task-probe.c"), join(backend, "task-notification.c")
		, join(lib, "libleanrt.a"), join(core, "libuv/src/libuv/libuv.a")
		, archive
		, "-sDEFAULT_TO_CXX=1", "-sMODULARIZE=1", "-sEXPORT_ES6=1"
		, "-sPTHREAD_POOL_SIZE=2", "-sPTHREAD_POOL_SIZE_STRICT=2"
		, "-sENVIRONMENT=node,web,worker", "-sINITIAL_MEMORY=67108864"
		, ...(plugins?.flags ?? ["-sEXPORTED_RUNTIME_METHODS=PThread"])
		, "-Wl,--fatal-warnings"
		, "-Wl,--no-entry", "-o", join(pkg, "task.mjs")];
	// A cold Emscripten cache also builds its PIC pthread C/C++ libraries.
	// Give only compilation extra time; consumer liveness still has a deadline.
	await command(emcc, flags, root, 600000);
	if(shared)
	{
		const main = await WebAssembly.compile(await readFile(join(pkg, "task.wasm")));
		const symbols = new Set(WebAssembly.Module.exports(main).map(s => s.name));
		for(const s of ["initialize_ThreadProbe", "initialize_TaskPeer", "lean_bridge_probe_start", "lean_bridge_task_peer_map"])
			assert.equal(symbols.has(s), false, "component implementation leaked into the runtime: " + s);
	}
	await copyFile(registry, join(pkg, "pending-operations.mjs"));
	await copyFile(resolve("src/runtime/wasm-task-notifications.mjs"), join(pkg, "wasm-task-notifications.mjs"));
	await copyFile(join(source, "index.mjs"), join(pkg, "index.mjs"));
	await writeFile(join(pkg, "package.json"), JSON.stringify({name, version: "0.0.0", type: "module", private: true, exports: "./index.mjs"}));
	const [{filename}] = JSON.parse((await command("npm", ["pack", "--json", ...config], pkg)).stdout);
	await writeFile(join(consumer, "package.json"), '{"private":true,"type":"module"}');
	const packages = [join(pkg, filename), ...(plugins?.archives ?? [])];
	await command("npm", ["install", "--no-audit", "--no-fund", ...config, ...packages], consumer);
	await copyFile(join(source, "consumer.mjs"), join(consumer, "calls.mjs"));
	const imports = shared ? 'import * as producer from "' + threadedPluginNames[0] + '";import * as peer from "' + threadedPluginNames[1] + '";' : "";
	if(shared)
	{
		const missing = imports + 'import {openProbe} from "' + name + '";import assert from "node:assert/strict";'
			+ 'await assert.rejects(openProbe({producer:peer,peer:producer}), /Could not initialize threaded Lean/);';
		await writeFile(join(consumer, "wrong-components.mjs"), missing);
		await command(process.execPath, ["wrong-components.mjs"], consumer);
	}
	await writeFile(join(consumer, "node.mjs"), imports + 'import * as api from "' + name + '";import {exercise} from "./calls.mjs";console.log(JSON.stringify(await exercise(api' + (shared ? ",{producer,peer}" : "") + ')));\n');
	const result = {checks: 23, resolved: 1, cancelled: 3, live: 0};
	// Each fresh process has no server or test runner to keep a pending await
	// alive. It must stay alive through native drain, then exit by itself.
	const nodeProcesses = 4;
	for(let i = 0; i < nodeProcesses; ++i)
		assert.deepEqual(JSON.parse((await command(process.execPath, ["node.mjs"], consumer)).stdout), result);
	const evaluate = async ([coordinate, producer, peer]) => {
		if(!globalThis.crossOriginIsolated) throw new Error("Threaded page must be cross-origin isolated");
		const components = producer ? {producer: await import(producer), peer: await import(peer)} : undefined;
		return (await import("/calls.mjs")).exercise(await import(coordinate), components);
	};
	const names = shared ? [name, ...threadedPluginNames] : [name];
	const chromium = await runInstalledChromium({root, consumer, names
		, isolated: true, timeoutMs: 60000, argument: names, evaluate});
	assert.deepEqual(chromium, result); t.diagnostic(JSON.stringify({names, nodeProcesses, node: result, chromium}));
});
