/**
 * Authenticate one producer for Python callbacks and all combined-release peers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { posix } from "node:path";
import { createCompiledNativeModel, generateCompiledNativeLeanAdapters } from "../../src/build/native-graph-model.mjs";
import { generateOwnedCPackage } from "../../src/backends/c/owned-package.mjs";
import { generateOwnedRustPackage } from "../../src/backends/rust/owned-package.mjs";
import { generateOwnedCppPackage } from "../../src/backends/cpp/owned-package.mjs";
import { compiledPackageMetadata, pythonPackageMetadata } from "../../src/analyze/package-metadata.mjs";
import { copiedRustLock } from "../../src/backends/rust/copied-values.mjs";
import { ownedRustReceiverLinker } from "./owned-rust-receiver-fixture.mjs";
import { createOwnedJavaScriptWasmModel, generateOwnedJavaScriptWasmLeanAdapters } from "../../src/build/javascript-wasm-owned-model.mjs";
import { generateCompiledJavaScriptWasmOwned } from "../../src/build/javascript-wasm-owned-sources.mjs";
import { generateOwnedPythonPackage } from "../../src/backends/python/owned-package.mjs";
import { ownedPythonCallbackResultSource, ownedPythonCallbackResultCombinedSource, ownedPythonCallbackResultReviewedIr, ownedPythonCallbackResultCombinedReviewedIr } from "./owned-python-callback-result-fixture.mjs";
import { ownedPythonCallbackTyping } from "./owned-python-callback-result-typing.mjs";
import { ownedPythonCallbackInstalledProbe } from "./owned-python-callback-result-installed.mjs";
import { ownedPythonInstalledProbe } from "./owned-python-installed-probes.mjs";
import { pythonTypingWheels } from "./python-wheel-install.mjs";
import { ownedPythonCallbackNativeSource } from "./owned-python-callback-result-native.mjs";
import { ownedPythonCallbackMutations } from "./owned-python-callback-result-mutations.mjs";
import { moduleSpecifiers } from "./module-closure.mjs";
import { moduleAtProducerWithSourceReads } from "./producer-module.mjs";
import { bytesAtProducer } from "./producer-source.mjs";

export const ownedPythonCallbackProducer = "0fc33e4fd17f3347d845847f284709208ada1c9e";
export const ownedPythonCallbackProducerEntries = Object.freeze([
	"src/build/native-graph-model.mjs"
	, "src/backends/c/owned-package.mjs"
	, "src/backends/rust/owned-package.mjs"
	, "src/backends/cpp/owned-package.mjs"
	, "src/analyze/package-metadata.mjs"
	, "src/backends/rust/copied-values.mjs"
	, "tests/helpers/owned-rust-receiver-fixture.mjs"
	, "src/build/javascript-wasm-owned-model.mjs"
	, "src/build/javascript-wasm-owned-sources.mjs"
	, "src/backends/python/owned-package.mjs"
	, "tests/helpers/owned-python-callback-result-fixture.mjs"
	, "tests/helpers/owned-python-callback-result-typing.mjs"
	, "tests/helpers/owned-python-callback-result-installed.mjs"
	, "tests/helpers/owned-python-installed-probes.mjs"
	, "tests/helpers/python-wheel-install.mjs"
	, "tests/helpers/owned-python-callback-result-native.mjs"
	, "tests/helpers/owned-python-callback-result-mutations.mjs"
]);
// Original source coverage omits bundled Boost data and the package license.
// Keep independent Git-producer pins, without adding fields to the old receipt.
export const ownedPythonCallbackProducerAssets = Object.freeze({
	"src/backends/cpp/boost.source.json": "2e5ded51d6fa32f4d06d22eaf0bb10f54bdbfcf17731bea4f1554923a09ce10c"
	, LICENSE: "0228993956219f4b7635fc90bdd7e8713e47973c34b0de1f19f8225ec8907996"
});
const current = Object.freeze({
	createCompiledNativeModel
	, generateCompiledNativeLeanAdapters
	, generateOwnedCPackage
	, generateOwnedRustPackage
	, generateOwnedCppPackage
	, compiledPackageMetadata
	, pythonPackageMetadata
	, copiedRustLock
	, ownedRustReceiverLinker
	, createOwnedJavaScriptWasmModel
	, generateOwnedJavaScriptWasmLeanAdapters
	, generateCompiledJavaScriptWasmOwned
	, generateOwnedPythonPackage
	, ownedPythonCallbackResultSource
	, ownedPythonCallbackResultCombinedSource
	, ownedPythonCallbackResultReviewedIr
	, ownedPythonCallbackResultCombinedReviewedIr
	, ownedPythonCallbackTyping
	, ownedPythonCallbackInstalledProbe
	, ownedPythonInstalledProbe
	, pythonTypingWheels
	, ownedPythonCallbackNativeSource
	, ownedPythonCallbackMutations
});

/**
 * Require every relative import to match its receipt or fixed producer asset.
 *
 * @param sources - Original receipt source identities.
 */
export const ownedPythonCallbackProducerClosure = sources => {
	assert.ok(sources && typeof sources === "object" && !Array.isArray(sources));
	const paths = new Set();
	const visit = path => {
		if(paths.has(path)) return;
		paths.add(path);
		const asset = ownedPythonCallbackProducerAssets[path];
		if(asset !== undefined) assert.equal(Object.hasOwn(sources, path), false, path);
		const expected = asset ?? sources[path];
		assert.match(expected ?? "", /^[a-f0-9]{64}$/u, path);
		const bytes = bytesAtProducer(ownedPythonCallbackProducer, path, expected);
		if(path.endsWith(".json")) return;
		for(const specifier of moduleSpecifiers(bytes.toString("utf8"), path))
		{
			const joined = posix.normalize(posix.join(posix.dirname(path), specifier));
			visit(posix.extname(joined) === "" ? joined + ".mjs" : joined);
		}
	};
	for(const entry of ownedPythonCallbackProducerEntries) visit(entry);
	return [...paths].sort();
};

/**
 * Select live generation or the fixed source-bound historical producer.
 * Deferred reads inside generator modules must use that same producer.
 *
 * @param sources - Optional original receipt source map.
 */
export const ownedPythonCallbackReplay = async sources => {
	if(sources === undefined) return {
		...current, readSource: path => readFile(path, "utf8")
		, readBytes: path => readFile(path)
	};
	ownedPythonCallbackProducerClosure(sources);
	const modules = await Promise.all(ownedPythonCallbackProducerEntries
		.map(entry => moduleAtProducerWithSourceReads(ownedPythonCallbackProducer, entry)));
	const exports = Object.assign({}, ...modules);
	const selected = Object.fromEntries(Object.entries(current).map(([name, value]) => {
		assert.equal(typeof exports[name], typeof value, name);
		return [name, exports[name]];
	}));
	const readBytes = async (path, expected = sources[path] ?? ownedPythonCallbackProducerAssets[path]) => {
		assert.match(expected ?? "", /^[a-f0-9]{64}$/u, path);
		if(sources[path] !== undefined) assert.equal(expected, sources[path], path);
		const asset = ownedPythonCallbackProducerAssets[path];
		if(asset !== undefined)
		{
			assert.equal(Object.hasOwn(sources, path), false, path);
			assert.equal(expected, asset, path);
		}
		return bytesAtProducer(ownedPythonCallbackProducer, path, expected);
	};
	return { ...selected, readBytes
		, readSource: async (path, expected) => (await readBytes(path, expected)).toString("utf8") };
};
