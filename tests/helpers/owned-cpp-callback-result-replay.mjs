/**
 * Select live generators or the exact source-bound C++ callback producer.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { posix } from "node:path";
import { createCompiledNativeModel, generateCompiledNativeLeanAdapters } from "../../src/build/native-graph-model.mjs";
import { generateOwnedCPackage } from "../../src/backends/c/owned-package.mjs";
import { generateOwnedCppPackage } from "../../src/backends/cpp/owned-package.mjs";
import { createOwnedJavaScriptWasmModel, generateOwnedJavaScriptWasmLeanAdapters } from "../../src/build/javascript-wasm-owned-model.mjs";
import { generateCompiledJavaScriptWasmOwned } from "../../src/build/javascript-wasm-owned-sources.mjs";
import { ownedCallbackResultSource, ownedCallbackResultCombinedSource } from "./owned-callback-result-fixture.mjs";
import { moduleSpecifiers } from "./module-closure.mjs";
import { moduleAtProducer } from "./producer-module.mjs";
import { bytesAtProducer } from "./producer-source.mjs";

export const ownedCppCallbackProducer = "93589825d4b4c028724390e4c8d886213cbc92d8";
export const ownedCppCallbackProducerEntries = Object.freeze([
	"src/build/native-graph-model.mjs"
	, "src/backends/c/owned-package.mjs"
	, "src/backends/cpp/owned-package.mjs"
	, "src/build/javascript-wasm-owned-model.mjs"
	, "src/build/javascript-wasm-owned-sources.mjs"
	, "tests/helpers/owned-callback-result-fixture.mjs"
]);
// The original receipt lists source modules, but omits this imported data file.
// Pin its bytes independently to the same producer; do not amend the receipt.
export const ownedCppCallbackProducerAssets = Object.freeze({
	"src/backends/cpp/boost.source.json": "2e5ded51d6fa32f4d06d22eaf0bb10f54bdbfcf17731bea4f1554923a09ce10c"
});
const current = Object.freeze({
	createCompiledNativeModel, generateCompiledNativeLeanAdapters
	, generateOwnedCPackage, generateOwnedCppPackage
	, createOwnedJavaScriptWasmModel, generateOwnedJavaScriptWasmLeanAdapters
	, generateCompiledJavaScriptWasmOwned
	, ownedCallbackResultSource, ownedCallbackResultCombinedSource
});

/**
 * Authenticate the complete import closure against the receipt and fixed asset.
 *
 * @param sources - Recorded source identities by repository-relative path.
 */
export const ownedCppCallbackProducerClosure = sources => {
	assert.ok(sources && typeof sources === "object" && !Array.isArray(sources));
	const paths = new Set();
	const visit = path => {
		if(paths.has(path)) return;
		paths.add(path);
		const asset = ownedCppCallbackProducerAssets[path];
		if(asset !== undefined) assert.equal(Object.hasOwn(sources, path), false, path);
		const expected = asset ?? sources[path];
		assert.match(expected ?? "", /^[a-f0-9]{64}$/u, path);
		const bytes = bytesAtProducer(ownedCppCallbackProducer, path, expected);
		if(path.endsWith(".json")) return;
		for(const specifier of moduleSpecifiers(bytes.toString("utf8"), path))
		{
			const joined = posix.normalize(posix.join(posix.dirname(path), specifier));
			visit(posix.extname(joined) === "" ? joined + ".mjs" : joined);
		}
	};
	for(const entry of ownedCppCallbackProducerEntries) visit(entry);
	return [...paths].sort();
};

/**
 * Keep fresh generation live. A historical receipt selects one authenticated
 * producer for generators, fixture constants and all deferred source reads.
 *
 * @param sources - Optional authenticated historical source identities.
 */
export const ownedCppCallbackReplay = async sources => {
	if(sources === undefined) return {
		...current, readSource: path => readFile(path, "utf8")
		, readBytes: path => readFile(path)
	};
	ownedCppCallbackProducerClosure(sources);
	const modules = await Promise.all(ownedCppCallbackProducerEntries
		.map(entry => moduleAtProducer(ownedCppCallbackProducer, entry)));
	const exports = Object.assign({}, ...modules);
	const selected = Object.fromEntries(Object.entries(current).map(([name, value]) => {
		assert.equal(typeof exports[name], typeof value, name);
		return [name, exports[name]];
	}));
	const readBytes = async (path, expected = sources[path]) => {
		// CLI package inventories also authenticate files omitted from sources.
		assert.match(expected ?? "", /^[a-f0-9]{64}$/u, path);
		if(sources[path] !== undefined) assert.equal(expected, sources[path], path);
		return bytesAtProducer(ownedCppCallbackProducer, path, expected);
	};
	return { ...selected, readBytes
		, readSource: async (path, expected) => (await readBytes(path, expected)).toString("utf8") };
};
