/**
 * Loader admission, compiled descriptor authentication and shared retirement.
 * The shared-runtime execution suite separately tests actual Lean side modules.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { generateOwnedNativeValueAdapters } from "../src/backends/native/owned-value-adapters.mjs";
import { generateOwnedWasmComponent } from "../src/backends/javascript/owned-wasm-component.mjs";
import { createComponentRuntime } from "../src/release/component-runtime.mjs";
import { ownedWasmControlOperations as op } from "../src/abi/owned-wasm-control.mjs";

const inputs = JSON.parse(await readFile("docs/evidence/owned-aggregate-execution-20260926.json", "utf8")).inputs.aggregates;
const component = generateOwnedWasmComponent(generateOwnedNativeValueAdapters({ ...inputs, wordBits: 32, hostCallbacks: true }));
const payload = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]);
const descriptor = () => ({ id: component.layout.native.model.component.id
	, buildHash: component.metadataHash, integrity: sha256(payload)
	, sideModule: new URL("https://example.invalid/owned.wasm")
	, initializer: component.privateAbi.initializer
	, privateAbi: structuredClone(component.privateAbi)
	, bindingIr: structuredClone(component.layout.native.model.bindingIr) });

const fixture = async (t, options = {}) => {
	const files = new Map(), allocations = new Set(), controls = [];
	let next = 64, state = 0, fetches = 0, links = 0, initializations = 0, legacyInitializations = 0, closes = 0;
	t.mock.method(globalThis, "fetch", async () => { fetches++; return new Response(payload); });
	const module = { HEAP8: new Int8Array(1024 * 1024)
		, _malloc: size => { const pointer = next; next += Math.ceil(size / 8) * 8; allocations.add(pointer); return pointer; }
		, _free: pointer => { assert.ok(allocations.delete(pointer)); }
		, _bridge_lean_runtime_init: () => { state = 2; return 1; }
		, _bridge_lean_runtime_status: () => state
		, _bridge_owned_runtime_abi: () => 1
		, _bridge_scalar_frame_clear: () => {}
		, _bridge_lean_component_initialize: () => { legacyInitializations++; return 1; }
		, _bridge_lean_component_last_error: () => 0
		, _bridge_scalar_call: (symbol, pointer) => {
			const end = module.HEAP8.indexOf(0, symbol);
			assert.equal(new TextDecoder().decode(module.HEAP8.subarray(symbol, end)), component.controlSymbol);
			const view = new DataView(module.HEAP8.buffer), code = view.getUint32(pointer + 12, true);
			controls.push(code);
			if(code === op.metadata)
			{
				options.onMetadata?.(view, pointer);
				const hash = options.hash ?? component.metadataHash, index = view.getUint32(pointer + 16, true);
				view.setUint32(pointer + 56, parseInt(hash.slice(index * 8, index * 8 + 8), 16), true);
			}
			else if(code === op.init)
			{
				initializations++; const status = options.initStatus ?? 0;
				view.setUint32(pointer + 8, status, true); return status;
			}
			else if(code === op.close) closes++;
			else throw new Error(`Unexpected native control operation ${code}`);
			return 0;
		}
		, FS: { writeFile: (name, bytes) => files.set(name, bytes.slice()), unlink: name => files.delete(name) }
		, loadDynamicLibrary: async name => { links++; assert.deepEqual(files.get(name), payload); }
	};
	const runtime = await createComponentRuntime(async () => module, new URL("https://example.invalid/main.wasm"));
	return { runtime, module, controls, files, allocations
		, retire: () => { state = 3; }
		, counts: () => ({ fetches, links, initializations, legacyInitializations, closes }) };
};

test("the existing loader checks compiled metadata and initializes owned components once", async t => {
	const f = await fixture(t), input = descriptor();
	const pending = f.runtime.loadComponent(input);
	assert.equal(f.runtime.loadComponent(descriptor()), pending);
	input.privateAbi.layout.types[0].size++;
	input.initializer += "_changed_after_start";
	const loaded = await pending;
	assert.deepEqual(f.controls, [...Array(8).fill(op.metadata), op.init]);
	assert.deepEqual(f.counts(), { fetches: 1, links: 1, initializations: 1, legacyInitializations: 0, closes: 0 });
	assert.equal(f.allocations.size, 0); assert.equal(f.files.size, 0);
	assert.throws(() => loaded.call("missing", []), /Unknown owned Lean declaration/u);
	assert.equal(typeof f.module[component.privateAbi.callbackKey]?.dispatch, "function");
	loaded.close(); loaded.close();
	assert.equal(f.counts().closes, 1); assert.equal(f.allocations.size, 0);
	assert.equal(Object.hasOwn(f.module, component.privateAbi.callbackKey), false);
	assert.equal(await f.runtime.loadComponent(descriptor()), loaded);
	assert.equal(f.counts().initializations, 1);
});

test("owned metadata substitutions retire the heap before any Lean initializer", async t => {
	for(const mutate of [
		value => { value.privateAbi.layout.types[0].size++; }
		, value => { value.privateAbi.layout.native.header += "\n"; }
		, value => { value.privateAbi.callbackKey = null; }
	]) {
		const f = await fixture(t), input = descriptor(); mutate(input);
		await assert.rejects(f.runtime.loadComponent(input), /compiled metadata mismatch/u);
		assert.equal(f.counts().initializations, 0);
		assert.equal(f.allocations.size, 0); assert.equal(f.files.size, 0);
		assert.throws(() => f.runtime.loadComponent(descriptor()), /poisoned/u);
		assert.equal(f.counts().fetches, 1);
	}
});

test("owned identity and runtime requirements reject before fetching or linking", async t => {
	for(const mutate of [
		input => { input.id += "-substituted"; }
		, input => { input.initializer += "_substituted"; }
		, input => { input.privateAbi.controlSymbol += "_substituted"; }
	]) {
		const f = await fixture(t), input = descriptor(); mutate(input);
		await assert.rejects(f.runtime.loadComponent(input), /identity mismatch/u);
		assert.equal(f.counts().fetches, 0); assert.equal(f.counts().links, 0);
		const loaded = await f.runtime.loadComponent(descriptor()); loaded.close();
	}
	const f = await fixture(t); f.module._bridge_owned_runtime_abi = () => 0;
	await assert.rejects(f.runtime.loadComponent(descriptor()), /lacks the owned component ABI/u);
	assert.equal(f.counts().fetches, 0);
});

test("an initializer failure retires the shared loader without a second attempt", async t => {
	const f = await fixture(t, { initStatus: 7 });
	await assert.rejects(f.runtime.loadComponent(descriptor()), /initialization failed \(7\)/u);
	assert.equal(f.counts().initializations, 1); assert.equal(f.allocations.size, 0);
	assert.throws(() => f.runtime.loadComponent(descriptor()), /poisoned/u);
	assert.equal(f.counts().initializations, 1);
});

test("a metadata trap preserves its error and never reenters the allocator", async t => {
	const failure = new Error("compiled control trap");
	const f = await fixture(t, { onMetadata: () => { throw failure; } });
	await assert.rejects(f.runtime.loadComponent(descriptor()), error => error === failure);
	assert.equal(f.counts().initializations, 0);
	assert.equal(f.allocations.size, 2, "Both temporary allocations stay quarantined after the trap");
	assert.throws(() => f.runtime.loadComponent(descriptor()), /poisoned/u);
	assert.deepEqual(f.controls, [op.metadata]);
});

test("native retirement invalidates previously loaded owned bindings", async t => {
	const f = await fixture(t), loaded = await f.runtime.loadComponent(descriptor());
	f.retire();
	const before = f.controls.length;
	const id = component.layout.native.functions[0].id;
	assert.throws(() => loaded.call(id, []), /retired/u);
	assert.throws(() => f.runtime.loadComponent(descriptor()), /poisoned/u);
	assert.equal(f.controls.length, before);
});
