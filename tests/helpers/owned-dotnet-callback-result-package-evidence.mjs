/**
 * Reconstruct original NuGet callback contracts, managed sources and native files.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { createCompiledNativeModel, generateCompiledNativeLeanAdapters } from "../../src/build/native-graph-model.mjs";
import { generateOwnedCPackage } from "../../src/backends/c/owned-package.mjs";
import { generateOwnedDotnetPackage } from "../../src/backends/dotnet/owned-package.mjs";
import { ownedDotnetAdapterSources } from "../../src/build/owned-dotnet-artifacts.mjs";
import { ownedDotnetCallbackResultConfiguration, ownedDotnetCallbackResultReviewedIr
	, ownedDotnetCallbackResultSource, ownedDotnetCallbackResultCombinedConfiguration
	, ownedDotnetCallbackResultCombinedReviewedIr, ownedDotnetCallbackResultCombinedSource } from "./owned-dotnet-callback-result-fixture.mjs";

const hash = value => sha256(canonicalJson(value));
const inventory = bytes => ({ bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) });

/**
 * Authenticate the .NET projection of either a standalone or combined release.
 *
 * @param item - Original compiler inputs and linked package receipts.
 * @param targets - Exact publishing configuration for this release.
 */
export const assertOwnedDotnetCallbackPackageInputs = async (item, targets = { nuget: { name: "Owned.CallbackResults", version: "1.2.3" } }) => {
	const { mode, combined, input, componentReceipt: component
		, adapterReceipt: adapter
		, compiledProjection: compiled, runtimeReceipt: runtime, manifest } = item;
	assert.ok(["ordinary", "reviewed"].includes(mode)); assert.equal(typeof combined, "boolean");
	const options = { hostCallbacks: combined, transferredInputs: combined
		, anchoredResults: combined, receiverExports: combined
		, callbackResultAnchors: true, valueCopies: true };
	const model = createCompiledNativeModel(input, {
		ownedGraphs: true, ownedHostCallbacks: combined, ownedInputTransfers: combined
		, ownedAnchoredResults: combined, ownedReceiverExports: combined
		, ownedCallbackResultAnchors: true
	});
	assert.equal(model.schemaVersion, 11); assert.equal(model.ownedGraph.schemaVersion, 6);
	assert.equal(model.ownedGraph.callbackResultAnchors.signatures.length, 4);
	const configuration = mode === "ordinary"
		? await (combined ? ownedDotnetCallbackResultCombinedConfiguration : ownedDotnetCallbackResultConfiguration)()
		: { schemaVersion: 1, modules: ["Owned"] };
	configuration.targets = targets;
	assert.equal(model.sourceIdentity.exportConfigurationSource, canonicalJson(configuration));
	assert.equal(model.sourceIdentity.exportConfigurationSha256, hash(configuration));
	assert.equal(Boolean(model.sourceIdentity.reviewedBindingIr), mode === "reviewed");
	if(mode === "reviewed")
	{
		const ir = (combined ? ownedDotnetCallbackResultCombinedReviewedIr : ownedDotnetCallbackResultReviewedIr)();
		assert.equal(model.sourceIdentity.reviewedBindingIr.source, canonicalJson(ir));
		assert.equal(model.sourceIdentity.reviewedBindingIr.sourceSha256, hash(ir));
	}
	assert.equal(model.sourceIdentity.extractorSha256, sha256(await readFile("src/analyze/NativeExports.lean")));
	const lean = await readFile("tests/fixtures/onboarding/owned-aggregates/Owned.lean", "utf8");
	assert.equal(model.sourceIdentity.modules.find(value => value.module === "Owned").source.sha256,
		sha256(lean + (combined ? ownedDotnetCallbackResultCombinedSource : ownedDotnetCallbackResultSource)));
	const c = generateOwnedCPackage({ ...input, ...options });
	const projection = generateOwnedDotnetPackage(model.bindingIr, null, options);
	const native = generateCompiledNativeLeanAdapters(model);
	assert.equal(component.schemaVersion, 7); assert.equal(component.modelSha256, hash(model));
	assert.equal(component.metadataSha256, hash(input.metadata));
	assert.equal(component.headerSha256, sha256(native.header));
	assert.equal(component.adaptersSha256, sha256(native.leanSource));
	assert.equal(component.callbackSourceSha256, combined ? sha256(native.callbackSource) : undefined);
	assert.deepEqual(component.sourceIdentity, model.sourceIdentity);
	assert.equal(adapter.schemaVersion, 5); assert.equal(adapter.ownedValues.schemaVersion, 6);
	assert.equal(adapter.componentReceiptSha256, hash(component));
	assert.equal(adapter.runtimeIdentity, component.runtimeIdentity);
	for(const [key, count] of [["receiverExports", 5], ["resultAnchors", 1], ["inputTransfers", 2]])
	{
		if(combined) assert.equal(model.ownedGraph[key].exports.length, count);
		else assert.equal(model.ownedGraph[key], undefined);
	}
	for(const key of ["callbackResultAnchors", "receiverExports", "resultAnchors", "inputTransfers"])
	{
		assert.deepEqual(component[key], model.ownedGraph[key]);
		assert.deepEqual(adapter.ownedValues[key], model.ownedGraph[key]);
	}
	assert.equal(Boolean(model.ownedGraph.hostCallbacks), combined);
	assert.deepEqual(adapter.ownedValues.hostCallbacks, model.ownedGraph.hostCallbacks);
	assert.equal(adapter.ownedValues.headerSha256, sha256(c.publicHeader));
	assert.equal(adapter.ownedValues.sourceSha256, sha256(c.source));
	assert.deepEqual(adapter.dotnetValues, projection.contract);
	assert.equal(projection.contract.schemaVersion, 5);
	for(const [path, source] of Object.entries(ownedDotnetAdapterSources(c, projection)))
		assert.deepEqual(adapter.files[path], inventory(source), path);
	assert.deepEqual(adapter.gmp, { version: "6.3.0", soname: "libgmp-lean-bridge.so.10", binding: "local-symbols" });
	assert.equal(runtime.schemaVersion, 1); assert.equal(runtime.profile, "native-library-v1");
	assert.equal(runtime.pointerBits, 64); assert.equal(component.runtimeIdentity, hash(runtime));
	const libraries = {
		[adapter.library]: adapter.files[`lib/${adapter.library}`].sha256
		, [component.library]: component.nativeLibrary.sha256
		, "libgmp-lean-bridge.so.10": adapter.files["gmp/lib/libgmp-lean-bridge.so.10"].sha256
		, ...Object.fromEntries(Object.entries(runtime.files).filter(([path]) => path.startsWith("lib/")).map(([path, file]) => [path.slice(4), file.sha256]))
	};
	const evidence = { runtimeIdentity: component.runtimeIdentity
		, componentId: model.component.id
		, componentReceiptSha256: hash(component), ownedValues: projection.contract
		, library: adapter.library, libraries };
	assert.deepEqual(compiled.evidence, evidence); assert.deepEqual(compiled.ownedValues, projection.contract);
	assert.equal(compiled.schemaVersion, 5); assert.equal(compiled.profile, "native-library-v1");
	assert.equal(compiled.assembly, projection.assembly); assert.match(compiled.sdk, /^8\.0\.\d+$/u);
	const packaged = generateOwnedDotnetPackage(model.bindingIr, evidence, options);
	assert.equal(manifest.schemaVersion, 5); assert.equal(manifest.kind, "lean-bridge-owned-nuget-package");
	assert.equal(manifest.ecosystem, "nuget"); assert.equal(manifest.name, "Owned.CallbackResults");
	assert.equal(manifest.version, "1.2.3"); assert.match(manifest.glibcMinimumVersion, /^2\.\d+$/u);
	assert.equal(manifest.namespace, projection.namespace); assert.equal(manifest.assembly, projection.assembly);
	assert.deepEqual(manifest.ownedValues, projection.contract);
	assert.deepEqual(manifest.sourceIdentity, model.sourceIdentity);
	assert.deepEqual(manifest.component, model.component);
	for(const value of [component, adapter, compiled, manifest]) assert.equal(value.bindingIrSha256, model.bindingIrSha256);
	assert.equal(manifest.runtimeIdentity, component.runtimeIdentity);
	assert.equal(manifest.compiledProjectionSha256, hash(compiled));
	for(const [path, source] of Object.entries(packaged.files))
	{
		assert.deepEqual(compiled.files[path], inventory(source), path);
		if(path.startsWith("src/") || path === "binding-manifest.json")
			assert.deepEqual(manifest.files[`lean-bridge/dotnet/${path}`], inventory(source), path);
	}
	const sdk = canonicalJson({ sdk: { version: compiled.sdk, rollForward: "disable", allowPrerelease: false } });
	assert.deepEqual(compiled.files["global.json"], inventory(sdk));
	assert.deepEqual(manifest.files["lean-bridge/dotnet/global.json"], inventory(sdk));
	for(const extension of ["dll", "xml"])
	{
		const path = `lib/net8.0/${projection.assembly}.${extension}`;
		assert.deepEqual(manifest.files[path], compiled.files[path]);
		assert.ok(compiled.files[path].bytes > 0); assert.match(compiled.files[path].sha256, /^[a-f0-9]{64}$/u);
	}
	for(const [file, digest] of Object.entries(libraries))
		assert.equal(manifest.files[`runtimes/linux-x64/native/${file}`].sha256, digest, file);
	for(const [path, value] of [
		["lean-bridge/native-dotnet.json", compiled]
		, ["lean-bridge/native-dotnet-adapter.json", adapter]
		, ["lean-bridge/runtime.json", runtime]
		, ["lean-bridge/component/native-component.json", component]
		, ["lean-bridge/component/model.json", model]
		, ["lean-bridge/component/metadata.json", input.metadata]
		, ["lean-bridge/component/binding-ir.json", model.bindingIr]
	]) assert.deepEqual(manifest.files[path], inventory(canonicalJson(value)), path);
	for(const [path, text] of [
		["generated.lean", native.leanSource], ["component.h", native.header]
		, ...combined ? [["callbacks.c", native.callbackSource]] : []])
		assert.deepEqual(manifest.files[`lean-bridge/component/${path}`], inventory(text), path);
	for(const [path, file] of Object.entries(adapter.files))
		if(!path.startsWith("lib/") && !path.startsWith("gmp/lib/")) assert.deepEqual(manifest.files[`lean-bridge/adapter/${path}`], file, path);
	return { model, projection, packaged };
};
