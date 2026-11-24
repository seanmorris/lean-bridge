/** @file Execute the real Lean host-import ABI in the prepared single-threaded Wasm runtime. */
import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { javaScriptHostMembers } from "../../src/backends/javascript/host-members.mjs";
import { generateLeanHostObjectAdapters } from "../../src/backends/lean/host-object.mjs";
import { javascriptWasmOwnedPins as pins } from "../../src/build/javascript-wasm-toolchain.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { bindWasmHostMembers } from "../../src/runtime/wasm-host-members.mjs";
import { checkGeneratedHostWasm } from "./javascript-host-generated.mjs";

const input = resolve("tests/fixtures/javascript-host-meter");
const oracle = resolve("tests/fixtures/javascript-host-wasm");
const variable = name => {
	if(!process.env[name]) throw new Error("Set " + name + " to the prepared build input");
	return resolve(process.env[name]);
};

const setup = async t => {
	const sdk = variable("LEAN_BRIDGE_JS_EMSDK"), target = variable("LEAN_BRIDGE_JS_TARGET_RUNTIME");
	const runtime = variable("LEAN_BRIDGE_RUNTIME_ROOT"), prefix = variable("LEAN_BRIDGE_LEAN_PREFIX");
	const app = await mkdtemp(join(tmpdir(), "js-host-wasm-"));
	t.after(() => rm(app, {recursive: true, force: true}));
	const env = {...process.env, EMSDK: sdk, EM_CONFIG: join(sdk, ".emscripten"), LEAN_PATH: app, LEAN_SYSROOT: prefix, EMCC_CORES: "1"};
	const run = (command, args) => processBuildRunner.capture({command, args, cwd: app, env, timeoutMs: 240000})
		.catch(error => { t.diagnostic(error.details?.stderr || error.details?.stdout || error.message); throw error; });
	const lean = join(prefix, "bin/lean"), emcc = join(sdk, "upstream/emscripten/emcc");
	assert.equal((await run(lean, ["--githash"])).stdout.trim(), pins.leanCommit);
	assert.equal((await readFile(join(target, "source/.lean-wasm-patched"), "utf8")).trim(), pins.leanCommit + " " + pins.patchSetSha256 + " browser");
	assert.ok((await run(emcc, ["--version"])).stdout.split("\n")[0].endsWith(pins.emscriptenVersion + " (" + pins.emscriptenCommit + ")"));
	return {app,run,lean,emcc,target,runtime,input,oracle};
};

test("compiled Lean mutates JavaScript aliases, maps IO failure, and retires every object lease", {timeout: 480_000}, async t => {
	const {app,run,lean,emcc,target,runtime} = await setup(t);
	const ir = JSON.parse(await readFile(join(input, "lean-bridge.hosts.json"), "utf8")), model = javaScriptHostMembers(ir);
	const host = "LeanBridge/Host/Javascript.lean";
	await mkdir(join(app, "LeanBridge/Host"), {recursive: true});
	await writeFile(join(app, host), generateLeanHostObjectAdapters(ir)[host]);
	await copyFile(join(input, "Workshop.lean"), join(app, "Workshop.lean"));
	for(const name of ["HostProbe.lean", "provider.c", "entry.h"]) await copyFile(join(oracle, name), join(app, name));
	for(const [source, c] of [[host, "host"], ["Workshop.lean", "workshop"], ["HostProbe.lean", "probe"]])
		await run(lean, ["-j1", "-o", source.replace(/\.lean$/u, ".olean"), "-c", c + ".c", source]);
	const slots = ["create", "read", "identity", "getLevel", "setLevel"].map((name, i) => {
		const index = model.members.findIndex(d => d.id === "host:meter.Box." + name);
		assert.notEqual(index, -1);
		return "-DMETER_" + ["CREATE", "READ", "IDENTITY", "GET", "SET"][i] + "=" + index;
	});
	const flags = ["-O1", "-g0", "-fPIC", "-fvisibility=hidden", "-fwasm-exceptions", "-DLEAN_EMSCRIPTEN", "-I", join(target, "cmake/include")];
	for(const name of ["provider", "workshop", "probe"])
		await run(emcc, [...flags, ...slots, ...name === "probe" ? ["-include", "entry.h"] : [], "-c", name + ".c", "-o", name + ".o"]);
	await run(emcc, ["-O1", "-g0", "-fwasm-exceptions", "-sSIDE_MODULE=2", "-Wl,--no-entry", "-Wl,--export=lb_meter_control", "provider.o", "workshop.o", "probe.o", "-o", "meter.wasm"]);
	const {default: create} = await import(pathToFileURL(join(runtime, "main.mjs")));
	const wasm = await create({wasmBinary: await readFile(join(runtime, "main.wasm"))});
	assert.equal(wasm._bridge_lean_runtime_init(), 1);
	const calls = [], leases = new Map(), raised = new Error("host read failure");
	let next = 0, failRead = false, failures = 0, drops = 0;
	/** Actual application class used by all three compiled Lean calls. */
	class Meter
	{
		/**
		 * Create a new application object.
		 *
		 * @param n - Initial unsigned reading.
		 */
		constructor(n) { this.n = n; }
		/** Return the original object to Lean. */
		identity() { return this; }
		/**
		 * Change the underlying meter.
		 *
		 * @param n - Reading written through an alias.
		 */
		set level(n) { this.n = n; }
		/** Read the current level through a property. */
		get level() { return this.n; }
		/** Return the reading or throw exactly the application's error object. */
		read() { if(failRead) throw raised; return this.n; }
	}
	const send = bindWasmHostMembers(model, {Box: Meter});
	wasm.lbMeterOracle = {
		/**
		 * Deliver a synchronous Wasm request to the application dispatcher.
		 *
		 * @param slot - Member index derived from the authored contract.
		 * @param self - Opaque lease supplied by the C oracle.
		 * @param n - Scalar argument from Lean.
		 * @param out - Address of the Wasm reply slot.
		 */
		call(slot, self, n, out) {
			const m = model.members[slot], receiver = leases.get(self);
			const args = m.op === "constructor" ? [n >>> 0] : m.op === "set" ? [receiver, n >>> 0] : [receiver];
			calls.push(m.op + ":" + m.name);
			let value;
			try
			{ value = send(slot, args); }
			catch(error)
			{ assert.equal(error, raised); failures++; return 1; }
			if(typeof m.result === "number")
			{
				if(m.op === "method") assert.equal(value, receiver);
				leases.set(++next, value); value = next;
			}
			new DataView(wasm.HEAP8.buffer).setUint32(out, value ?? 0, true);
			return 0;
		}
		, release: key => { assert.ok(leases.delete(key), "double release or alien lease"); drops++; }
	};
	wasm.FS.writeFile("/meter.wasm", await readFile(join(app, "meter.wasm")));
	try
	{ await wasm.loadDynamicLibrary("/meter.wasm", {global: true, loadAsync: true, nodelete: true}); }
	finally
	{ wasm.FS.unlink("/meter.wasm"); }
	const symbol = wasm._malloc(32), frame = wasm._malloc(32);
	assert.ok(symbol && frame);
	try
	{
		wasm.HEAP8.set(new TextEncoder().encode("lb_meter_control\0"), symbol);
		for(const [n, negative, expected] of [[41, false, 42], [11, true, 0xdecafbad], [0xffff_fffd, false, 0xffff_fffe]])
		{
			calls.length = 0; failRead = negative;
			new DataView(wasm.HEAP8.buffer).setUint32(frame + 12, n, true);
			assert.equal(wasm._bridge_scalar_call(symbol, frame), 0);
			assert.equal(new DataView(wasm.HEAP8.buffer).getUint32(frame + 16, true), expected);
			assert.deepEqual(calls, ["constructor:create", "method:identity", "set:level", "get:level", "method:read"]);
			assert.equal(leases.size, 0, "last Lean reference did not release its JavaScript lease");
		}
		assert.deepEqual([failures, drops], [1, 6]);
	} finally
	{ wasm._free(frame); wasm._free(symbol); }
});

test("generated Wasm externs transport all nineteen scalars and nested JavaScript host calls", {timeout: 480_000}, async t => {
	await checkGeneratedHostWasm(await setup(t));
});
