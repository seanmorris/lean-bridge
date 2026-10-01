/**
 * Authenticate the receiver NuGet packages against their compiled native model.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { generateOwnedCPackage } from "../../src/backends/c/owned-package.mjs";
import { generateOwnedDotnetPackage } from "../../src/backends/dotnet/owned-package.mjs";
import { createCompiledNativeModel, generateCompiledNativeLeanAdapters } from "../../src/build/native-graph-model.mjs";
import { ownedDotnetAdapterSources } from "../../src/build/owned-dotnet-artifacts.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { ownedRustReceiverSource } from "./owned-rust-receiver-fixture.mjs";
import { ownedDotnetInstalledReceiverProbe, ownedDotnetReceiverInvalidPrograms } from "./owned-dotnet-receiver-installed.mjs";

const options = { transferredInputs: true, anchoredResults: true, receiverExports: true, hostCallbacks: true };
const capabilities = { ownedGraphs: true, ownedHostCallbacks: true
	, ownedInputTransfers: true, ownedAnchoredResults: true
	, ownedReceiverExports: true };

/**
 * Check independently rebuilt packages, source-free consumers and exact CLI inputs.
 *
 * @param record - Both original package reports and the complete acceptance log.
 */
export const assertOwnedDotnetReceiverPackages = async record => {
	assert.deepEqual(record.packages.map(item => item.mode), ["ordinary", "reviewed"]);
	const consumer = await ownedDotnetInstalledReceiverProbe();
	const example = await readFile("tests/fixtures/documentation/consumers/dotnet/owned-receivers.cs", "utf8");
	const guide = await readFile("docs/consume/dotnet.md", "utf8");
	assert.equal(guide.split("```csharp file=dotnet/owned-receivers.cs\n")[1].split("\n```")[0] + "\n", example);
	const lean = await readFile("tests/fixtures/onboarding/owned-aggregates/Owned.lean", "utf8");
	const cliConfig = JSON.parse(await readFile("config/cli-package.v1.json", "utf8"));
	for(const item of record.packages)
	{
		for(const field of ["compiledLean", "installedPackage", "installedNuget"
			, "sourceUnchanged", "sourceFreeInstallation", "sourceFreeRelocatedExecution"
			, "handoffRemoved", "packageCacheRemoved", "sdkFreeExecution"
			, "consumerSourceRemoved", "deterministicReassembly"
			, "independentProducerBuild", "safePublicApi"])
			assert.equal(item[field], true, field);
		const input = { ...item.input, ...options }, model = createCompiledNativeModel(input, capabilities);
		assert.equal(Boolean(model.sourceIdentity.reviewedBindingIr), item.mode === "reviewed");
		assert.equal(model.sourceIdentity.modules.find(module => module.module === "Owned").source.sha256, sha256(lean + ownedRustReceiverSource));
		assert.equal(model.schemaVersion, 10); assert.equal(model.ownedGraph.schemaVersion, 5);
		assert.equal(model.exports.length, 27); assert.equal(model.ownedGraph.receiverExports.exports.length, 16);
		assert.equal(model.ownedGraph.resultAnchors.exports.length, 20); assert.equal(model.ownedGraph.inputTransfers.exports.length, 4);
		const { componentReceipt: component, adapterReceipt: adapter
			, runtimeReceipt: runtime, packageSetReceipt: packages
			, compiledProjection: compiled, manifest } = item;
		const native = generateCompiledNativeLeanAdapters(model), c = generateOwnedCPackage(input);
		const dotnet = generateOwnedDotnetPackage(model.bindingIr, null, options);
		for(const receipt of [component, adapter, compiled, manifest]) assert.equal(receipt.bindingIrSha256, model.bindingIrSha256);
		assert.equal(component.schemaVersion, 6); assert.equal(adapter.schemaVersion, 4); assert.equal(adapter.ownedValues.schemaVersion, 5);
		assert.equal(component.modelSha256, sha256(canonicalJson(model)));
		assert.equal(component.headerSha256, sha256(native.header)); assert.equal(component.adaptersSha256, sha256(native.leanSource));
		assert.equal(component.callbackSourceSha256, sha256(native.callbackSource));
		assert.equal(adapter.runtimeIdentity, component.runtimeIdentity); assert.equal(manifest.runtimeIdentity, component.runtimeIdentity);
		assert.deepEqual(manifest.sourceIdentity, model.sourceIdentity); assert.deepEqual(manifest.component, model.component);
		assert.equal(adapter.componentReceiptSha256, sha256(canonicalJson(component)));
		assert.equal(adapter.ownedValues.headerSha256, sha256(c.publicHeader)); assert.equal(adapter.ownedValues.sourceSha256, sha256(c.source));
		for(const field of ["receiverExports", "resultAnchors", "inputTransfers"])
		{
			assert.deepEqual(component[field], model.ownedGraph[field]); assert.deepEqual(adapter.ownedValues[field], model.ownedGraph[field]);
		}
		assert.deepEqual(adapter.ownedValues.hostCallbacks, model.ownedGraph.hostCallbacks);
		assert.deepEqual(adapter.dotnetValues, dotnet.contract); assert.equal(dotnet.contract.schemaVersion, 4);
		assert.deepEqual(adapter.gmp, { version: "6.3.0", soname: "libgmp-lean-bridge.so.10", binding: "local-symbols" });
		assert.equal(item.needed[0], "libgmp-lean-bridge.so.10"); assert.ok(item.needed.includes(component.library));
		assert.ok(item.needed.includes("libleanshared.so"));
		for(const [path, source] of Object.entries(ownedDotnetAdapterSources(c, dotnet)))
			assert.deepEqual(adapter.files[path], { bytes: Buffer.byteLength(source), sha256: sha256(source) }, path);
		assert.equal(runtime.schemaVersion, 1); assert.equal(runtime.profile, "native-library-v1"); assert.equal(runtime.pointerBits, 64);
		const libraries = {
			[adapter.library]: adapter.files[`lib/${adapter.library}`].sha256
			, [component.library]: component.nativeLibrary.sha256
			, "libgmp-lean-bridge.so.10": adapter.files["gmp/lib/libgmp-lean-bridge.so.10"].sha256
			, ...Object.fromEntries(Object.entries(runtime.files).filter(([path]) => path.startsWith("lib/")).map(([path, file]) => [path.slice(4), file.sha256]))
		};
		const evidence = { runtimeIdentity: component.runtimeIdentity
			, componentId: model.component.id
			, componentReceiptSha256: sha256(canonicalJson(component))
			, ownedValues: dotnet.contract, library: adapter.library, libraries };
		assert.deepEqual(compiled.evidence, evidence); assert.deepEqual(compiled.ownedValues, dotnet.contract);
		assert.equal(compiled.schemaVersion, 4); assert.equal(compiled.profile, "native-library-v1");
		assert.equal(compiled.assembly, dotnet.assembly); assert.match(compiled.sdk, /^8\.0\.\d+$/u);
		const packaged = generateOwnedDotnetPackage(model.bindingIr, evidence, options);
		assert.equal(manifest.schemaVersion, 4); assert.deepEqual(manifest.ownedValues, dotnet.contract);
		assert.equal(manifest.compiledProjectionSha256, sha256(canonicalJson(compiled)));
		assert.equal(manifest.kind, "lean-bridge-owned-nuget-package"); assert.equal(manifest.ecosystem, "nuget");
		assert.equal(manifest.name, "Owned.Receivers"); assert.equal(manifest.version, "1.2.3");
		assert.equal(manifest.namespace, dotnet.namespace); assert.equal(manifest.assembly, dotnet.assembly);
		assert.equal(manifest.glibcMinimumVersion, "2.36");
		for(const [path, source] of Object.entries(packaged.files))
		{
			const expected = { bytes: Buffer.byteLength(source), sha256: sha256(source) };
			assert.deepEqual(compiled.files[path], expected, path);
			if(path.startsWith("src/") || path === "binding-manifest.json") assert.deepEqual(manifest.files[`lean-bridge/dotnet/${path}`], expected, path);
		}
		for(const extension of ["dll", "xml"])
			assert.deepEqual(manifest.files[`lib/net8.0/${dotnet.assembly}.${extension}`], compiled.files[`lib/net8.0/${dotnet.assembly}.${extension}`]);
		for(const [file, hash] of Object.entries(libraries)) assert.equal(manifest.files[`runtimes/linux-x64/native/${file}`].sha256, hash, file);
		assert.equal(item.consumerSha256, sha256(consumer));
		assert.deepEqual(item.documentation, { sourceSha256: sha256(example), code: 0, stdout: "42\n42\n", stderr: "" });
		assert.deepEqual(item.rejectedConsumers, ownedDotnetReceiverInvalidPrograms.map(([name, body, diagnostic]) => {
			const external = body.startsWith("class ");
			const source = `using ${dotnet.namespace};\ninternal static class Program { static void Main() { ${external ? "" : body} } }\n${external ? body : ""}`;
			return { name, source, diagnostic: diagnostic.source };
		}));
		assert.equal(item.rejectedConsumers.length, 23); assert.equal(item.incapableReadersRejected, 4);
		assert.deepEqual(item.loaderRejected, ["changed-library", "symlink-library"]);
		assert.deepEqual(item.tamperRejected, [
			...["values", "anchor", "expiration", "descendants", "emptyValues", "aliases", "independentOwnership", "copyType", "rawViews", "resourceEquality", "invalidEquality", "transfers"].map(field => "anchor-" + field)
			, ...["values", "members", "properties", "owners", "consumingReceivers", "exports"].map(field => "receiver-" + field)
			, "native-receivers", "native-anchors", "adapter-version", "contract-version"
			, "consumption", "aliases", "native-transfers", "lifetime", "source"
			, "guard", "gmp-receipt", "gmp-source", "library", "unrecorded"
			, "managed-source", "managed-version"
		]);
		assert.ok(item.observation.checks > 138); assert.equal(item.observation.safePublicApi, true);
		assert.deepEqual(item.relocatedObservation, item.observation);
		assert.ok(record.run.text.includes(`${item.mode}: ${item.observation.checks}+${item.observation.checks} installed and relocated checks`));
		validatePackageSetReceipt(packages);
		const targets = item.mode === "reviewed" ? ["c", "cargo", "cpp", "nuget", "pypi", "rubygems"] : ["nuget"];
		assert.deepEqual(packages.packages.map(value => value.target).sort(), targets);
		assert.equal(packages.profiles[0].bindingIrSha256, model.bindingIrSha256);
		assert.deepEqual(item.companions, item.mode === "reviewed" ? { cpp: 407, rust: 440, python: 328, ruby: 137 } : {});
		const { archive, inventorySha256, externalRegistryWrites, ...inventory } = item.cli;
		assert.equal(item.cli.kind, "lean-bridge-cli-package"); assert.equal(inventorySha256, sha256(canonicalJson(inventory)));
		assert.equal(item.cli.productionApproved, false); assert.equal(externalRegistryWrites, false);
		assert.match(archive.sha256, /^[a-f0-9]{64}$/u); assert.ok(archive.bytes > 0);
		assert.deepEqual(item.cliInstallation, { offline: true, filesVerified: item.cli.files.length, sourceRemoved: true });
		assert.equal(item.cli.files.length, cliConfig.files.length + 2);
		assert.equal(new Set(item.cli.files.map(file => file.path)).size, item.cli.files.length);
		for(const path of cliConfig.files)
		{
			const file = item.cli.files.find(value => value.path === path), bytes = await readFile(path);
			assert.ok(file, path); assert.equal(file.bytes, bytes.length); assert.equal(file.sha256, sha256(bytes), path);
		}
		assert.equal(item.cliBuilds.length, 2);
		for(const build of item.cliBuilds)
		{ assert.equal(build.status, "ok"); assert.deepEqual([...build.result.targets].sort(), targets); }
		assert.equal(item.cliVerification.status, "ok"); assert.equal(item.cliVerification.result.verificationType, "local-package-set");
	}
	assert.deepEqual(record.packages[0].cli, record.packages[1].cli);
};
