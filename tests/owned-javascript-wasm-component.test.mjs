/**
 * Deterministic component-local codegen and compiler-bound control entry points.
 * Real execution, faults and lifetime tests compile these same generated sources.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { generateOwnedWasmComponent } from "../src/backends/javascript/owned-wasm-component.mjs";
import { generateOwnedNativeValueAdapters } from "../src/backends/native/owned-value-adapters.mjs";
import { ownedWasmControlOperations } from "../src/abi/owned-wasm-control.mjs";
import { assertComponentOwnedWasmBindings } from "../src/abi/component-owned-wasm.mjs";

const inputs = JSON.parse(await readFile("docs/evidence/owned-aggregate-execution-20260926.json", "utf8")).inputs;

test("wasm32 component bindings derive deterministic symbols and control frames from checked IR", () => {
	for(const input of Object.values(inputs)) for(const hostCallbacks of [false, true])
	{
		const generated = generateOwnedNativeValueAdapters({ ...input, wordBits: 32, hostCallbacks });
		const before = structuredClone(generated), component = generateOwnedWasmComponent(generated);
		assert.deepEqual(generated, before);
		assert.deepEqual(generateOwnedWasmComponent(generated), component);
		assert.equal(component.layout.native.header, generated.typesHeader);
		assert.equal(assertComponentOwnedWasmBindings(component.privateAbi, generated.layout.model.bindingIr), component.metadataHash);
		assert.match(component.source, new RegExp(`UINT32_C\\(0x${component.metadataHash.slice(0, 8)}\\)`, "u"));
		assert.equal(Object.isFrozen(component.symbols), true);
		assert.equal(component.callbacks !== null, hostCallbacks);
		assert.match(component.controlSymbol, /^lbjs_component_[a-f0-9]{20}_control$/u);
		assert.equal(new Set(Object.values(component.symbols)).size, 11);
		assert.match(component.source, /sizeof\(.*_control_frame\) == 64/u);
		assert.match(component.source, /offsetof\(.*_control_frame, status\) == 8/u);
		assert.match(component.source, /offsetof\(.*_control_frame, token\) == 48/u);
		assert.doesNotMatch(component.source, /lean_initialize_runtime_module|initialize_Init\(|lean_init_task_manager\(/u);
		assert.match(component.source, /lean_bridge_native_component_initialize/u);
		assert.match(component.source, /lean_bridge_native_component_detach/u);
		for(const [name, index] of Object.entries(ownedWasmControlOperations))
			if(hostCallbacks || !name.startsWith("callback")) assert.ok(component.source.includes(`  case ${index}:`));
		assert.match(component.source, /next_owner == UINT32_MAX/u);
		assert.match(component.source, /actual - sizeof\(\*allocation\) == bytes/u);
	}
});

test("owned descriptor digests cover every layout byte and callback setting", () => {
	const generated = generateOwnedNativeValueAdapters({ ...inputs.aggregates, wordBits: 32, hostCallbacks: true });
	const component = generateOwnedWasmComponent(generated), ir = generated.layout.model.bindingIr;
	const hash = value => assertComponentOwnedWasmBindings(value, ir);
	const reordered = Object.fromEntries(Object.entries(component.privateAbi).reverse());
	assert.equal(hash(reordered), component.metadataHash);
	for(const mutate of [
		value => { value.layout.types[0].size++; }
		, value => { value.layout.native.header += "\n"; }
		, value => { value.layout.native.functions[0].parameters.push(value.layout.native.functions[0].result); }
		, value => { value.callbackKey = null; }
		, value => { value.initializer += "_replacement"; }
	]) {
		const changed = structuredClone(component.privateAbi); mutate(changed);
		assert.notEqual(hash(changed), component.metadataHash);
	}
	for(const mutate of [
		value => { value.version = 9; }
		, value => { value.unknown = true; }
		, value => { value.layout.native.wordBits = 64; }
		, value => { value.layout.native.model.bindingIrSha256 = "0".repeat(64); }
		, value => { value.controlSymbol += "_replacement"; }
		, value => { value.callbackKey += "_replacement"; }
	]) {
		const changed = structuredClone(component.privateAbi); mutate(changed);
		assert.throws(() => hash(changed), /descriptor|identity mismatch/u);
	}
});

test("component generation rejects non-wasm32 and mutated native layouts", () => {
	assert.throws(() => generateOwnedWasmComponent(generateOwnedNativeValueAdapters(inputs.aggregates)), /wasm32/);
	assert.throws(() => generateOwnedWasmComponent(null), /wasm32/);
	const generated = generateOwnedNativeValueAdapters({ ...inputs.aggregates, wordBits: 32 });
	for(const mutate of [
		value => { value.typesHeader += "\n"; }
		, value => { value.layout.functions[0].symbol += "_substituted"; }
		, value => { value.layout.nodes[0].cName = "uint8_t"; }
		, value => { value.layout.model.bindingIrSha256 = "0".repeat(64); }
	]) {
		const changed = structuredClone(generated); mutate(changed);
		assert.throws(() => generateOwnedWasmComponent(changed), /differs from its binding IR/);
	}
});
