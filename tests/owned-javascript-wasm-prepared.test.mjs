/**
 * Exercise the production runtime build, including its shared ownership broker.
 * An explicit root permits validation without replacing another live test's heap.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { generateOwnedWasmBroker } from "../src/backends/javascript/owned-wasm-broker.mjs";
import { compileOwnedJavaScriptWasmFixture } from "./helpers/owned-javascript-wasm-native.mjs";
import { ownedDotnetCallbacksReviewedIr } from "./helpers/owned-dotnet-callback-fixture.mjs";

const enabled = process.env.LEAN_BRIDGE_OWNED_JS_WASM_PREPARED_TEST === "1";
const root = resolve(process.env.LEAN_BRIDGE_OWNED_JS_WASM_PREPARED_ROOT ?? "build/lean-link-spike");
const create = async profile => (await import(pathToFileURL(join(root, profile, "main.mjs")).href)).default();

for(const profile of ["startup", "lazy", "final-static"]) test(`the prepared ${profile} runtime shares legacy and owned lifecycle state`, {
	skip: !enabled, timeout: 60000
}, async t => {
	const module = await create(profile), broker = generateOwnedWasmBroker();
	for(const name of broker.exports) assert.equal(typeof module[`_${name}`], "function", name);
	assert.equal(module._bridge_owned_runtime_abi(), 1);
	assert.equal(module._bridge_lean_runtime_status(), 0);
	assert.equal(module._bridge_lean_runtime_init_runs(), 0);
	if(profile === "lazy")
	{
		module.FS.writeFile("/alpha.so.wasm", await readFile(join(root, profile, "alpha.so.wasm")));
		try
		{ await module.loadDynamicLibrary("/alpha.so.wasm", { global: true, loadAsync: true, nodelete: true }); }
		finally
		{ module.FS.unlink("/alpha.so.wasm"); }
	}
	assert.equal(module._bridge_lean_runtime_init(), 1);
	assert.equal(module._bridge_lean_runtime_init(), 1);
	assert.equal(module._bridge_lean_runtime_init_runs(), 1);
	assert.equal(module._bridge_lean_library_init_runs(), 1);
	assert.equal(module._bridge_owned_runtime_components(), 0);
	assert.equal(module._bridge_owned_runtime_identities(), 0);
	assert.equal(module._bridge_owned_runtime_can_shutdown(), 1);
	const handle = module._bridge_lean_alpha_make(47);
	assert.ok(handle); assert.equal(module._bridge_lean_alpha_read(handle), 47);
	assert.equal(module._bridge_lean_runtime_shutdown(), 0);
	assert.equal(module._bridge_lean_runtime_status(), 2);
	assert.equal(module._bridge_lean_release(handle), 0);
	assert.equal(module._bridge_lean_live_handles(), 0);
	assert.equal(module._bridge_lean_runtime_shutdown(), 1);
	assert.equal(module._bridge_lean_runtime_status(), 4);
	module._lean_bridge_native_runtime_retire();
	assert.equal(module._bridge_lean_runtime_status(), 4);
	assert.equal(module._bridge_lean_runtime_init(), 0);
	assert.equal(module._bridge_owned_runtime_component_initializations(), 0);
	assert.equal(module._bridge_lean_alpha_make(48), 0);
	t.diagnostic(JSON.stringify({ profile
		, coreInitializations: module._bridge_lean_runtime_init_runs()
		, libraryInitializations: module._bridge_lean_library_init_runs()
		, components: module._bridge_owned_runtime_components()
		, identities: module._bridge_owned_runtime_identities()
		, legacyHandles: module._bridge_lean_live_handles() }));
});

test("a prepared legacy module loaded after Init still runs its library initializer", { skip: !enabled, timeout: 60000 }, async () => {
	const module = await create("lazy");
	assert.equal(module._bridge_lean_runtime_init(), 1);
	assert.equal(module._bridge_lean_library_init_runs(), 0);
	module.FS.writeFile("/alpha.so.wasm", await readFile(join(root, "lazy/alpha.so.wasm")));
	try
	{ await module.loadDynamicLibrary("/alpha.so.wasm", { global: true, loadAsync: true, nodelete: true }); }
	finally
	{ module.FS.unlink("/alpha.so.wasm"); }
	assert.equal(module._bridge_lean_library_init_runs(), 1);
	assert.equal(module._bridge_lean_runtime_init_runs(), 1);
	assert.equal(module._bridge_lean_runtime_shutdown(), 1);
});

test("the prepared ownership broker cannot restart failed or retired Init", { skip: !enabled, timeout: 60000 }, async () => {
	const failed = await create("lazy");
	assert.equal(failed._bridge_test_lean_runtime_force_init_error(), 1);
	assert.equal(failed._bridge_lean_runtime_init(), 0);
	assert.equal(failed._bridge_lean_runtime_status(), 3);
	assert.equal(failed._bridge_lean_runtime_init_runs(), 1);
	assert.equal(failed._bridge_lean_runtime_init(), 0);
	assert.equal(failed._bridge_owned_runtime_component_initializations(), 0);
	assert.equal(failed._bridge_lean_runtime_shutdown(), 0);
	const retired = await create("lazy");
	assert.equal(retired._bridge_lean_runtime_init(), 1);
	retired._lean_bridge_native_runtime_retire();
	assert.equal(retired._bridge_lean_runtime_status(), 3);
	assert.equal(retired._bridge_lean_runtime_init(), 0);
	assert.equal(retired._bridge_owned_runtime_component_initializations(), 0);
	assert.equal(retired._bridge_lean_runtime_shutdown(), 0);
});

for(const reviewed of [false, true]) test(`fresh ${reviewed ? "reviewed" : "ordinary"} owned Lean executes in the production heap`, {
	skip: !enabled, timeout: 600000
}, async t => {
	const f = await compileOwnedJavaScriptWasmFixture(t, "owned-dotnet-callables", {
		hostCallbacks: true, sharedRuntime: true, publicLoader: true
		, preparedRoot: root, alphaFirst: reviewed
		, ...reviewed ? { reviewedIr: ownedDotnetCallbacksReviewedIr() } : {}
	});
	const { module } = f, api = f.shared.publicApi;
	const call = (name, ...args) => api[name](...args);
	const legacy = await f.shared.loadLegacy();
	assert.equal(module._bridge_lean_runtime_init_runs(), 1);
	assert.equal(module._bridge_lean_library_init_runs(), 2);
	const box = new legacy.Box(83);
	const ticket = call("newTicket", 1n << 40n, "production heap");
	const bundle = { primary: ticket, spare: { tag: "none" }, peers: [ticket]
		, history: [ticket]
		, payload: { count: 1n << 130n, bytes: new Uint8Array([0, 255]) } };
	let borrow, retained;
	assert.deepEqual(call("callbackRecord", bundle, value => {
		borrow = value.primary; retained = borrow.retain();
		assert.equal(box.read(), 83);
		assert.equal(module._bridge_lean_runtime_shutdown(), 0);
		assert.equal(call("serial", borrow), 1n << 40n);
		return value;
	}), bundle);
	assert.equal(borrow.disposed, true);
	assert.equal(call("serial", retained), 1n << 40n);
	retained.dispose();
	const dispatch = call("dispatch", bundle);
	assert.deepEqual(dispatch(value => value), bundle); dispatch.dispose();
	const failure = new Error("production host callback");
	assert.throws(() => call("callbackRecord", bundle, () => { throw failure; }), error => error === failure);
	assert.equal(call("serial", ticket), 1n << 40n);
	assert.throws(() => api.echoRecord(), /arguments/u);
	assert.throws(() => api.echoRecord(bundle, 9), /arguments/u);
	assert.throws(() => api.serial({ ...ticket }), /resource/u);
	assert.throws(() => api.viaUnit(() => 1, undefined), /Expected unit/u);
	assert.equal(api.viaUnit(() => undefined, undefined), undefined);
	const recoveryFailure = new Error("typed public recovery");
	assert.throws(() => api.factory(api.withRecovery(() => { throw recoveryFailure; }, ticket)), error => error === recoveryFailure);
	ticket.dispose();
	box.dispose();
	assert.equal(module._bridge_lean_live_handles(), 0);
	assert.equal(module._bridge_owned_runtime_identities(), 0);
	assert.equal(module._bridge_lean_runtime_shutdown(), 0);
	assert.equal(api.close(), true); assert.equal(api.close(), false);
	assert.equal(module._bridge_owned_runtime_components(), 0);
	assert.equal(module._bridge_lean_runtime_shutdown(), 1);
	assert.equal(module._bridge_lean_runtime_init_runs(), 1);
	assert.throws(() => f.shared.runtime.loadComponent(f.shared.descriptor), /retired/u);
	t.diagnostic(JSON.stringify({ reviewed
		, coreInitializations: module._bridge_lean_runtime_init_runs()
		, libraryInitializations: module._bridge_lean_library_init_runs()
		, components: module._bridge_owned_runtime_components()
		, identities: module._bridge_owned_runtime_identities() }));
});
