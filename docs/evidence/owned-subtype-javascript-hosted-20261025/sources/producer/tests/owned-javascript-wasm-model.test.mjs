/**
 * Compiler-bound wasm32 ownership models and reconstructible component sources.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { createOwnedCompiledNativeModel, generateOwnedNativeLeanAdapters } from "../src/build/owned-native-model.mjs";
import { createOwnedJavaScriptWasmModel, generateOwnedJavaScriptWasmLeanAdapters } from "../src/build/javascript-wasm-owned-model.mjs";
import { generateCompiledJavaScriptWasmOwned } from "../src/build/javascript-wasm-owned-sources.mjs";
import { assertComponentOwnedWasmBindings } from "../src/abi/component-owned-wasm.mjs";

const inputs = JSON.parse(await readFile("docs/evidence/owned-aggregate-execution-20260926.json", "utf8")).inputs;

test("the owned JavaScript compiled profile binds typed carriers to the exact wasm32 control ABI", () => {
	for(const input of Object.values(inputs))
	{
		const before = canonicalJson(input), model = createOwnedJavaScriptWasmModel(input);
		assert.equal(canonicalJson(input), before);
		assert.equal(model.profile, "javascript-wasm-owned-v1");
		assert.equal(model.pointerBits, 32); assert.equal(model.schemaVersion, 7);
		assert.equal(model.ownedGraph.transport, "owned-wasm32-control-v1");
		const adapters = generateOwnedJavaScriptWasmLeanAdapters(model);
		const native = generateOwnedNativeLeanAdapters(createOwnedCompiledNativeModel({ ...input, hostCallbacks: true }));
		assert.equal(adapters.leanSource, native.leanSource); assert.equal(adapters.callbackSource, native.callbackSource);
		assert.match(adapters.header, /sizeof\(void \*\) == 4 && sizeof\(size_t\) == 4/);
		assert.doesNotMatch(adapters.leanSource, /\b(?:unsafe|unsafeCast|partial|sorry|axiom)\b/);
	}
});

test("owned JavaScript receipts reconstruct every private adapter without linking a second broker", () => {
	for(const input of Object.values(inputs))
	{
		const model = createOwnedJavaScriptWasmModel(input), adapters = generateOwnedJavaScriptWasmLeanAdapters(model);
		const generated = generateCompiledJavaScriptWasmOwned(model, input.metadata, adapters);
		assert.deepEqual(generateCompiledJavaScriptWasmOwned(model, input.metadata, adapters), generated);
		assert.equal(generated.privateAbi.version, 10);
		assert.equal(generated.metadataHash, assertComponentOwnedWasmBindings(generated.privateAbi, model.bindingIr));
		assert.equal(generated.receipt.layoutSha256, model.ownedGraph.layoutSha256);
		assert.deepEqual(generated.sources, ["owned/callbacks.c", "owned/component.c"]);
		assert.equal(generated.allocationGuard, "owned/allocation-guard.h");
		assert.deepEqual(generated.receipt.files, Object.fromEntries(Object.entries(generated.files).map(([path, bytes]) => [path, sha256(bytes)])));
		assert.doesNotMatch(generated.files["owned/component.c"], /lean_initialize_runtime_module|initialize_Init\(/);
		assert.match(generated.files["owned/component.c"], /lean_bridge_native_component_initialize/);
		assert.equal(generated.files["private-abi.json"], canonicalJson(generated.privateAbi));
	}
});

test("owned JavaScript generation rejects altered widths, capabilities, metadata and carriers", () => {
	const input = inputs.aggregates, model = createOwnedJavaScriptWasmModel(input), adapters = generateOwnedJavaScriptWasmLeanAdapters(model);
	for(const mutate of [
		value => { value.pointerBits = 64; }, value => { value.byteOrder = "big"; }
		, value => { value.profile = "php-wasm-copied-v1"; }
		, value => { value.schemaVersion = 6; }
		, value => { value.ownedGraph.schemaVersion = 1; }
		, value => { value.ownedGraph.transport = "owned-zend-v1"; }
		, value => { value.ownedGraph.layoutSha256 = "0".repeat(64); }
		, value => { value.ownedGraph.extra = true; }
		, value => { delete value.ownedGraph.hostCallbacks; }
		, value => { value.ownedGraph.hostCallbacks.lifetime = "explicit"; }
		, value => { value.ownedGraph.hostCallbacks.trampolineSha256 = "0".repeat(64); }
		, value => { value.exports[0].symbol += "_drift"; }
	]) {
		const changed = structuredClone(model); mutate(changed);
		assert.throws(() => generateOwnedJavaScriptWasmLeanAdapters(changed));
		assert.throws(() => generateCompiledJavaScriptWasmOwned(changed, input.metadata, adapters));
	}
	for(const key of ["leanSource", "header", "callbackSource", "module"])
		assert.throws(() => generateCompiledJavaScriptWasmOwned(model, input.metadata, { ...adapters, [key]: adapters[key] + "\ndrift" }));
	assert.throws(() => generateCompiledJavaScriptWasmOwned(model, { ...input.metadata, schemaVersion: 99 }, adapters));
});
