/**
 * Compiler-authenticated ownership contracts stay distinct on the shared target.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { createOwnedCompiledNativeModel, generateOwnedNativeLeanAdapters } from "../src/build/owned-native-model.mjs";
import { createOwnedPhpWasmModel, generateOwnedPhpWasmLeanAdapters } from "../src/build/php-wasm-owned-model.mjs";
import { createCompiledPhpWasmModel, generateCompiledPhpWasmLeanAdapters } from "../src/build/php-wasm-graph-model.mjs";
import { generateCompiledPhpWasmOwned } from "../src/build/php-wasm-owned-component.mjs";

const inputs = async () => JSON.parse(await readFile("docs/evidence/owned-aggregate-execution-20260926.json", "utf8")).inputs;

test("owned PHP-Wasm models bind compiler-selected signatures to exact wasm32 layouts", async () => {
	for(const input of Object.values(await inputs()))
	{
		const before = canonicalJson(input), model = createCompiledPhpWasmModel(input);
		assert.equal(canonicalJson(input), before);
		assert.deepEqual(model, createOwnedPhpWasmModel(input));
		assert.equal(model.schemaVersion, 7); assert.equal(model.pointerBits, 32);
		assert.equal(model.profile, "php-wasm-copied-v1");
		assert.equal(model.ownedGraph.transport, "owned-zend-v1");
		const adapters = generateCompiledPhpWasmLeanAdapters(model);
		assert.deepEqual(adapters, generateOwnedPhpWasmLeanAdapters(model));
		const native = generateOwnedNativeLeanAdapters(createOwnedCompiledNativeModel({ ...input, hostCallbacks: true }));
		assert.equal(adapters.leanSource, native.leanSource);
		assert.equal(adapters.callbackSource, native.callbackSource);
		assert.match(adapters.header, /sizeof\(void \*\) == 4 && sizeof\(size_t\) == 4/);
		assert.doesNotMatch(adapters.leanSource, /\b(?:unsafe|unsafeCast|partial|sorry|axiom)\b/);
	}
});

test("owned PHP-Wasm sources and receipts reconstruct all public and private adapters", async () => {
	for(const input of Object.values(await inputs()))
	{
		const model = createCompiledPhpWasmModel(input), adapters = generateCompiledPhpWasmLeanAdapters(model);
		const generated = generateCompiledPhpWasmOwned(model, input.metadata, adapters);
		assert.deepEqual(generateCompiledPhpWasmOwned(model, input.metadata, adapters), generated);
		assert.equal(generated.manifest.profile, "php-wasm-owned-zend-v1");
		assert.equal(generated.manifest.integerBits, 32);
		assert.equal(generated.manifest.wordBits, 32);
		assert.equal(generated.receipt.layoutSha256, model.ownedGraph.layoutSha256);
		assert.deepEqual(generated.manifest.phpFiles, ["src/Api.php", "src/Internal/GraphTypes.php", "src/Internal/Native.php", "src/Internal/Values.php", "src/Internal/Wire.php"]);
		assert.deepEqual(generated.sources, ["owned/callbacks.c", `extension/${generated.manifest.extension}.c`]);
		assert.equal(generated.allocationGuard, "owned/allocation-guard.h");
		assert.deepEqual(generated.receipt.files, Object.fromEntries(Object.entries(generated.files).map(([path, bytes]) => [path, sha256(bytes)])));
		assert.doesNotMatch(generated.files["src/Internal/Native.php"], /\bFFI\b|CData/u);
	}
});

test("owned PHP-Wasm generation rejects width, transport, callback and source drift", async () => {
	const input = (await inputs()).aggregates, model = createCompiledPhpWasmModel(input);
	const adapters = generateCompiledPhpWasmLeanAdapters(model);
	for(const mutate of [
		value => { value.pointerBits = 64; }, value => { value.byteOrder = "big"; }
		, value => { value.profile = "native-library-v1"; }
		, value => { value.schemaVersion = 6; }
		, value => { value.ownedGraph.schemaVersion = 1; }
		, value => { value.ownedGraph.transport = "copied-zend-v1"; }
		, value => { value.ownedGraph.layoutSha256 = "0".repeat(64); }
		, value => { value.ownedGraph.extra = true; }
		, value => { delete value.ownedGraph.hostCallbacks; }
		, value => { value.ownedGraph.hostCallbacks.lifetime = "explicit"; }
		, value => { value.ownedGraph.hostCallbacks.trampolineSha256 = "0".repeat(64); }
		, value => { value.exports[0].symbol += "_drift"; }
	]) {
		const changed = structuredClone(model); mutate(changed);
		assert.throws(() => generateOwnedPhpWasmLeanAdapters(changed));
		assert.throws(() => generateCompiledPhpWasmOwned(changed, input.metadata, adapters));
	}
	for(const key of ["leanSource", "header", "callbackSource", "module"])
		assert.throws(() => generateCompiledPhpWasmOwned(model, input.metadata, { ...adapters, [key]: adapters[key] + "\ndrift" }));
	assert.throws(() => generateCompiledPhpWasmOwned(model, { ...input.metadata, schemaVersion: 99 }, adapters));
});
