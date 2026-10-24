/**
 * Authenticate one producer for JVM callbacks and all combined-release peers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { posix } from "node:path";
import { createCompiledNativeModel, generateCompiledNativeLeanAdapters } from "../../src/build/native-graph-model.mjs";
import { generateOwnedCPackage } from "../../src/backends/c/owned-package.mjs";
import { generateOwnedDotnetPackage } from "../../src/backends/dotnet/owned-package.mjs";
import { ownedDotnetAdapterSources } from "../../src/build/owned-dotnet-artifacts.mjs";
import { ownedDotnetCallbackResultConfiguration, ownedDotnetCallbackResultReviewedIr, ownedDotnetCallbackResultSource, ownedDotnetCallbackResultCombinedConfiguration, ownedDotnetCallbackResultCombinedReviewedIr, ownedDotnetCallbackResultCombinedSource } from "./owned-dotnet-callback-result-fixture.mjs";
import { ownedDotnetCallbackForkProbe } from "./owned-dotnet-callback-result-probes.mjs";
import { ownedDotnetCallbackInstalledProbe, ownedDotnetCallbackInvalidPrograms } from "./owned-dotnet-callback-result-installed.mjs";
import { ownedDotnetCallbackInstalledProcessProbe, ownedDotnetCallbackProcessProject } from "./owned-dotnet-callback-result-installed-process.mjs";
import { generateOwnedRustPackage } from "../../src/backends/rust/owned-package.mjs";
import { generateOwnedCppPackage } from "../../src/backends/cpp/owned-package.mjs";
import { compiledPackageMetadata, pythonPackageMetadata, mavenPackageMetadata } from "../../src/analyze/package-metadata.mjs";
import { copiedRustLock } from "../../src/backends/rust/copied-values.mjs";
import { ownedRustReceiverLinker } from "./owned-rust-receiver-fixture.mjs";
import { createOwnedJavaScriptWasmModel, generateOwnedJavaScriptWasmLeanAdapters, javascriptWasmOwnedProfile } from "../../src/build/javascript-wasm-owned-model.mjs";
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
import { generateOwnedAggregateCarriers } from "../../src/build/owned-aggregate-carriers.mjs";
import { generateOwnedJvmCalls } from "../../src/backends/jvm/owned-calls.mjs";
import { generateOwnedJvmPackage } from "../../src/backends/jvm/owned-package.mjs";
import { ownedJvmAdapterSources } from "../../src/build/owned-jvm-artifacts.mjs";
import { nativeAllocationGuardHeader } from "../../src/build/native-allocation-guard.mjs";
import { javascriptWasmOwnedPins, javascriptWasmTargetHeaders } from "../../src/build/javascript-wasm-owned-artifacts.mjs";
import { ownedJvmCallNative } from "./owned-jvm-call-fixture.mjs";
import { ownedJvmCallbackResultRuntimeProbes } from "./owned-jvm-callback-result-runtime.mjs";
import { ownedJvmCallbackResultInstalledFixture } from "./owned-jvm-callback-result-installed.mjs";
import { javaCompilerOptions, kotlinCompilerOptions, jvmConsumerPom, mavenSettings } from "./type-corpus-jvm-tools.mjs";
import { ownedJvmCallbackResultProcessSources } from "./owned-jvm-callback-result-process.mjs";
import { ownedJvmCallbackSanitizerControls, ownedJvmCallbackSanitizerDriver } from "./owned-jvm-callback-result-sanitizers.mjs";
import { moduleSpecifiers } from "./module-closure.mjs";
import { moduleAtProducerWithSourceReads } from "./producer-module.mjs";
import { bytesAtProducer } from "./producer-source.mjs";

export const ownedJvmCallbackProducer = "95978558fed7e305833175f36a93a140ff84be9e";
export const ownedJvmCallbackProducerEntries = Object.freeze([
	"src/build/native-graph-model.mjs"
	, "src/backends/c/owned-package.mjs"
	, "src/backends/dotnet/owned-package.mjs"
	, "src/build/owned-dotnet-artifacts.mjs"
	, "tests/helpers/owned-dotnet-callback-result-fixture.mjs"
	, "tests/helpers/owned-dotnet-callback-result-probes.mjs"
	, "tests/helpers/owned-dotnet-callback-result-installed.mjs"
	, "tests/helpers/owned-dotnet-callback-result-installed-process.mjs"
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
	, "src/build/owned-aggregate-carriers.mjs"
	, "src/backends/jvm/owned-calls.mjs"
	, "src/backends/jvm/owned-package.mjs"
	, "src/build/owned-jvm-artifacts.mjs"
	, "src/build/native-allocation-guard.mjs"
	, "src/build/javascript-wasm-owned-artifacts.mjs"
	, "tests/helpers/owned-jvm-call-fixture.mjs"
	, "tests/helpers/owned-jvm-callback-result-runtime.mjs"
	, "tests/helpers/owned-jvm-callback-result-installed.mjs"
	, "tests/helpers/type-corpus-jvm-tools.mjs"
	, "tests/helpers/owned-jvm-callback-result-process.mjs"
	, "tests/helpers/owned-jvm-callback-result-sanitizers.mjs"
]);
// Original coverage omits Boost data, Maven fixture tools and the license.
// Keep independent Git-producer pins, without adding fields to the old receipt.
export const ownedJvmCallbackProducerAssets = Object.freeze({
	"src/backends/cpp/boost.source.json": "2e5ded51d6fa32f4d06d22eaf0bb10f54bdbfcf17731bea4f1554923a09ce10c"
	, "tests/helpers/type-corpus-jvm-tools.mjs": "5f21567ed7dfd107bad21bfe3e57a448d1a525890133b684cf6a7758e4a334a7"
	, LICENSE: "0228993956219f4b7635fc90bdd7e8713e47973c34b0de1f19f8225ec8907996"
});
const current = Object.freeze({
	createCompiledNativeModel
	, generateCompiledNativeLeanAdapters
	, generateOwnedCPackage
	, generateOwnedDotnetPackage
	, ownedDotnetAdapterSources
	, ownedDotnetCallbackResultConfiguration
	, ownedDotnetCallbackResultReviewedIr
	, ownedDotnetCallbackResultSource
	, ownedDotnetCallbackResultCombinedConfiguration
	, ownedDotnetCallbackResultCombinedReviewedIr
	, ownedDotnetCallbackResultCombinedSource
	, ownedDotnetCallbackForkProbe
	, ownedDotnetCallbackInstalledProbe
	, ownedDotnetCallbackInvalidPrograms
	, ownedDotnetCallbackInstalledProcessProbe
	, ownedDotnetCallbackProcessProject
	, generateOwnedRustPackage
	, generateOwnedCppPackage
	, compiledPackageMetadata
	, pythonPackageMetadata
	, mavenPackageMetadata
	, copiedRustLock
	, ownedRustReceiverLinker
	, createOwnedJavaScriptWasmModel
	, generateOwnedJavaScriptWasmLeanAdapters
	, javascriptWasmOwnedProfile
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
	, ownedRubyCallbackResultSource
	, ownedRubyCallbackResultCombinedSource
	, ownedRubyCallbackInstalledProbe
	, generateOwnedAggregateCarriers
	, generateOwnedJvmCalls
	, generateOwnedJvmPackage
	, ownedJvmAdapterSources
	, nativeAllocationGuardHeader
	, javascriptWasmOwnedPins
	, javascriptWasmTargetHeaders
	, ownedJvmCallNative
	, ownedJvmCallbackResultRuntimeProbes
	, ownedJvmCallbackResultInstalledFixture
	, javaCompilerOptions
	, kotlinCompilerOptions
	, jvmConsumerPom
	, mavenSettings
	, ownedJvmCallbackResultProcessSources
	, ownedJvmCallbackSanitizerControls
	, ownedJvmCallbackSanitizerDriver
});

/**
 * Require every relative import to match its receipt or fixed producer asset.
 *
 * @param sources - Original receipt source identities.
 */
export const ownedJvmCallbackProducerClosure = sources => {
	assert.ok(sources && typeof sources === "object" && !Array.isArray(sources));
	const paths = new Set();
	const visit = path => {
		if(paths.has(path)) return;
		paths.add(path);
		const asset = ownedJvmCallbackProducerAssets[path];
		if(asset !== undefined) assert.equal(Object.hasOwn(sources, path), false, path);
		const expected = asset ?? sources[path];
		assert.match(expected ?? "", /^[a-f0-9]{64}$/u, path);
		const bytes = bytesAtProducer(ownedJvmCallbackProducer, path, expected);
		if(path.endsWith(".json")) return;
		for(const specifier of moduleSpecifiers(bytes.toString("utf8"), path))
		{
			const joined = posix.normalize(posix.join(posix.dirname(path), specifier));
			visit(posix.extname(joined) === "" ? joined + ".mjs" : joined);
		}
	};
	for(const entry of ownedJvmCallbackProducerEntries) visit(entry);
	return [...paths].sort();
};

/**
 * Select live generation or the fixed source-bound historical producer.
 * Deferred reads inside generator modules must use that same producer.
 *
 * @param sources - Optional original receipt source map.
 */
export const ownedJvmCallbackReplay = async sources => {
	if(sources === undefined) return {
		...current, readFile, readSource: path => readFile(path, "utf8")
		, readBytes: path => readFile(path)
	};
	ownedJvmCallbackProducerClosure(sources);
	const modules = await Promise.all(ownedJvmCallbackProducerEntries
		.map(entry => moduleAtProducerWithSourceReads(ownedJvmCallbackProducer, entry)));
	const exports = Object.assign({}, ...modules);
	const selected = Object.fromEntries(Object.entries(current).map(([name, value]) => {
		assert.equal(typeof exports[name], typeof value, name);
		return [name, exports[name]];
	}));
	const readBytes = async (path, expected = sources[path] ?? ownedJvmCallbackProducerAssets[path]) => {
		assert.match(expected ?? "", /^[a-f0-9]{64}$/u, path);
		if(sources[path] !== undefined) assert.equal(expected, sources[path], path);
		const asset = ownedJvmCallbackProducerAssets[path];
		if(asset !== undefined)
		{
			assert.equal(Object.hasOwn(sources, path), false, path);
			assert.equal(expected, asset, path);
		}
		return bytesAtProducer(ownedJvmCallbackProducer, path, expected);
	};
	return { ...selected, readBytes
		, readFile: async (path, encoding) => {
			const bytes = await readBytes(path);
			return encoding ? bytes.toString(encoding) : bytes;
		}
		, readSource: async (path, expected) => (await readBytes(path, expected)).toString("utf8") };
};
