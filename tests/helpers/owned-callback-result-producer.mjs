/**
 * Select current generators or the exact source-bound callback-result producer.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { posix } from "node:path";
import { createCompiledNativeModel, generateCompiledNativeLeanAdapters } from "../../src/build/native-graph-model.mjs";
import { generateOwnedCPackage } from "../../src/backends/c/owned-package.mjs";
import { generateOwnedNativeValueAdapters } from "../../src/backends/native/owned-value-adapters.mjs";
import { generateOwnedWasmComponent } from "../../src/backends/javascript/owned-wasm-component.mjs";
import { generateJavaScriptPackage } from "../../src/backends/javascript/generate.mjs";
import { createOwnedJavaScriptWasmModel, generateOwnedJavaScriptWasmLeanAdapters } from "../../src/build/javascript-wasm-owned-model.mjs";
import { generateCompiledJavaScriptWasmOwned } from "../../src/build/javascript-wasm-owned-sources.mjs";
import { ownedJavaScriptWasmNativeProbe } from "./owned-javascript-wasm-native.mjs";
import { ownedCallbackResultSource, ownedCallbackResultCombinedSource } from "./owned-callback-result-fixture.mjs";
import { moduleSpecifiers } from "./module-closure.mjs";
import { moduleAtProducer } from "./producer-module.mjs";
import { bytesAtProducer, sourceAtProducer } from "./producer-source.mjs";

export const ownedCallbackResultProducer = "44c6789c830869b9923245cb38c29d4215da1433";
export const ownedCallbackResultProducerEntries = Object.freeze([
	"src/build/native-graph-model.mjs"
	, "src/backends/c/owned-package.mjs"
	, "src/backends/native/owned-value-adapters.mjs"
	, "src/backends/javascript/owned-wasm-component.mjs"
	, "src/backends/javascript/generate.mjs"
	, "src/build/javascript-wasm-owned-model.mjs"
	, "src/build/javascript-wasm-owned-sources.mjs"
	, "tests/helpers/owned-javascript-wasm-native.mjs"
	, "tests/helpers/owned-callback-result-fixture.mjs"
]);
const current = Object.freeze({
	createCompiledNativeModel, generateCompiledNativeLeanAdapters
	, generateOwnedCPackage, generateOwnedNativeValueAdapters
	, generateOwnedWasmComponent, generateJavaScriptPackage
	, createOwnedJavaScriptWasmModel, generateOwnedJavaScriptWasmLeanAdapters
	, generateCompiledJavaScriptWasmOwned, ownedJavaScriptWasmNativeProbe
	, ownedCallbackResultSource, ownedCallbackResultCombinedSource
});

/**
 * Require every imported generator and fixture module to match the receipt.
 *
 * @param sources - Original receipt source identities by repository-relative path.
 */
export const ownedCallbackResultProducerClosure = sources => {
	assert.ok(sources && typeof sources === "object" && !Array.isArray(sources));
	const paths = new Set();
	const visit = path => {
		if(paths.has(path)) return;
		paths.add(path);
		assert.match(sources[path] ?? "", /^[a-f0-9]{64}$/u, path);
		const bytes = bytesAtProducer(ownedCallbackResultProducer, path, sources[path]);
		if(path.endsWith(".json")) return;
		for(const specifier of moduleSpecifiers(bytes.toString("utf8"), path))
		{
			const joined = posix.normalize(posix.join(posix.dirname(path), specifier));
			visit(posix.extname(joined) === "" ? `${joined}.mjs` : joined);
		}
	};
	for(const entry of ownedCallbackResultProducerEntries) visit(entry);
	return [...paths].sort();
};

/**
 * Preserve live generation when no historical receipt was selected. Historical
 * modules and deferred fixture/runtime source reads all use the same producer.
 *
 * @param sources - Optional authenticated historical receipt source identities.
 */
export const ownedCallbackResultReplay = async sources => {
	if(sources === undefined) return {
		...current, readBytes: path => readFile(path)
		, readSource: path => readFile(path, "utf8")
	};
	ownedCallbackResultProducerClosure(sources);
	const modules = await Promise.all(ownedCallbackResultProducerEntries
		.map(entry => moduleAtProducer(ownedCallbackResultProducer, entry)));
	const exports = Object.assign({}, ...modules);
	const selected = Object.fromEntries(Object.entries(current).map(([name, value]) => {
		assert.equal(typeof exports[name], typeof value, name);
		return [name, exports[name]];
	}));
	return { ...selected, readBytes: async (path, expected = sources[path]) => {
		assert.match(expected ?? "", /^[a-f0-9]{64}$/u, path);
		return bytesAtProducer(ownedCallbackResultProducer, path, expected);
	}
	, readSource: async path => {
		assert.match(sources[path] ?? "", /^[a-f0-9]{64}$/u, path);
		return sourceAtProducer(ownedCallbackResultProducer, path, sources[path]);
	} };
};
