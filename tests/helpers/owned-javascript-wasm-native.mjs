/**
 * Execute the private JavaScript value codec against freshly compiled Lean and
 * the native owned-value adapter in an actual browser-profile Wasm heap.
 * Result owners now follow the real JS registry's explicit lease lifetimes.
 * This probe does not implement installed-package or shared-loader admission.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { compileOwnedJavaScriptWasmLayout } from "../../src/backends/javascript/owned-wasm-layout.mjs";
import { generateOwnedNativeValueAdapters } from "../../src/backends/native/owned-value-adapters.mjs";
import { ownedAggregateLeaseSource } from "../../src/backends/native/owned-aggregate-leases.mjs";
import { brokerHeader, brokerSource } from "../../src/backends/native/runtime-broker.mjs";
import { nativeCallbackHeader } from "../../src/build/native-component.mjs";
import { ownedWasmCallbackBroker } from "../../src/backends/javascript/owned-wasm-callbacks.mjs";
import { generateOwnedWasmComponent } from "../../src/backends/javascript/owned-wasm-component.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { createOwnedWasmCalls } from "../../src/release/owned-wasm-calls.mjs";
import { createOwnedWasmBindings } from "../../src/release/owned-wasm-bindings.mjs";
import { compileOwnedAggregateFixture } from "./owned-aggregate-native.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { generateOwnedWasmBroker } from "../../src/backends/javascript/owned-wasm-broker.mjs";
import { compileOwnedWasmSharedHost } from "./owned-javascript-wasm-shared.mjs";
import { compileOwnedWasmPreparedHost } from "./owned-javascript-wasm-prepared.mjs";

const probe = component => `#include <stddef.h>
static size_t attempts, fail_at;
#define LB_JS_ALLOC_FAIL() (++attempts == fail_at)
${component.source}
unsigned owned_identities(void) {
  lean_bridge_native_snapshot snapshot; lean_bridge_native_snapshot_read(&snapshot); return snapshot.live_identities;
}
unsigned owned_initializations(void) {
  lean_bridge_native_snapshot snapshot; lean_bridge_native_snapshot_read(&snapshot); return snapshot.runtime_init_runs;
}
void owned_fail_after(unsigned count) { fail_at = count ? attempts + count : 0; }
`;

/**
 * Compile an authored fixture and its typed carriers, never synthetic Lean values.
 * The input compiler metadata and wasm32 layout are generated independently.
 *
 * @param t - Test context that owns scratch cleanup and diagnostics.
 * @param fixture - Authored owned-aggregates or owned-scalars module.
 * @param options - Private projection-failure and registry allocation test hooks.
 */
export const compileOwnedJavaScriptWasmFixture = async (t, fixture = "owned-aggregates", options = {}) => {
	const hostCallbacks = options.hostCallbacks ?? false;
	const native = await compileOwnedAggregateFixture(t, { fixture
		, witness: "import Owned\n", hostCallbacks
		, ...options.reviewedIr ? { reviewedIr: options.reviewedIr } : {} });
	const generated = generateOwnedNativeValueAdapters({ metadata: native.metadata
		, sourceIdentity: native.sourceIdentity
		, component: native.model.component, wordBits: 32, hostCallbacks });
	const layout = compileOwnedJavaScriptWasmLayout(generated.layout.model.bindingIr), directory = native.directory;
	const component = generateOwnedWasmComponent(generated), callbacks = component.callbacks;
	const sharedBroker = options.sharedRuntime ? generateOwnedWasmBroker() : null;
	assert.equal(generated.carriers.leanSource, native.leanSource);
	assert.equal(layout.native.header, generated.typesHeader);
	const root = resolve(process.env.LEAN_BRIDGE_RUNTIME_ROOT ?? "build/lean-runtime/f3b06c705e6c85f5314019d5d3baab0fec5b580c-743765bf566f43ec2f7b4eb84a85686880b3797efe83bf244d6fc7281e4f85a3-browser");
	assert.equal((await readFile(join(root, "source/.lean-wasm-patched"), "utf8")).trim()
		, "f3b06c705e6c85f5314019d5d3baab0fec5b580c 743765bf566f43ec2f7b4eb84a85686880b3797efe83bf244d6fc7281e4f85a3 browser");
	const sdk = resolve(process.env.LEAN_WASM_EMSDK ?? ".toolchains/emsdk");
	const run = (compiler, args) => processBuildRunner.capture({ command: join(sdk, "upstream/emscripten", compiler)
		// The shared fixture links the full Init archive, not just one component.
		// Keep a bounded deadline with room for concurrent contract-suite workers.
		, args, cwd: directory, timeoutMs: options.sharedRuntime ? 420000 : 180000
		, env: { ...process.env, EMSDK: sdk, EM_CONFIG: join(sdk, ".emscripten") }
	}).catch(error => { t.diagnostic(error.details?.stderr ?? error.message); throw error; });
	for(const [path, source] of Object.entries({
		"owned-values.h": generated.typesHeader
		, "owned-values-codec.h": generated.source
		, "owned-leases.h": ownedAggregateLeaseSource
		, "carriers.h": generated.carriers.header
		, "owned-js-layout.h": layout.assertions
		, "lean_bridge_native_runtime.h": sharedBroker?.header ?? (hostCallbacks ? brokerHeader.replace("#ifdef __cplusplus\n}", `${nativeCallbackHeader}\n#ifdef __cplusplus\n}`) : brokerHeader)
		, "broker.c": sharedBroker?.source ?? (brokerSource + (hostCallbacks ? ownedWasmCallbackBroker() : ""))
		, "probe.c": probe(component)
	})) await saveLakeFile(directory, path, source);
	t.diagnostic(`Compiling ${fixture} and the owned codec for the JavaScript wasm32 target`);
	const objects = ["Owned", "Carriers", "broker", "probe", ...hostCallbacks ? ["Callbacks"] : []];
	for(const name of objects)
		await run("emcc", ["-std=c11", "-O1", "-DLEAN_EMSCRIPTEN", "-I", directory
			, ...sharedBroker ? ["-fPIC", "-fwasm-exceptions"] : []
			, "-I", join(root, "cmake/include")
			, ...name === "Carriers" ? ["-include", "carriers.h"] : []
			, "-c", name + ".c", "-o", name + ".wasm.o"]);
	const exports = ["_owned_identities", "_owned_initializations"
		, "_owned_fail_after", "_" + component.controlSymbol
		, ...Object.values(component.symbols).map(symbol => "_" + symbol)
		, ...callbacks
			? Object.values(callbacks.symbols).map(symbol => "_" + symbol) : []];
	let module, shared;
	if(sharedBroker)
	{
		const compileHost = options.preparedRoot ? compileOwnedWasmPreparedHost : compileOwnedWasmSharedHost;
		shared = await compileHost({ directory, root, sdk, run, objects
			, exports, component, alphaFirst: options.alphaFirst
			, publicLoader: options.publicLoader, preparedRoot: options.preparedRoot });
		module = shared.module;
	}
	else
	{
		const archives = ["lib/lean/libInit.a", "lib/lean/libleanrt.a"
			, "libuv/src/libuv/libuv.a"].map(path => join(root, "cmake", path));
		await run("em++", [...objects.map(name => name + ".wasm.o")
			, "-Wl,--start-group", ...archives, "-Wl,--end-group"
			, "-O1", "-sMODULARIZE=1", "-sEXPORT_ES6=1", "-sENVIRONMENT=node"
			, "-sALLOW_MEMORY_GROWTH=1", "-sSTACK_SIZE=4194304"
			, "-sEXPORTED_RUNTIME_METHODS=HEAP8"
			, "-sEXPORTED_FUNCTIONS=_malloc,_free,_owned_identities,_owned_initializations,_owned_fail_after"
				+ `,_${component.controlSymbol}`
				+ Object.values(component.symbols).map(symbol => `,_${symbol}`).join("")
				+ (callbacks ? Object.values(callbacks.symbols).map(symbol => `,_${symbol}`).join("") : "")
			, "-Wl,--no-entry", "-o", "probe.mjs"]);
		const create = (await import(pathToFileURL(join(directory, "probe.mjs")).href)).default;
		module = await create();
	}
	if(!options.preparedRoot) for(const [name, symbol] of Object.entries(component.symbols)) module[`_owned_${name}`] = module[`_${symbol}`];
	if(shared?.loadedComponent)
	{
		const runtime = shared.loadedComponent;
		t.after(runtime.close);
		return { call: (name, ...args) => runtime.call(layout.native.functions.find(fn => fn.name === name)?.id, args)
			, close: runtime.close, module, layout, shared
			, withRecovery: runtime.withRecovery
			, callbackCount: () => callbacks ? module[`_${callbacks.symbols.live}`]() : 0 };
	}
	let closed = false, poisoned = false;
	const binding = createOwnedWasmBindings(module, shared?.operation ?? module[`_${component.controlSymbol}`], {
		assertOpen: () => {
			assert.equal(closed || poisoned, false);
			if(shared) assert.ok([0, 2].includes(module._bridge_lean_runtime_status()), "Shared runtime is retired");
		}
		, poison: () => { poisoned = true; }
		, close: () => {
			closed = true; assert.equal(module._owned_results(), 0);
			if(callbacks) assert.equal(module[`_${callbacks.symbols.live}`](), 0);
			assert.equal(module._owned_live(), 0);
			assert.equal(module._owned_identities(), 0); assert.equal(module._owned_initializations(), 1);
			return 0;
		}
	}, callbacks?.handlerKey);
	assert.equal(binding.metadataHash(), component.metadataHash);
	assert.equal(binding.initialize(), 0);
	assert.equal(binding.initialize(), 0);
	const owner = binding.bindings.openOwner(); assert.ok(owner);
	assert.equal(binding.bindings.validOwner(owner), 1);
	assert.equal(binding.initialize(), 0); assert.equal(binding.bindings.validOwner(owner), 1);
	assert.equal(module._owned_dispatch(0xffffffff, 0, 0, owner), 1);
	assert.equal(module._owned_dispatch(0, 0, 0, owner), 1);
	assert.equal(binding.bindings.releaseOwner(owner), 0);
	assert.equal(binding.bindings.validOwner(owner), 0);
	assert.equal(binding.bindings.releaseOwner(owner), 1);
	const nextOwner = binding.bindings.openOwner(); assert.ok(nextOwner > owner);
	assert.equal(binding.bindings.releaseOwner(nextOwner), 0);
	const control = module[`_${component.controlSymbol}`], frame = module._malloc(64);
	try
	{
		for(const [offset, value] of [[0, 2], [4, 32], [8, 1], [12, 99], [56, 1], [60, 1]])
		{
			module.HEAP8.fill(0, frame, frame + 64); const view = new DataView(module.HEAP8.buffer);
			view.setUint32(frame, 1, true); view.setUint32(frame + 4, 64, true);
			view.setUint32(frame + offset, value, true);
			assert.equal(control(frame), 1); assert.equal(view.getUint32(frame + 8, true), 1);
		}
		for(const pointer of [0, 1, module.HEAP8.length - 8]) assert.equal(control(pointer), 1);
	}
	finally
	{ module._free(frame); }
	const bindings = { ...binding.bindings, claimAllocation: (owner, pointer, bytes) => {
		const claim = binding.bindings.claimAllocation;
		assert.equal(claim(owner, pointer, bytes), 1);
		assert.equal(claim(0, pointer, bytes), 0);
		const unrelated = binding.bindings.openOwner(); assert.ok(unrelated && unrelated !== owner);
		try
		{ assert.equal(claim(unrelated, pointer, bytes), 0); }
		finally
		{ assert.equal(binding.bindings.releaseOwner(unrelated), 0); }
		assert.equal(claim(owner, pointer + 1, bytes), 0);
		assert.equal(claim(owner, pointer, bytes + 1), 0);
		return 1;
	} };
	const runtime = createOwnedWasmCalls(module, layout, bindings, options);
	const close = () => runtime.close();
	t.after(close);
	return { call: (name, ...args) => runtime.call(layout.native.functions.find(fn => fn.name === name)?.id, args)
		, close, module, layout, withRecovery: runtime.withRecovery, shared
		, callbackCount: () => callbacks ? module[`_${callbacks.symbols.live}`]() : 0 };
};
