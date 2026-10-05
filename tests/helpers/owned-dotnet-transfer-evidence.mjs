/**
 * Bind installed C# transfers to compiler facts and both executed source paths.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { ownedBorrowHistoricalBytes } from "./owned-borrow-history.mjs";
import { generateOwnedDotnetCalls } from "../../src/backends/dotnet/owned-calls.mjs";
import { generateOwnedDotnetPackage } from "../../src/backends/dotnet/owned-package.mjs";
import { generateOwnedCPackage } from "../../src/backends/c/owned-package.mjs";
import { historicalOwnedTransferPackage } from "./owned-transfer-generated-history.mjs";
import { createCompiledNativeModel, generateCompiledNativeLeanAdapters } from "../../src/build/native-graph-model.mjs";
import { ownedDotnetAdapterSources } from "../../src/build/owned-dotnet-artifacts.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { ownedRustTransferSource } from "./owned-rust-transfer-fixture.mjs";

export const ownedDotnetTransferCommand = "LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36 npm run test:owned-dotnet-transfers";
export const ownedDotnetTransferScope = Object.freeze({
	ordinaryCompiler: true, reviewedCompiler: true, installedNuget: true
	, transferredInputs: true, hostAssembledGraphs: true, boxedRecursion: true
	, callbackReentry: true, independentRetains: true, multipleInputHandoffs: true
	, managedAllocationFaults: true, nativeAllocationFaults: true
	, retainedExceptions: true, pinnedHandoffSlots: true, threadExitCleanup: true
	, sourceFreeInstallation: true, offlineInstall: true
	, sourceFreeRelocatedExecution: true, sdkFreeExecution: true
	, deterministicReassembly: true, documentationExecuted: true
	, safePublicApi: true, privateGmp: true
	, cCppRustPythonRubyCompanions: true, otherConsumerBindings: false
	, anchoredBorrowedResults: false, docker: false, installedSupportPromotions: 0
});

/**
 * Reconstruct generated contracts and require both installed execution paths.
 *
 * @param record - Source-bound private and installed transfer observations.
 */
export const assertOwnedDotnetTransferExecution = async record => {
	assert.equal(record.acceptance, "passed"); assert.deepEqual(record.scope, ownedDotnetTransferScope);
	assert.equal(record.run.command, ownedDotnetTransferCommand); assert.equal(record.run.exitCode, 0);
	assert.equal(record.run.sha256, sha256(record.run.text));
	for(const [key, count] of Object.entries({ tests: 6, pass: 6, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
		assert.match(record.run.text, new RegExp("^# " + key + " " + count + "$", "mu"));
	assert.doesNotMatch(record.run.text, /^not ok|# SKIP|# TODO/mu);
	assert.deepEqual(record.runtime.map(item => item.mode), ["ordinary", "reviewed"]);
	assert.deepEqual(record.consumers.map(item => item.mode), ["ordinary", "reviewed"]);
	const probe = await readFile("tests/fixtures/structured-types/owned-dotnet-transfers.cs");
	const fixture = await readFile("tests/fixtures/structured-types/owned-installed-dotnet-transfers.cs");
	const documentation = await readFile("tests/fixtures/documentation/consumers/dotnet/owned-transfers.cs");
	const lean = await readFile("tests/fixtures/onboarding/owned-aggregates/Owned.lean", "utf8") + ownedRustTransferSource;
	for(const item of [...record.runtime, ...record.consumers])
	{
		assert.equal(Boolean(item.input.sourceIdentity.reviewedBindingIr), item.mode === "reviewed");
		assert.equal(item.input.sourceIdentity.modules.find(module => module.module === "Owned").source.sha256, sha256(lean));
		const extractor = "src/analyze/NativeExports.lean", expectedExtractor = item.input.sourceIdentity.extractorSha256;
		assert.equal(sha256(ownedBorrowHistoricalBytes(extractor, await readFile(extractor), expectedExtractor)), expectedExtractor);
		const model = createCompiledNativeModel(item.input, { ownedGraphs: true, ownedHostCallbacks: true, ownedInputTransfers: true });
		assert.equal(model.schemaVersion, 8); assert.equal(model.exports.length, 26);
		assert.equal(model.ownedGraph.inputTransfers.exports.length, 20);
		if(record.runtime.includes(item))
		{
			assert.equal(item.actualLean, true); assert.equal(item.installedPackage, false);
			assert.equal(item.probeSha256, sha256(probe));
			const generated = generateOwnedDotnetCalls(model.bindingIr, { transferredInputs: true });
			assert.deepEqual(item.generated, Object.fromEntries(Object.entries(generated.files).map(([path, source]) => [path, sha256(source)])));
			assert.match(item.nativeProbeSha256, /^[a-f0-9]{64}$/u);
			assert.match(item.loaderSha256, /^[a-f0-9]{64}$/u);
			const observed = item.observed; assert.ok(observed.checks > 1000);
			for(const key of ["managedBefore", "managedAfter"
				, "nativeBefore", "nativeAfter"
				, "multiManagedBefore", "multiManagedAfter"
				, "multiNativeBefore", "multiNativeAfter"])
				assert.ok(Number.isSafeInteger(observed[key]) && observed[key] > 0, key);
			assert.equal(observed.live, 0); assert.equal(observed.identities, 0);
			continue;
		}
		for(const key of ["compiledLean", "installedPackage", "installedNuget"
			, "sourceUnchanged", "sourceFreeInstallation", "sourceFreeRelocatedExecution"
			, "handoffRemoved", "packageCacheRemoved", "sdkFreeExecution"
			, "consumerSourceRemoved", "deterministicReassembly", "safePublicApi"])
			assert.equal(item[key], true, key);
		assert.deepEqual(item.tamperRejected, ["adapter-version", "contract-version"
			, "consumption", "aliases", "native-transfers", "lifetime", "source"
			, "guard", "gmp-receipt", "gmp-source", "library", "unrecorded"
			, "managed-source", "managed-version"]);
		assert.deepEqual(item.loaderRejected, ["changed-library", "symlink-library"]);
		assert.equal(item.documentation.sourceSha256, sha256(documentation));
		assert.equal(item.documentation.stdout, "transferred\n"); assert.equal(item.documentation.stderr, "");
		assert.equal(item.documentation.code, 0); assert.equal(item.consumerSha256, sha256(fixture));
		assert.ok(item.observation.checks >= 100); assert.equal(item.observation.safePublicApi, true);
		assert.deepEqual(item.relocatedObservation, item.observation);
		assert.deepEqual(item.rejectedConsumers.map(entry => entry.name), ["resource constructor"
			, "raw handle", "sealed resource", "resource field", "immutable record"
			, "typed option", "typed callback", "typed closure input", "async callback"
			, "transparent alias", "closed variant"]);
		for(const entry of item.rejectedConsumers) assert.match(entry.diagnostic, /^CS\d+/u);
		const { componentReceipt: component, adapterReceipt: adapter
			, runtimeReceipt: runtime, packageSetReceipt: packages
			, compiledProjection: compiled, manifest } = item;
		const native = generateCompiledNativeLeanAdapters(model);
		const c = historicalOwnedTransferPackage(generateOwnedCPackage({ ...item.input, hostCallbacks: true, transferredInputs: true }), adapter.ownedValues.sourceSha256);
		const dotnet = generateOwnedDotnetPackage(model.bindingIr, null, { transferredInputs: true });
		assert.equal(component.schemaVersion, 4); assert.equal(adapter.schemaVersion, 2);
		assert.equal(adapter.ownedValues.schemaVersion, 3); assert.deepEqual(adapter.dotnetValues, dotnet.contract);
		assert.equal(component.modelSha256, sha256(canonicalJson(model)));
		assert.equal(component.headerSha256, sha256(native.header)); assert.equal(component.adaptersSha256, sha256(native.leanSource));
		assert.equal(component.callbackSourceSha256, sha256(native.callbackSource));
		assert.deepEqual(component.inputTransfers, model.ownedGraph.inputTransfers);
		assert.equal(adapter.componentReceiptSha256, sha256(canonicalJson(component)));
		assert.equal(adapter.ownedValues.headerSha256, sha256(c.publicHeader)); assert.equal(adapter.ownedValues.sourceSha256, sha256(c.source));
		assert.deepEqual(adapter.ownedValues.inputTransfers, model.ownedGraph.inputTransfers);
		assert.deepEqual(adapter.gmp, { version: "6.3.0", soname: "libgmp-lean-bridge.so.10", binding: "local-symbols" });
		assert.equal(item.needed[0], "libgmp-lean-bridge.so.10"); assert.ok(item.needed.includes(component.library));
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
		assert.equal(compiled.schemaVersion, 2); assert.equal(compiled.profile, "native-library-v1");
		assert.equal(compiled.bindingIrSha256, model.bindingIrSha256); assert.equal(compiled.assembly, dotnet.assembly);
		assert.match(compiled.sdk, /^8\.0\.\d+$/u);
		const packaged = generateOwnedDotnetPackage(model.bindingIr, evidence, { transferredInputs: true });
		assert.equal(manifest.schemaVersion, 2); assert.deepEqual(manifest.ownedValues, dotnet.contract);
		assert.equal(manifest.compiledProjectionSha256, sha256(canonicalJson(compiled)));
		assert.equal(manifest.glibcMinimumVersion, "2.36");
		for(const [path, source] of Object.entries(packaged.files))
		{
			const expected = { bytes: Buffer.byteLength(source), sha256: sha256(source) };
			assert.deepEqual(compiled.files[path], expected, path);
			if(path.startsWith("src/") || path === "binding-manifest.json")
				assert.deepEqual(manifest.files[`lean-bridge/dotnet/${path}`], expected, path);
		}
		for(const extension of ["dll", "xml"])
			assert.deepEqual(manifest.files[`lib/net8.0/${dotnet.assembly}.${extension}`], compiled.files[`lib/net8.0/${dotnet.assembly}.${extension}`]);
		for(const [file, hash] of Object.entries(libraries))
			assert.equal(manifest.files[`runtimes/linux-x64/native/${file}`].sha256, hash, file);
		validatePackageSetReceipt(packages);
		assert.deepEqual(packages.packages.map(item => item.target).sort(), item.mode === "reviewed" ? ["c", "cargo", "cpp", "nuget", "pypi", "rubygems"] : ["nuget"]);
		assert.equal(packages.profiles[0].bindingIrSha256, model.bindingIrSha256);
		assert.deepEqual(item.companions, item.mode === "reviewed" ? { c: 446, cpp: 158, rust: 222, python: 106, ruby: 101 } : {});
	}
};

/**
 * Require the enabled .NET shard, all reports and recorded consumer command.
 *
 * @param workflow - Complete downstream workflow source.
 */
export const assertOwnedDotnetTransferCi = workflow => {
	const step = workflow.split("- name: Compare installed NuGet corpus packages with fresh Lean results\n")[1]?.split("      - name:")[0];
	assert.ok(step?.includes("          npm run test:owned-dotnet-transfers\n"));
	assert.ok(workflow.includes('consumer_command="$consumer_command && npm run test:owned-dotnet-transfers"'));
	for(const directory of ["owned-dotnet-transfers", "owned-dotnet-transfer-packaging"])
	{
		assert.ok(workflow.includes(`            build/${directory}/\n`));
		for(const mode of ["ordinary", "reviewed"]) assert.ok(step.includes(`          test -s build/${directory}/${mode}.json\n`));
	}
};
