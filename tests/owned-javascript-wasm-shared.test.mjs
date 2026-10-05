/**
 * Actual legacy/owned side-module coexistence in the existing browser runtime.
 * Both source paths must initialize once and obey the same retirement state.
 *
 * @file
 */
import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { generateOwnedWasmBroker } from "../src/backends/javascript/owned-wasm-broker.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { compileOwnedJavaScriptWasmFixture } from "./helpers/owned-javascript-wasm-native.mjs";
import { ownedDotnetCallbacksReviewedIr } from "./helpers/owned-dotnet-callback-fixture.mjs";
import { compileJavaScriptProjection } from "../src/backends/javascript/projection.mjs";
import { alphaPrivateAbi } from "../poc/lean-link-spike/private-abi.mjs";
import alphaBindingIr from "../poc/lean-link-spike/bindings/alpha.binding-ir.json" with { type: "json" };

test("owned Wasm broker delegates every lifecycle transition to the existing runtime", () => {
	const broker = generateOwnedWasmBroker();
	assert.deepEqual(generateOwnedWasmBroker(), broker);
	assert.doesNotMatch(broker.source, /lean_initialize_runtime_module|initialize_Init\(|lean_init_task_manager\(|lean_finalize_task_manager\(|static uint32_t runtime_state|static uint32_t runtime_init_runs/u);
	assert.match(broker.source, /\.runtime_state = bridge_lean_runtime_status\(\)/u);
	assert.match(broker.source, /\.runtime_init_runs = bridge_lean_runtime_init_runs\(\)/u);
	assert.match(broker.source, /bridge_lean_runtime_component_initialize/u);
	assert.match(broker.source, /bridge_lean_runtime_retire\(\)/u);
	assert.match(broker.source, /UINTPTR_MAX >> 12/u);
	assert.match(broker.source, /attached_components \|\| live_identities/u);
	assert.equal(broker.exports.length, new Set(broker.exports).size);
	assert.ok(broker.exports.includes("lb_native_callback_register"));
	assert.ok(broker.exports.includes("lean_bridge_native_runtime_retire"));
});

test("the isolated core source boundary emits the shared ownership broker", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-owned-wasm-core-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const boundary = JSON.parse(await readFile("nix/core-source-boundary.json", "utf8"));
	for(const path of boundary.includedFiles)
	{
		const target = join(directory, path);
		await mkdir(dirname(target), { recursive: true }); await copyFile(path, target);
	}
	await processBuildRunner.capture({ command: process.execPath
		, args: ["scripts/generate-owned-wasm-broker.mjs", "generated"]
		, cwd: directory, timeoutMs: 30000 });
	const broker = generateOwnedWasmBroker();
	assert.equal(await readFile(join(directory, "generated/owned-runtime.c"), "utf8"), broker.source);
	assert.equal(await readFile(join(directory, "generated/lean_bridge_native_runtime.h"), "utf8"), broker.header);
	assert.deepEqual((await readFile(join(directory, "generated/owned-runtime-exports.txt"), "utf8")).trim().split("\n")
		, [...broker.exports, ...broker.supportExports].map(name => "_" + name).sort());
	await processBuildRunner.capture({ command: process.execPath
		, args: ["scripts/generate-lean-link-projection.mjs"]
		, cwd: directory, timeoutMs: 30000 });
	assert.deepEqual(JSON.parse(await readFile(join(directory, "poc/lean-link-spike/bindings/alpha.javascript-projection.json"), "utf8"))
		, compileJavaScriptProjection(alphaBindingIr, alphaPrivateAbi));
});

for(const reviewed of [false, true]) test(`one real shared heap runs ${reviewed ? "legacy-first reviewed" : "owned-first ordinary"} Lean components`, {
	skip: process.env.LEAN_BRIDGE_OWNED_JS_WASM_TEST !== "1", timeout: 600000
}, async t => {
	const f = await compileOwnedJavaScriptWasmFixture(t, "owned-dotnet-callables", {
		hostCallbacks: true, sharedRuntime: true, publicLoader: true
		, alphaFirst: reviewed
		, ...reviewed ? { reviewedIr: ownedDotnetCallbacksReviewedIr() } : {}
	});
	const { module, call } = f;
	assert.equal(module._bridge_lean_runtime_status(), 2);
	assert.equal(module._bridge_lean_runtime_init_runs(), 1);
	assert.equal(module._owned_initializations(), 1);
	assert.equal(module._bridge_owned_runtime_component_initializations(), 1);
	assert.equal(module._bridge_lean_library_init_runs(), reviewed ? 2 : 1);
	assert.equal(module._bridge_owned_runtime_components(), 1);
	await f.shared.loadLegacy();
	assert.equal(module._bridge_lean_library_init_runs(), 2);
	const legacy = module._bridge_lean_alpha_make(42); assert.ok(legacy);
	assert.equal(module._bridge_lean_alpha_read(legacy), 42);
	const ticket = call("newTicket", 73n, "shared"), bundle = { primary: ticket
		, spare: { tag: "none" }, peers: [ticket], history: [ticket]
		, payload: { count: 1n << 130n, bytes: new Uint8Array([0, 255]) } };
	assert.equal(call("serial", ticket), 73n);
	let borrowed, retained;
	assert.deepEqual(call("callbackRecord", bundle, value => {
		assert.equal(module._bridge_lean_alpha_read(legacy), 42);
		assert.equal(module._bridge_lean_runtime_shutdown(), 0);
		assert.equal(module._owned_close(), 8);
		borrowed = value.primary; retained = borrowed.retain();
		assert.equal(call("serial", borrowed), 73n); return value;
	}), bundle);
	assert.equal(borrowed.disposed, true);
	assert.equal(call("serial", retained), 73n); retained.dispose();
	const dispatch = call("dispatch", bundle);
	assert.deepEqual(dispatch(value => { assert.equal(module._bridge_lean_alpha_read(legacy), 42); return value; }), bundle);
	dispatch.dispose();
	const failure = new Error("application callback failed");
	assert.throws(() => call("callbackRecord", bundle, () => { throw failure; }), error => error === failure);
	assert.equal(call("serial", ticket), 73n);
	assert.equal(module._bridge_lean_runtime_init_runs(), 1);
	assert.equal(module._bridge_lean_library_init_runs(), 2);
	assert.equal(module._bridge_lean_runtime_shutdown(), 0);
	ticket.dispose();
	assert.equal(module._owned_results(), 0); assert.equal(module._owned_live(), 0);
	assert.equal(module._bridge_owned_runtime_identities(), 0);
	assert.equal(module._bridge_lean_release(legacy), 0);
	assert.equal(module._bridge_lean_live_handles(), 0);
	assert.equal(module._bridge_lean_runtime_shutdown(), 0, "The attached owned component still keeps the heap alive");
	f.close(); assert.equal(module._bridge_owned_runtime_components(), 0);
	assert.equal(module._bridge_owned_runtime_can_shutdown(), 1);
	if(reviewed)
	{
		module._lean_bridge_native_runtime_retire();
		assert.equal(module._bridge_lean_runtime_status(), 3);
		assert.equal(module._bridge_lean_runtime_init(), 0);
		assert.equal(module._bridge_lean_runtime_shutdown(), 0);
		assert.equal(module._bridge_lean_alpha_make(1), 0);
	}
	else
	{
		assert.equal(module._bridge_lean_runtime_shutdown(), 1);
		assert.equal(module._bridge_lean_runtime_status(), 4);
		module._lean_bridge_native_runtime_retire();
		assert.equal(module._bridge_lean_runtime_status(), 4);
		assert.equal(module._bridge_lean_runtime_init(), 0);
	}
	assert.equal(module._owned_init(), 4);
	assert.equal(module._owned_initializations(), 1);
	t.diagnostic(JSON.stringify({ reviewed, alphaFirst: reviewed
		, runtimeInitializations: module._bridge_lean_runtime_init_runs()
		, libraryInitializations: module._bridge_lean_library_init_runs()
		, state: module._bridge_lean_runtime_status()
		, owners: module._owned_results()
		, identities: module._bridge_owned_runtime_identities()
		, allocations: module._owned_live()
		, legacyHandles: module._bridge_lean_live_handles() }));
});
