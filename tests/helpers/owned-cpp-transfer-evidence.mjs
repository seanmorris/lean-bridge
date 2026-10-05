/**
 * Bind C++ move semantics to real Lean execution and installed public APIs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { generateOwnedCPackage } from "../../src/backends/c/owned-package.mjs";
import { historicalOwnedTransferPackage } from "./owned-transfer-generated-history.mjs";
import { generateOwnedCppPackage } from "../../src/backends/cpp/owned-package.mjs";
import { createCompiledNativeModel, generateCompiledNativeLeanAdapters } from "../../src/build/native-graph-model.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { ownedTransferSource } from "./owned-transfer-fixture.mjs";
import { ownedCppTransferHistoricalBytes } from "./owned-cpp-transfer-history.mjs";

export const ownedCppTransferCommand = "npm run test:owned-cpp-transfers";
export const ownedCppTransferScope = Object.freeze({
	ordinaryCompiler: true, reviewedCompiler: true, installedCpp: true
	, transferredInputs: true, hostAssembledGraphs: true, callbackReentry: true
	, independentRetains: true, multipleInputHandoffs: true
	, cppAllocationFaults: true, nativeAllocationFaults: true
	, sourceFreeInstallation: true, relocatedCmake: true, sanitizers: true
	, deterministicReassembly: true, documentationExecuted: true
	, otherConsumerBindings: false, anchoredBorrowedResults: false
	, docker: false, installedSupportPromotions: 0
});

/**
 * Reconstruct each checked native component and C++ contract from compiler input.
 *
 * @param record - Source-bound execution record for both authoring paths.
 */
export const assertOwnedCppTransferExecution = async record => {
	assert.equal(record.acceptance, "passed"); assert.deepEqual(record.scope, ownedCppTransferScope);
	assert.equal(record.run.command, ownedCppTransferCommand); assert.equal(record.run.exitCode, 0);
	assert.equal(record.run.sha256, sha256(record.run.text));
	for(const [key, count] of Object.entries({ tests: 5, pass: 5, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
		assert.match(record.run.text, new RegExp("^# " + key + " " + count + "$", "mu"));
	assert.doesNotMatch(record.run.text, /^not ok|# SKIP|# TODO/mu);
	assert.deepEqual(record.runtime.map(item => item.mode), ["ordinary", "reviewed"]);
	assert.deepEqual(record.consumers.map(item => item.mode), ["ordinary", "reviewed"]);
	const fixture = await readFile("tests/fixtures/structured-types/owned-cpp-transfers.cpp");
	const documentation = await readFile("tests/fixtures/documentation/consumers/cpp/owned-transfers.cpp");
	const lean = (await readFile("tests/fixtures/onboarding/owned-aggregates/Owned.lean", "utf8")) + ownedTransferSource;
	for(const item of [...record.runtime, ...record.consumers])
	{
		assert.equal(item.compiledLean, true);
		assert.equal(Boolean(item.input.sourceIdentity.reviewedBindingIr), item.mode === "reviewed");
		assert.equal(item.input.sourceIdentity.modules.find(module => module.module === "Owned").source.sha256, sha256(lean));
		assert.equal(item.input.sourceIdentity.extractorSha256, sha256(ownedCppTransferHistoricalBytes(
			"src/analyze/NativeExports.lean", await readFile("src/analyze/NativeExports.lean"), item.input.sourceIdentity.extractorSha256)));
		const model = createCompiledNativeModel(item.input, { ownedGraphs: true, ownedHostCallbacks: true, ownedInputTransfers: true });
		assert.equal(model.schemaVersion, 8); assert.equal(model.ownedGraph.inputTransfers.exports.length, 18);
		const cpp = generateOwnedCppPackage(model.bindingIr, { transferredInputs: true });
		assert.equal(cpp.contract.schemaVersion, 2);
		const c = historicalOwnedTransferPackage(generateOwnedCPackage({ ...item.input, hostCallbacks: true, transferredInputs: true }), item.sourceSha256 ?? item.adapterReceipt?.ownedValues.sourceSha256);
		if(record.runtime.includes(item))
		{
			assert.equal(item.actualLean, true); assert.equal(item.installedPackage, false);
			assert.equal(item.probeSha256, sha256(fixture)); assert.equal(item.sourceSha256, sha256(c.source));
			assert.deepEqual(item.contract, cpp.contract);
			for(const result of [item.result, item.sanitizer])
			{
				assert.ok(Number.isInteger(result.checks) && result.checks > 1000);
				for(const key of ["cppBefore", "cppAfter", "nativeBefore", "nativeAfter", "multiCppBefore", "multiCppAfter", "multiNativeBefore", "multiNativeAfter"])
					assert.ok(Number.isInteger(result[key]) && result[key] > 0, key);
				assert.equal(result.live, 0); assert.equal(result.identities, 0);
				assert.ok(result.faultChecks > 0 && result.faultChecks < result.checks);
			}
			assert.equal(item.result.checks - item.result.faultChecks, item.sanitizer.checks - item.sanitizer.faultChecks);
			continue;
		}
		for(const key of ["installedPackage", "sourceUnchanged"
			, "sourceFreeInstallation"
			, "compilerFreeExecution", "handoffRemovedBeforeRelocatedExecution"
			, "deterministicReassembly", "unsupportedRustRejected"
			, "forgedMoveContractsRejected"])
			assert.equal(item[key], true, key);
		assert.equal(item.fixtureSha256, sha256(fixture));
		assert.equal(item.consumerSha256, sha256(Buffer.concat([Buffer.from("#define OWNED_TRANSFER_INSTALLED 1\n"), fixture])));
		assert.deepEqual(item.documentation, { sourceSha256: sha256(documentation), stdout: "transferred\n" });
		assert.deepEqual(item.checks, { pkgConfig: 158, cmake: 158, sanitized: 158 });
		assert.deepEqual(item.model, model);
		const generated = generateCompiledNativeLeanAdapters(model);
		const { componentReceipt: component, adapterReceipt: adapter, manifest, packageSetReceipt: packages } = item;
		assert.equal(component.schemaVersion, 4); assert.equal(adapter.schemaVersion, 4); assert.equal(manifest.schemaVersion, 4);
		assert.deepEqual(adapter.cppValues, cpp.contract); assert.deepEqual(manifest.cppValues, cpp.contract);
		assert.equal(component.modelSha256, sha256(canonicalJson(model)));
		assert.equal(component.headerSha256, sha256(generated.header));
		assert.equal(component.adaptersSha256, sha256(generated.leanSource));
		assert.deepEqual(component.inputTransfers, model.ownedGraph.inputTransfers);
		assert.equal(adapter.componentReceiptSha256, sha256(canonicalJson(component)));
		assert.equal(adapter.ownedValues.headerSha256, sha256(c.publicHeader));
		assert.equal(adapter.ownedValues.sourceSha256, sha256(c.source));
		assert.deepEqual(adapter.ownedValues.inputTransfers, model.ownedGraph.inputTransfers);
		assert.deepEqual(manifest.ownedValues, adapter.ownedValues);
		assert.equal(manifest.adapterReceiptSha256, sha256(canonicalJson(adapter)));
		assert.equal(manifest.componentReceiptSha256, sha256(canonicalJson(component)));
		for(const [path, source] of Object.entries(cpp.files))
		{
			assert.equal(adapter.files[path].sha256, sha256(source), path);
			// The producer compiles the translation unit; consumers receive the
			// inline headers, libraries and notices, not src/owned_aggregates.cpp.
			if(path.startsWith("src/")) assert.equal(manifest.files[path], undefined, path);
			else assert.equal(manifest.files[path].sha256, sha256(source), path);
		}
		validatePackageSetReceipt(packages);
		assert.deepEqual(packages.packages.map(item => item.target).sort(), ["c", "cpp"]);
		assert.ok(packages.packages.every(item => item.runtimeIdentity === manifest.runtimeIdentity));
		assert.equal(packages.profiles[0].bindingIrSha256, model.bindingIrSha256);
	}
};

/**
 * Require the enabled gate, both source paths and complete uploaded reports.
 *
 * @param workflow - Complete downstream workflow source.
 */
export const assertOwnedCppTransferCi = workflow => {
	assert.ok(workflow.includes("          npm run test:owned-cpp-transfers\n"));
	assert.ok(workflow.includes('consumer_command="$consumer_command && npm run test:owned-cpp-transfers"'));
	for(const directory of ["owned-cpp-transfers", "owned-cpp-transfer-packaging"])
	{
		for(const mode of ["ordinary", "reviewed"])
			assert.ok(workflow.includes(`          test -s build/${directory}/${mode}.json\n`));
		assert.ok(workflow.includes(`            build/${directory}/\n`));
	}
};
