/**
 * Authenticate staged transfer execution without claiming installed support.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { generateOwnedCPackage } from "../../src/backends/c/owned-package.mjs";
import { ownedAggregateTransferLeaseSource } from "../../src/backends/native/owned-aggregate-transfers.mjs";
import { ownedTransferSource } from "./owned-transfer-fixture.mjs";

export const ownedTransferCCommand = "npm run test:owned-transfers";
export const ownedTransferCScope = Object.freeze({
	ordinaryCompiler: true, reviewedCompiler: true, nativeLedger: true
	, publicCProjection: true, transferredInputs: true, atomicOwnerSet: true
	, allocationFailureCleanup: true, callbackReentry: true, malformedResults: true
	, addressSanitizer: true, undefinedBehaviorSanitizer: true
	, installedPackage: false, otherConsumerBindings: false
	, anchoredBorrowedResults: false, installedSupportPromotions: 0
});

/**
 * Require actual Lean observations, their source identities and mutation controls.
 *
 * @param record - Source-bound staged execution receipt.
 */
export const assertOwnedTransferCExecution = async record => {
	assert.equal(record.acceptance, "passed"); assert.deepEqual(record.scope, ownedTransferCScope);
	assert.equal(record.run.command, ownedTransferCCommand); assert.equal(record.run.exitCode, 0);
	assert.equal(sha256(record.run.text), record.run.sha256);
	for(const [key, count] of Object.entries({ tests: 7, pass: 7, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
		assert.match(record.run.text, new RegExp("^# " + key + " " + count + "$", "mu"));
	assert.doesNotMatch(record.run.text, /^not ok|# SKIP|# TODO/mu);
	const native = record.native;
	assert.equal(native.realLean, true); assert.equal(native.allocationFreeCommit, true);
	assert.equal(native.ownerMembership, true); assert.equal(native.allocationFreeInputViews, true);
	assert.equal(native.leakBaselineUnchanged, true); assert.equal(native.sanitizer, "address,undefined");
	assert.equal(native.liveAllocations, 0); assert.ok(native.checks >= 16554);
	assert.equal(native.ledgerSha256, sha256(ownedAggregateTransferLeaseSource));
	assert.equal(native.probeSha256, sha256(await readFile("tests/fixtures/structured-types/owned-aggregate-transfers.c")));
	assert.deepEqual(native.rejectedMutations, ["wrong-input-owner", "duplicate-input", "missing-input-retention", "missing-moved-state", "unbounded-transfer"]);
	assert.deepEqual(record.consumers.map(item => item.path), ["ordinary", "reviewed"]);
	const source = (await readFile("tests/fixtures/onboarding/owned-aggregates/Owned.lean", "utf8")) + ownedTransferSource;
	for(const consumer of record.consumers)
	{
		const { input, report } = consumer;
		assert.equal(report.path, consumer.path); assert.equal(report.actualLean, true);
		assert.equal(report.sanitizer, "address,undefined"); assert.equal(report.malformedResultConsumesInputs, true);
		assert.equal(input.sourceIdentity.sourceTreeSha256, sha256(source));
		assert.equal(Boolean(input.sourceIdentity.reviewedBindingIr), consumer.path === "reviewed");
		assert.equal(report.sourceIdentitySha256, sha256(canonicalJson(input.sourceIdentity)));
		assert.equal(report.probeSha256, sha256(await readFile("tests/fixtures/structured-types/owned-public-transfers.c")));
		const generated = generateOwnedCPackage({ ...input, hostCallbacks: true, transferredInputs: true });
		assert.equal(report.bindingIrSha256, generated.layout.model.bindingIrSha256);
		assert.equal(report.headerSha256, sha256(generated.publicHeader));
		assert.equal(report.sourceSha256, sha256(generated.source));
		assert.equal(generated.values.functions.filter(item => item.transfers?.length).length, 18);
		assert.deepEqual(report.result, { checks: 2933, beforeFailures: 6, afterFailures: 20, live: 0, identities: 0 });
		assert.deepEqual(report.rejectedMutations, consumer.path === "ordinary"
			? ["missing-moved-slot", "wrong-owner-membership", "leaked-source-payload"] : []);
		assert.doesNotMatch(report.startupLeakBaseline, /ERROR: AddressSanitizer|runtime error:/u);
	}
};

/**
 * Require enabled execution, uploaded reports and unchanged downstream gates.
 *
 * @param source - Complete downstream workflow source.
 */
export const assertOwnedTransferCCi = source => {
	assert.ok(source.includes("          npm run test:owned-transfers\n"));
	assert.ok(source.includes('consumer_command="$consumer_command && npm run test:owned-transfers"'));
	for(const path of ["native", "ordinary-c", "reviewed-c"])
		assert.ok(source.includes(`          test -s build/owned-transfers/${path}.json\n`));
	assert.ok(source.includes("            build/owned-transfers/\n"));
	const php = source.match(/^ {2}php-consumers:\n[\s\S]*?(?=^ {2}native-consumers:)/mu)?.[0];
	assert.ok(php?.includes("    timeout-minutes: 360\n"));
	for(const name of ["Compare installed PHP-Wasm packages with the shared Lean corpus"
		, "Combine PHP-Wasm with native PHP and JavaScript from one captured API"
		, "Enforce PHP support"])
		assert.ok(php.includes(`- name: ${name}\n`));
};
