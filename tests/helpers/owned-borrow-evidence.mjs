/**
 * Check compiled and source-free installed owner-anchored C result evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { generateOwnedCPackage } from "../../src/backends/c/owned-package.mjs";
import { ownedAggregateTransferRuntime } from "../../src/backends/native/owned-aggregate-transfers.mjs";
import { createCompiledNativeModel, generateCompiledNativeLeanAdapters } from "../../src/build/native-graph-model.mjs";
import { ownedBorrowSource } from "./owned-borrow-fixture.mjs";

export const ownedBorrowRuntimeScript = "LEAN_BRIDGE_OWNED_BORROW_TEST=1 node --test --test-concurrency=1 tests/owned-aggregate-borrows.test.mjs tests/owned-borrow-analysis.test.mjs tests/owned-c-borrows.test.mjs";
export const ownedBorrowPackageScript = "LEAN_BRIDGE_OWNED_BORROW_PACKAGE_TEST=1 node --test --test-concurrency=1 tests/owned-borrow-packaging.test.mjs";
export const ownedBorrowScope = Object.freeze({
	profiles: ["c"], sourcePaths: ["ordinary-source", "reviewed-ir"]
	, compiledLean: true, installedPackages: true, sourceFreeInstallation: true
	, relocated: true, deterministicReassembly: true, independentRebuild: false
	, publicExports: 24, anchoredResults: 19, consumingFunctions: 2
	, noTransferNoCallbackExports: 22, noTransferNoCallbackAnchors: 18
	, exactOwner: true, transitiveExpiration: true, independentRetains: true
	, emptyValues: true, recursiveValues: true, returnedClosures: true
	, callbackReentry: true, allocationFaults: true, mutationChecks: true
	, sanitizers: ["address", "undefined"], documentationExecuted: true
	, wrongThread: true, inheritedProcess: true, staleHandles: true
	, receiverAnchors: false, callbackResultAnchors: false
	, otherConsumerProjections: false, docker: false, installedSupportPromotions: 0
});
const capabilities = { ownedGraphs: true, ownedHostCallbacks: true
	, ownedInputTransfers: true, ownedAnchoredResults: true };
const flags = (value, names) => { for(const name of names) assert.equal(value[name], true, name); };
const run = (value, command, count) => {
	assert.equal(value.command, command); assert.equal(value.exitCode, 0);
	assert.equal(value.sha256, sha256(value.text));
	for(const [name, expected] of Object.entries({ tests: count, pass: count, fail: 0, skipped: 0, cancelled: 0, todo: 0 }))
		assert.match(value.text, new RegExp(`^# ${name} ${expected}$`, "mu"));
	assert.doesNotMatch(value.text, /^not ok|# SKIP|# TODO/mu);
};

/**
 * Reconstruct C and compiler contracts and verify every recorded execution path.
 *
 * @param record - Source-bound runtime and installed execution receipt.
 */
export const assertOwnedBorrowExecution = async record => {
	assert.equal(record.acceptance, "passed"); assert.deepEqual(record.scope, ownedBorrowScope);
	run(record.runs.runtime, "npm run test:owned-borrows", 8);
	run(record.runs.installed, "npm run test:owned-borrow-packages", 2);
	const diagnostics = record.runs.runtime.text.split("\n").filter(line => line.startsWith('# {"mode":')).map(line => JSON.parse(line.slice(2)));
	const native = record.native;
	assert.equal(native.checks, 9279); assert.equal(native.originalTransferChecks, 16554);
	assert.equal(native.liveAllocations, 0); assert.equal(native.borrowedDepth, 128);
	flags(native, ["realLean", "ownerGenerations", "leakBaselineUnchanged"]);
	assert.equal(native.sanitizer, "address,undefined");
	assert.doesNotMatch(native.startupLeakBaseline, /ERROR: AddressSanitizer|runtime error:/u);
	assert.equal(native.ledgerSha256, sha256(ownedAggregateTransferRuntime({ anchoredResults: true })));
	assert.equal(native.probeSha256, sha256(await readFile("tests/fixtures/structured-types/owned-aggregate-borrows.c")));
	assert.deepEqual(native.rejectedMutations, [
		"missing-owner-generation", "expired-view-revived"
		, "retained-alias-substitution"
		, "missing-transfer-expiration", "early-descendant-destruction"
		, "disposal-reentry", "missing-input-pin"
	]);
	const page = await readFile("docs/consume/c.md", "utf8");
	const example = page.split("### Borrowed results\n")[1]?.split("```c\n")[1]?.split("```")[0];
	assert.ok(example);
	const source = await readFile("tests/fixtures/onboarding/owned-aggregates/Owned.lean", "utf8");
	const probe = await readFile("tests/fixtures/structured-types/owned-public-borrows.c", "utf8");
	const checkInput = (input, mode, mixed) => {
		assert.equal(Boolean(input.sourceIdentity.reviewedBindingIr), mode === "reviewed");
		assert.equal(input.sourceIdentity.modules.find(item => item.module === "Owned").source.sha256, sha256(source + (mixed ? ownedBorrowSource : "")));
	};
	for(const values of [record.analyses, record.runtime, record.packages])
		assert.deepEqual(values.map(item => item.mode), ["ordinary", "reviewed"]);
	for(const analysis of record.analyses)
	{
		assert.equal(analysis.exports, 22); assert.equal(analysis.anchoredResults, 18);
		flags(analysis, ["realLean", "defaultCapabilityRejected"]);
		assert.equal(analysis.reviewedNamesPreserved, analysis.mode === "reviewed");
		assert.equal(analysis.rejected.length, analysis.mode === "ordinary" ? 5 : 0);
		const input = { metadata: analysis.metadata, sourceIdentity: analysis.sourceIdentity, component: analysis.model.component };
		checkInput(input, analysis.mode, false);
		assert.deepEqual(createCompiledNativeModel(input, { ownedGraphs: true, ownedAnchoredResults: true }), analysis.nativeModel);
		assert.equal(analysis.borrowedOnlyC.sourceSha256, sha256(generateOwnedCPackage({ ...input, anchoredResults: true }).source));
		assert.equal(analysis.borrowedOnlyC.exampleSha256, sha256(example));
		assert.equal(analysis.borrowedOnlyC.stdout, "42\n");
	}
	for(const item of record.runtime)
	{
		flags(item, ["realLean", "leakBaselineUnchanged", "modelContractTamperingRejected"]);
		assert.equal(item.anchoredResults, 19); assert.equal(item.consumingFunctions, 2);
		checkInput(item.inputs, item.mode, true);
		const generated = generateOwnedCPackage({ ...item.inputs, hostCallbacks: true, transferredInputs: true, anchoredResults: true });
		assert.equal(item.adapterSha256, sha256(generated.source)); assert.equal(item.probeSha256, sha256(probe));
		assert.deepEqual(item.model, createCompiledNativeModel(item.inputs, capabilities));
		assert.equal(item.result.checks, 3203); assert.equal(item.result.live, 0); assert.equal(item.result.identities, 0);
		for(const key of ["failures", "beforeFailures", "afterFailures"]) assert.ok(item.result[key] > 0, key);
		assert.equal(item.sanitizer, "address,undefined");
		assert.deepEqual(item.rejectedMutations, [
			"unbound-result", "canonical-view-escape", "missing-owner-membership"
			, "missing-view-identity-release", "callback-view-escape"
			, "missing-ancestor-transfer-check"
		]);
		assert.deepEqual(diagnostics.find(value => value.mode === item.mode), { mode: item.mode, ...item.result });
	}
	for(const item of record.packages)
	{
		flags(item, ["compiledLean", "installedPackage", "sourceUnchanged"
			, "sourceFreeInstallation", "compilerFreeExecution"
			, "handoffRemovedBeforeRelocatedExecution", "deterministicReassembly"]);
		assert.equal(item.incapableReadersRejected, 4); assert.equal(item.forgedAnchorContractsRejected, 7);
		checkInput(item.input, item.mode, true);
		const model = createCompiledNativeModel(item.input, capabilities);
		assert.deepEqual(item.model, model); assert.ok(generateCompiledNativeLeanAdapters(model).callbackSource);
		assert.equal(model.schemaVersion, 9); assert.equal(model.ownedGraph.resultAnchors.exports.length, 19);
		assert.equal(model.ownedGraph.inputTransfers.exports.length, 2);
		const generated = generateOwnedCPackage({ ...item.input, hostCallbacks: true, transferredInputs: true, anchoredResults: true });
		const { adapterReceipt: adapter, manifest, componentReceipt: receipt } = item;
		assert.equal(receipt.schemaVersion, 5); assert.equal(adapter.schemaVersion, 5); assert.equal(manifest.schemaVersion, 5);
		assert.equal(adapter.ownedValues.schemaVersion, 4);
		assert.deepEqual(receipt.resultAnchors, model.ownedGraph.resultAnchors);
		assert.deepEqual(adapter.ownedValues.resultAnchors, model.ownedGraph.resultAnchors);
		assert.deepEqual(manifest.ownedValues, adapter.ownedValues);
		assert.equal(adapter.ownedValues.headerSha256, sha256(generated.publicHeader));
		assert.equal(adapter.ownedValues.sourceSha256, sha256(generated.source));
		assert.equal(manifest.files[`include/${generated.values.prefix}.h`].sha256, sha256(generated.publicHeader));
		assert.equal(manifest.bindingIrSha256, model.bindingIrSha256);
		assert.equal(receipt.modelSha256, sha256(canonicalJson(model)));
		assert.equal(manifest.adapterReceiptSha256, sha256(canonicalJson(adapter)));
		assert.equal(item.fixtureSha256, sha256(probe));
		assert.deepEqual(item.checks, { pkgConfig: 1195, cmake: 1195 });
		assert.deepEqual(item.documentation, { sourceSha256: sha256(example), stdout: "42\n" });
		assert.ok(record.runs.installed.text.includes(`${item.mode}: 1195 installed borrow checks using pkg-config and relocated CMake`));
	}
};

/**
 * Require enabled runtime/install gates, exact counts, artifacts and final failure.
 *
 * @param workflow - Complete downstream workflow source.
 * @param manifest - Package scripts selected by the workflow.
 */
export const assertOwnedBorrowCi = (workflow, manifest) => {
	assert.equal(manifest.scripts["test:owned-borrows"], ownedBorrowRuntimeScript);
	assert.equal(manifest.scripts["test:owned-borrow-packages"], ownedBorrowPackageScript);
	const step = workflow.split("        id: type_corpus_c_family\n")[1]?.split("      - name: ")[0];
	assert.ok(step); assert.match(step, /^ {8}if: matrix\.profile == 'c-family'$/mu);
	for(const [gate, log, count] of [["borrows", "runtime", 8], ["borrow-packages", "installed", 2]])
	{
		assert.ok(step.split("\n").includes(`          npm run test:owned-${gate} > build/owned-borrows-${log}.log 2>&1`));
		for(const expectation of [`pass ${count}`, "fail 0", "skipped 0"])
			assert.ok(step.split("\n").includes(`          rg '^# ${expectation}$' build/owned-borrows-${log}.log`));
	}
	for(const file of ["native", "analysis-ordinary", "analysis-reviewed", "c-ordinary", "c-reviewed", "installed-ordinary", "installed-reviewed"])
		assert.ok(step.split("\n").includes(`          test -s build/owned-borrows/${file}.json`));
	const upload = workflow.split("      - name: Upload installed C and C++ corpus observations\n")[1]?.split("      - name: ")[0];
	assert.ok(upload); assert.match(upload, /^ {8}if: always\(\) && matrix\.profile == 'c-family'$/mu);
	assert.match(upload, /^ {10}if-no-files-found: error$/mu);
	for(const name of ["owned-borrows/", "owned-borrows-runtime.log", "owned-borrows-installed.log"])
		assert.ok(upload.split("\n").includes("            build/" + name));
	assert.ok(workflow.includes("steps.type_corpus_c_family.outcome != 'success'"));
	assert.ok(workflow.includes('if [ "${{ steps.ordinary_c.outcome }}" != success ] || [ "${{ steps.type_corpus_c_family.outcome }}" != success ]; then'));
};
