/**
 * Authenticate one producer for .NET callbacks and all combined-release peers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { posix } from "node:path";
import { createCompiledNativeModel, generateCompiledNativeLeanAdapters } from "../../src/build/native-graph-model.mjs";
import { generateOwnedCPackage } from "../../src/backends/c/owned-package.mjs";
import { generateOwnedDotnetCalls } from "../../src/backends/dotnet/owned-calls.mjs";
import { generateOwnedDotnetPackage } from "../../src/backends/dotnet/owned-package.mjs";
import { ownedDotnetAdapterSources } from "../../src/build/owned-dotnet-artifacts.mjs";
import { ownedDotnetNativeProbe } from "./owned-dotnet-native.mjs";
import { ownedDotnetReceiverProject, instrumentOwnedDotnetReceivers } from "./owned-dotnet-receiver-fixture.mjs";
import { ownedDotnetCallbackResultConfiguration, ownedDotnetCallbackResultReviewedIr, ownedDotnetCallbackResultSource, ownedDotnetCallbackResultCombinedConfiguration, ownedDotnetCallbackResultCombinedReviewedIr, ownedDotnetCallbackResultCombinedSource } from "./owned-dotnet-callback-result-fixture.mjs";
import { ownedDotnetCallbackResultProbe, ownedDotnetCallbackLifetimeProbe, ownedDotnetCallbackSanitizerProbe, ownedDotnetCallbackForkProbe } from "./owned-dotnet-callback-result-probes.mjs";
import { ownedDotnetCallbackInstalledProbe, ownedDotnetCallbackInvalidPrograms } from "./owned-dotnet-callback-result-installed.mjs";
import { ownedDotnetCallbackInstalledProcessProbe, ownedDotnetCallbackProcessProject } from "./owned-dotnet-callback-result-installed-process.mjs";
import { ownedDotnetSanitizerControls } from "./owned-dotnet-callback-result-sanitizers.mjs";
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
import { generateOwnedRubyPackage } from "../../src/backends/ruby/owned-package.mjs";
import { ownedRubyAdapterSources } from "../../src/build/owned-ruby-artifacts.mjs";
import { ownedRubyCallbackResultSource, ownedRubyCallbackResultCombinedSource } from "./owned-ruby-callback-result-fixture.mjs";
import { ownedRubyCallbackInstalledProbe } from "./owned-ruby-callback-result-installed.mjs";
import { ownedRubyCallbackNativeSource } from "./owned-ruby-callback-result-native.mjs";
import { ownedRubyCallbackMutations } from "./owned-ruby-callback-result-mutations.mjs";
import { normalizeOwnedRubySanitizer } from "./owned-ruby-callback-result-sanitizers.mjs";
import { moduleSpecifiers } from "./module-closure.mjs";
import { moduleAtProducerWithSourceReads } from "./producer-module.mjs";
import { bytesAtProducer } from "./producer-source.mjs";

export const ownedDotnetCallbackProducer = "72d123d69917f1145ec03d8624b6a08c3b2be6bc";
const producerIdentityPath = "src/backends/dotnet/owned-calls.mjs";
const ownedDotnetCallbackProducerIdentity
	= "ce8c0ece4937825b72b7e223ddf1e3e01b24e5cac4be81d6ea5d2ec24745e74f";
export const ownedRubyCallbackProducer
	= "2dae24728fa2ac81677f6c76b674dbe5c3be3f73";
const ownedRubyCallbackProducerIdentity
	= "a7058d0f5744463ab39aab1ee8ab79c99545cf03b68b750ae6deb6b89cd60558";
const ownedRubyCallbackFixturePath
	= "tests/helpers/owned-ruby-callback-result-fixture.mjs";
const ownedRubyCallbackFixtureIdentity
	= "7cc7e47fcd1da150b9f9656c86a41df8cbef13e89a0feb513460a0a165dc527e";

export const ownedDotnetCallbackProducerEntries = Object.freeze([
	"src/build/native-graph-model.mjs"
	, "src/backends/c/owned-package.mjs"
	, "src/backends/dotnet/owned-calls.mjs"
	, "src/backends/dotnet/owned-package.mjs"
	, "src/build/owned-dotnet-artifacts.mjs"
	, "tests/helpers/owned-dotnet-native.mjs"
	, "tests/helpers/owned-dotnet-receiver-fixture.mjs"
	, "tests/helpers/owned-dotnet-callback-result-fixture.mjs"
	, "tests/helpers/owned-dotnet-callback-result-probes.mjs"
	, "tests/helpers/owned-dotnet-callback-result-installed.mjs"
	, "tests/helpers/owned-dotnet-callback-result-installed-process.mjs"
	, "tests/helpers/owned-dotnet-callback-result-sanitizers.mjs"
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
	, "src/backends/ruby/owned-package.mjs"
	, "src/build/owned-ruby-artifacts.mjs"
	, "tests/helpers/owned-ruby-callback-result-fixture.mjs"
	, "tests/helpers/owned-ruby-callback-result-installed.mjs"
]);
const ownedRubyCallbackProducerEntries = Object.freeze([
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
	, "src/backends/ruby/owned-package.mjs"
	, "src/build/owned-ruby-artifacts.mjs"
	, ownedRubyCallbackFixturePath
	, "tests/helpers/owned-ruby-callback-result-installed.mjs"
	, "tests/helpers/owned-ruby-callback-result-native.mjs"
	, "tests/helpers/owned-ruby-callback-result-mutations.mjs"
	, "tests/helpers/owned-ruby-callback-result-sanitizers.mjs"
]);
// Original source coverage omits bundled Boost data and the package license.
// Keep independent Git-producer pins, without adding fields to the old receipt.
export const ownedDotnetCallbackProducerAssets = Object.freeze({
	"src/backends/cpp/boost.source.json": "2e5ded51d6fa32f4d06d22eaf0bb10f54bdbfcf17731bea4f1554923a09ce10c"
	, LICENSE: "0228993956219f4b7635fc90bdd7e8713e47973c34b0de1f19f8225ec8907996"
});
const ownedDotnetCallbackCurrent = Object.freeze({
	createCompiledNativeModel, generateCompiledNativeLeanAdapters
	, generateOwnedCPackage
	, generateOwnedDotnetCalls
	, generateOwnedDotnetPackage
	, ownedDotnetAdapterSources
	, ownedDotnetNativeProbe
	, ownedDotnetReceiverProject, instrumentOwnedDotnetReceivers
	, ownedDotnetCallbackResultConfiguration
	, ownedDotnetCallbackResultReviewedIr
	, ownedDotnetCallbackResultSource
	, ownedDotnetCallbackResultCombinedConfiguration
	, ownedDotnetCallbackResultCombinedReviewedIr
	, ownedDotnetCallbackResultCombinedSource
	, ownedDotnetCallbackResultProbe
	, ownedDotnetCallbackLifetimeProbe
	, ownedDotnetCallbackSanitizerProbe
	, ownedDotnetCallbackForkProbe
	, ownedDotnetCallbackInstalledProbe, ownedDotnetCallbackInvalidPrograms
	, ownedDotnetCallbackInstalledProcessProbe, ownedDotnetCallbackProcessProject
	, ownedDotnetSanitizerControls
	, generateOwnedRustPackage
	, generateOwnedCppPackage
	, compiledPackageMetadata, pythonPackageMetadata
	, copiedRustLock
	, ownedRustReceiverLinker
	, createOwnedJavaScriptWasmModel, generateOwnedJavaScriptWasmLeanAdapters
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
	, generateOwnedRubyPackage
	, ownedRubyAdapterSources
	, ownedRubyCallbackResultSource, ownedRubyCallbackResultCombinedSource
	, ownedRubyCallbackInstalledProbe
});
const current = Object.freeze({
	...ownedDotnetCallbackCurrent
	, ownedRubyCallbackNativeSource, ownedRubyCallbackMutations
	, normalizeOwnedRubySanitizer
});
const ownedRubyCallbackCurrentNames = Object.freeze([
	"createCompiledNativeModel", "generateCompiledNativeLeanAdapters"
	, "generateOwnedCPackage", "generateOwnedRustPackage"
	, "generateOwnedCppPackage", "compiledPackageMetadata"
	, "pythonPackageMetadata", "copiedRustLock", "ownedRustReceiverLinker"
	, "createOwnedJavaScriptWasmModel"
	, "generateOwnedJavaScriptWasmLeanAdapters"
	, "generateCompiledJavaScriptWasmOwned", "generateOwnedPythonPackage"
	, "ownedPythonCallbackResultSource"
	, "ownedPythonCallbackResultCombinedSource"
	, "ownedPythonCallbackResultReviewedIr"
	, "ownedPythonCallbackResultCombinedReviewedIr"
	, "ownedPythonCallbackTyping", "ownedPythonCallbackInstalledProbe"
	, "ownedPythonInstalledProbe", "pythonTypingWheels"
	, "generateOwnedRubyPackage", "ownedRubyAdapterSources"
	, "ownedRubyCallbackResultSource"
	, "ownedRubyCallbackResultCombinedSource"
	, "ownedRubyCallbackInstalledProbe"
	, "ownedRubyCallbackNativeSource", "ownedRubyCallbackMutations"
	, "normalizeOwnedRubySanitizer"
]);

const producerProfile = sources => {
	const identity = sources?.[producerIdentityPath];
	if(identity === ownedDotnetCallbackProducerIdentity) return {
		producer: ownedDotnetCallbackProducer
		, entries: ownedDotnetCallbackProducerEntries
		, names: Object.keys(ownedDotnetCallbackCurrent)
	};
	if(identity === ownedRubyCallbackProducerIdentity
		&& sources?.[ownedRubyCallbackFixturePath]
			=== ownedRubyCallbackFixtureIdentity)
		return {
			producer: ownedRubyCallbackProducer
			, entries: ownedRubyCallbackProducerEntries
			, names: ownedRubyCallbackCurrentNames
		};
	assert.fail(`Unknown callback producer: ${identity ?? "missing"}`);
};

/**
 * Require every relative import to match its receipt or fixed producer asset.
 *
 * @param sources - Original receipt source identities.
 */
export const ownedDotnetCallbackProducerClosure = sources => {
	assert.ok(sources && typeof sources === "object" && !Array.isArray(sources));
	const { producer, entries } = producerProfile(sources);
	const paths = new Set();
	const visit = path => {
		if(paths.has(path)) return;
		paths.add(path);
		const asset = ownedDotnetCallbackProducerAssets[path];
		if(asset !== undefined) assert.equal(Object.hasOwn(sources, path), false, path);
		const expected = asset ?? sources[path];
		assert.match(expected ?? "", /^[a-f0-9]{64}$/u, path);
		const bytes = bytesAtProducer(producer, path, expected);
		if(path.endsWith(".json")) return;
		for(const specifier of moduleSpecifiers(bytes.toString("utf8"), path))
		{
			const joined = posix.normalize(posix.join(posix.dirname(path), specifier));
			visit(posix.extname(joined) === "" ? joined + ".mjs" : joined);
		}
	};
	for(const entry of entries) visit(entry);
	return [...paths].sort();
};

/**
 * Select live generation or the fixed source-bound historical producer.
 * Deferred reads inside generator modules must use that same producer.
 *
 * @param sources - Optional original receipt source map.
 */
export const ownedDotnetCallbackReplay = async sources => {
	if(sources === undefined) return {
		...current, readSource: path => readFile(path, "utf8")
		, readBytes: path => readFile(path)
	};
	const { producer, entries, names } = producerProfile(sources);
	ownedDotnetCallbackProducerClosure(sources);
	const modules = await Promise.all(entries
		.map(entry => moduleAtProducerWithSourceReads(producer, entry)));
	const exports = Object.assign({}, ...modules);
	const selected = Object.fromEntries(names.map(name => {
		const value = current[name];
		assert.equal(typeof exports[name], typeof value, name);
		return [name, exports[name]];
	}));
	const readBytes = async (path, expected = sources[path] ?? ownedDotnetCallbackProducerAssets[path]) => {
		assert.match(expected ?? "", /^[a-f0-9]{64}$/u, path);
		if(sources[path] !== undefined) assert.equal(expected, sources[path], path);
		const asset = ownedDotnetCallbackProducerAssets[path];
		if(asset !== undefined)
		{
			assert.equal(Object.hasOwn(sources, path), false, path);
			assert.equal(expected, asset, path);
		}
		return bytesAtProducer(producer, path, expected);
	};
	return { ...selected, readBytes
		, readSource: async (path, expected) => (await readBytes(path, expected)).toString("utf8") };
};
