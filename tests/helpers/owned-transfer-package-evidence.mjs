/**
 * Authenticate installed C transfer observations without promoting other hosts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { createCompiledNativeModel, generateCompiledNativeLeanAdapters } from "../../src/build/native-graph-model.mjs";
import { generateOwnedCPackage } from "../../src/backends/c/owned-package.mjs";
import { validatePackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { ownedTransferConfiguration, ownedTransferSource } from "./owned-transfer-fixture.mjs";

export const ownedTransferPackageCommand = "npm run test:owned-transfer-packages";
export const ownedTransferPackageScope = Object.freeze({
	ordinaryCompiler: true, reviewedCompiler: true, publicSourceAnalysis: true
	, transferredInputs: true, installedC: true, sourceFreeInstallation: true
	, relocatedCmake: true, deterministicReassembly: true
	, forgedContractRejection: true
	, otherConsumerBindings: false, anchoredBorrowedResults: false
	, docker: false, installedSupportPromotions: 0
});

/**
 * Reconstruct compiler contracts and generated APIs from captured execution inputs.
 *
 * @param record - Source-bound installed execution receipt.
 */
export const assertOwnedTransferPackageExecution = async record => {
	assert.equal(record.acceptance, "passed");
	assert.deepEqual(record.scope, ownedTransferPackageScope);
	assert.equal(record.run.command, ownedTransferPackageCommand);
	assert.equal(record.run.exitCode, 0);
	assert.equal(record.run.sha256, sha256(record.run.text));
	for(const [key, count] of Object.entries({ tests: 5, pass: 5, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
		assert.match(record.run.text, new RegExp("^# " + key + " " + count + "$", "mu"));
	assert.doesNotMatch(record.run.text, /^not ok|# SKIP|# TODO/mu);
	assert.deepEqual(record.consumers.map(item => item.mode), ["ordinary", "reviewed"]);
	assert.deepEqual(record.analyses.map(item => item.mode), ["ordinary", "reviewed"]);
	const contracts = (await ownedTransferConfiguration()).contracts;
	for(const item of record.analyses)
	{
		assert.equal(item.compiledLean, true); assert.equal(item.adaptersCompiled, false);
		assert.equal(item.processTransportInjected, true); assert.equal(item.sourceUnchanged, true);
		assert.equal(item.transfers, 18); assert.equal(item.rejectedMutations, 3);
		assert.equal(item.analysisSha256, sha256(canonicalJson(item.analysis)));
		assert.deepEqual(item.analysis.elaboration.request.contracts, contracts);
		assert.equal(item.analysis.compiledEnvironment.status, "available");
		assert.equal(item.analysis.bindingIr.document.schemaVersion, 4);
		assert.equal(Boolean(item.analysis.elaboration.reviewedBindingIr), item.mode === "reviewed");
		assert.ok(item.observed.some(args => args.includes("--metadata")));
		assert.ok(item.observed.every(args => !args.includes("-c")));
	}
	const fixture = await readFile("tests/fixtures/structured-types/owned-installed-transfers.c");
	const lean = (await readFile("tests/fixtures/onboarding/owned-aggregates/Owned.lean", "utf8")) + ownedTransferSource;
	for(const item of record.consumers)
	{
		for(const key of ["compiledLean", "installedPackage", "sourceUnchanged"
			, "sourceFreeInstallation", "compilerFreeExecution"
			, "handoffRemovedBeforeRelocatedExecution", "deterministicReassembly"
			, "transferIncapableReaderRejected", "forgedMoveContractRejected"])
			assert.equal(item[key], true, key);
		assert.deepEqual(item.checks, { pkgConfig: 446, cmake: 446 });
		assert.equal(item.fixtureSha256, sha256(fixture));
		assert.equal(item.input.sourceIdentity.modules.find(module => module.module === "Owned").source.sha256, sha256(lean));
		assert.equal(Boolean(item.input.sourceIdentity.reviewedBindingIr), item.mode === "reviewed");
		const model = createCompiledNativeModel(item.input, { ownedGraphs: true, ownedHostCallbacks: true, ownedInputTransfers: true });
		assert.deepEqual(item.model, model); assert.equal(model.schemaVersion, 8);
		assert.equal(model.ownedGraph.inputTransfers.exports.length, 18);
		const generated = generateOwnedCPackage({ ...item.input, hostCallbacks: true, transferredInputs: true });
		const adapters = generateCompiledNativeLeanAdapters(model);
		const { componentReceipt: component, adapterReceipt: adapter, manifest, packageSetReceipt: packages } = item;
		assert.equal(component.schemaVersion, 4); assert.equal(adapter.schemaVersion, 4);
		assert.equal(manifest.schemaVersion, 4); assert.equal(manifest.ownedValues.schemaVersion, 3);
		assert.equal(component.modelSha256, sha256(canonicalJson(model)));
		assert.equal(component.headerSha256, sha256(adapters.header));
		assert.equal(component.adaptersSha256, sha256(adapters.leanSource));
		assert.deepEqual(component.inputTransfers, model.ownedGraph.inputTransfers);
		assert.equal(adapter.componentReceiptSha256, sha256(canonicalJson(component)));
		assert.equal(adapter.ownedValues.headerSha256, sha256(generated.publicHeader));
		assert.equal(adapter.ownedValues.sourceSha256, sha256(generated.source));
		assert.deepEqual(adapter.ownedValues.inputTransfers, model.ownedGraph.inputTransfers);
		assert.deepEqual(manifest.ownedValues, adapter.ownedValues);
		assert.equal(manifest.adapterReceiptSha256, sha256(canonicalJson(adapter)));
		assert.equal(manifest.componentReceiptSha256, sha256(canonicalJson(component)));
		assert.equal(manifest.files[`include/${generated.values.prefix}.h`].sha256, sha256(generated.publicHeader));
		validatePackageSetReceipt(packages);
		assert.equal(packages.packages.length, 1); assert.equal(packages.packages[0].target, "c");
		assert.equal(packages.packages[0].runtimeIdentity, manifest.runtimeIdentity);
		assert.equal(packages.profiles[0].bindingIrSha256, model.bindingIrSha256);
	}
};

/**
 * Require enabled execution, complete reports and uploaded installed evidence.
 *
 * @param source - Complete downstream workflow source.
 */
export const assertOwnedTransferPackageCi = source => {
	assert.ok(source.includes("          npm run test:owned-transfer-packages\n"));
	assert.ok(source.includes('consumer_command="$consumer_command && npm run test:owned-transfer-packages"'));
	for(const name of ["analysis-ordinary", "analysis-reviewed", "ordinary", "reviewed"])
		assert.ok(source.includes(`          test -s build/owned-transfer-packaging/${name}.json\n`));
	assert.ok(source.includes("            build/owned-transfer-packaging/\n"));
};
