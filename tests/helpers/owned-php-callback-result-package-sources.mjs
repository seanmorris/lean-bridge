/**
 * Reconstruct installed PHP sources; compiler products remain pinned observations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { createCompiledNativeModel, generateCompiledNativeLeanAdapters } from "../../src/build/native-graph-model.mjs";
import { nativeAllocationGuardHeader } from "../../src/build/native-allocation-guard.mjs";
import { generateOwnedCPackage } from "../../src/backends/c/owned-package.mjs";
import { generateOwnedPhpPackage } from "../../src/backends/php/owned-package.mjs";
import { ownedPhpAdapterSources } from "../../src/build/owned-php-artifacts.mjs";
import { ownedDotnetCallbackResultConfiguration, ownedDotnetCallbackResultReviewedIr
	, ownedDotnetCallbackResultSource, ownedDotnetCallbackResultCombinedConfiguration
	, ownedDotnetCallbackResultCombinedReviewedIr
	, ownedDotnetCallbackResultCombinedSource } from "./owned-dotnet-callback-result-fixture.mjs";

const hash = value => sha256(canonicalJson(value));
const identity = source => ({ bytes: Buffer.byteLength(source), sha256: sha256(source) });

/**
 * Rebuild ordinary/reviewed source identity and generated package/adapter inputs.
 * No compiler, linker, interpreter or package manager is executed by this reader.
 *
 * @param mode - Independently selected ordinary/reviewed source route.
 * @param variant - Independently selected capability shape.
 * @param item - Original authenticated installed observation.
 * @param readSource - Repository source reader, injectable for drift regressions.
 */
export const assertOwnedPhpCallbackPackageSources = async (mode, variant, item, readSource = readFile) => {
	const combined = variant === "combined", hostCallbacks = variant !== "no-host";
	const capabilities = { hostCallbacks, callbackResultAnchors: true
		, transferredInputs: combined, anchoredResults: combined
		, receiverExports: combined };
	const lean = (await readSource("tests/fixtures/onboarding/owned-aggregates/Owned.lean")).toString()
		+ (combined ? ownedDotnetCallbackResultCombinedSource : ownedDotnetCallbackResultSource);
	const configuration = mode === "ordinary"
		? await (combined ? ownedDotnetCallbackResultCombinedConfiguration : ownedDotnetCallbackResultConfiguration)()
		: { schemaVersion: 1, modules: ["Owned"] };
	configuration.targets = { "php-native": { name: "lean-bridge/owned-values", version: "1.2.3" } };
	const reviewedIr = mode === "reviewed" ? (combined ? ownedDotnetCallbackResultCombinedReviewedIr : ownedDotnetCallbackResultReviewedIr)() : null;
	assert.deepEqual(item.sourceInputs, { lean, configuration, reviewedIr });
	const source = item.input.sourceIdentity;
	assert.equal(source.leanVersion, "4.32.2");
	assert.equal(source.leanCommit, "f3b06c705e6c85f5314019d5d3baab0fec5b580c");
	assert.equal(source.leanCompilerSha256, "e8baaa71855a616dc351028f3ad2200051b0671f423a1696a100e809302d5550");
	assert.equal(source.extractorSha256, sha256(await readSource("src/analyze/NativeExports.lean")));
	assert.equal(source.exportConfigurationSource, canonicalJson(configuration));
	assert.equal(source.exportConfigurationSha256, hash(configuration));
	assert.equal(source.modules.length, 1); assert.equal(source.modules[0].module, "Owned");
	assert.deepEqual(source.modules[0].source, { path: "Owned.lean", ...identity(lean) });
	assert.equal(Boolean(source.reviewedBindingIr), mode === "reviewed");
	if(reviewedIr)
	{
		assert.equal(source.reviewedBindingIr.path, "api.binding-ir.json");
		assert.equal(source.reviewedBindingIr.source, canonicalJson(reviewedIr));
		assert.equal(source.reviewedBindingIr.sourceSha256, hash(reviewedIr));
	}
	const model = createCompiledNativeModel(item.input, { ownedGraphs: true
		, ownedHostCallbacks: hostCallbacks, ownedCallbackResultAnchors: true
		, ownedInputTransfers: combined, ownedAnchoredResults: combined
		, ownedReceiverExports: combined });
	assert.equal(model.schemaVersion, 11); assert.equal(model.ownedGraph.schemaVersion, 6);
	assert.equal(model.ownedGraph.callbackResultAnchors.signatures.length, 4);
	for(const name of ["hostCallbacks", "inputTransfers", "resultAnchors", "receiverExports"])
		assert.equal(Boolean(model.ownedGraph[name]), name === "hostCallbacks" ? hostCallbacks : combined);
	const native = generateCompiledNativeLeanAdapters(model), component = item.componentReceipt;
	assert.equal(component.schemaVersion, 7); assert.equal(component.profile, "native-library-v1");
	assert.deepEqual(component.sourceIdentity, source); assert.equal(component.modelSha256, hash(model));
	assert.equal(component.metadataSha256, hash(item.input.metadata)); assert.equal(component.bindingIrSha256, model.bindingIrSha256);
	assert.equal(component.headerSha256, sha256(native.header)); assert.equal(component.adaptersSha256, sha256(native.leanSource));
	assert.equal(component.allocationGuardSha256, sha256(nativeAllocationGuardHeader));
	assert.equal(component.initializer, `initialize_${native.module}`);
	assert.deepEqual(component.exports, model.exports.map(value => ({ declaration: value.name, symbol: value.symbol })));
	for(const name of ["callbackResultAnchors", "inputTransfers", "resultAnchors", "receiverExports"])
		assert.deepEqual(component[name], model.ownedGraph[name]);
	if(hostCallbacks) assert.equal(component.callbackSourceSha256, sha256(native.callbackSource));
	else assert.equal(component.callbackSourceSha256, undefined);
	const c = generateOwnedCPackage({ ...item.input, ...capabilities, valueCopies: true, identityEquality: combined });
	const php = generateOwnedPhpPackage(model.bindingIr, null, capabilities), adapter = item.adapterReceipt;
	assert.equal(adapter.schemaVersion, 5); assert.equal(adapter.profile, "native-library-v1");
	assert.equal(adapter.runtimeIdentity, component.runtimeIdentity); assert.equal(adapter.bindingIrSha256, model.bindingIrSha256);
	assert.equal(adapter.componentReceiptSha256, hash(component)); assert.deepEqual(adapter.phpValues, php.contract);
	assert.deepEqual(adapter.ownedValues, { schemaVersion: 6
		, ...hostCallbacks ? { hostCallbacks: model.ownedGraph.hostCallbacks } : {}
		, ...combined ? { inputTransfers: model.ownedGraph.inputTransfers, resultAnchors: model.ownedGraph.resultAnchors, receiverExports: model.ownedGraph.receiverExports } : {}
		, callbackResultAnchors: model.ownedGraph.callbackResultAnchors
		, headerSha256: sha256(c.publicHeader), sourceSha256: sha256(c.source) });
	assert.deepEqual(adapter.gmp, { version: "6.3.0", soname: "libgmp-lean-bridge.so.10", binding: "local-symbols" });
	const generated = generateOwnedPhpPackage(model.bindingIr, item.nativeEvidence, capabilities);
	assert.deepEqual(item.bindingManifest, JSON.parse(generated.files["binding-manifest.json"]));
	assert.deepEqual(item.packageReceipt.ownedValues, generated.contract);
	assert.deepEqual(item.nativeEvidence.ownedValues, generated.contract);
	assert.equal(item.nativeEvidence.componentReceiptSha256, hash(component));
	assert.equal(item.nativeEvidence.runtimeIdentity, component.runtimeIdentity);
	assert.equal(item.nativeEvidence.libraries[component.library], component.nativeLibrary.sha256);
	assert.equal(item.nativeEvidence.libraries[adapter.library], adapter.files[`lib/${adapter.library}`].sha256);
	const files = new Map(Object.entries(generated.files));
	for(const [path, text] of Object.entries(ownedPhpAdapterSources(c, php)))
	{
		assert.deepEqual(adapter.files[path], identity(text), path);
		files.set(`lean-bridge/adapter/${path}`, text);
	}
	for(const [path, text] of Object.entries({ "native-component.json": canonicalJson(component)
		, "model.json": canonicalJson(model)
		, "metadata.json": canonicalJson(item.input.metadata)
		, "binding-ir.json": canonicalJson(model.bindingIr)
		, "component.h": native.header
		, "generated.lean": native.leanSource
		, "allocation-guard.h": nativeAllocationGuardHeader
		, ...hostCallbacks ? { "callbacks.c": native.callbackSource } : {} })) files.set(`lean-bridge/component/${path}`, text);
	files.set("lean-bridge/native-php-adapter.json", canonicalJson(adapter));
	files.set("licenses/LeanBridge-LICENSE", await readSource("LICENSE"));
	for(const [path, text] of files) assert.deepEqual(item.packageReceipt.files[path], identity(text), path);
	return { model, files };
};
