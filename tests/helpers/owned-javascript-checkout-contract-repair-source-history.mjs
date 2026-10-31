/**
 * Preserve the owned JavaScript checkout-contract repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assertOwnedCheckedRecordNpmProducer }
	from "./owned-checked-record-npm-producer.mjs";
import { assertOwnedJavaScriptWasmCi }
	from "./owned-javascript-wasm-ci.mjs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedJavaScriptCheckoutContractRepairHistoryPath
	= "docs/evidence/owned-javascript-checkout-contract-repair-source-history-20261031.json";
export const ownedJavaScriptCheckoutContractRepairPredecessor
	= "dc025457b2e8bc77da3fdbf744d9c696c1554e29";
export const ownedJavaScriptCheckoutContractRepairImplementation
	= "d3c7456ee19f16a716ed09232835057ce8762148";
export const ownedJavaScriptCheckoutContractRepairImplementationPaths
	= Object.freeze([
		".github/workflows/owned-checked-record-npm-browser.yml"
		, "tests/helpers/owned-checked-record-npm-producer-tests.mjs"
		, "tests/helpers/owned-checked-record-npm-producer.mjs"
		, "tests/helpers/owned-javascript-wasm-ci.mjs"
		, "tests/owned-javascript-wasm-ci.test.mjs"
	]);
export const ownedJavaScriptCheckoutContractRepairIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const ownedJavaScriptCheckoutContractRepairAddedPaths
	= Object.freeze([
		"scripts/update-owned-javascript-checkout-contract-repair-source-history.mjs"
		, "tests/helpers/owned-javascript-checkout-contract-repair-source-history-tests.mjs"
		, "tests/helpers/owned-javascript-checkout-contract-repair-source-history.mjs"
	]);
export const ownedJavaScriptCheckoutContractRepairNormalizationPaths
	= Object.freeze([
		...ownedJavaScriptCheckoutContractRepairImplementationPaths
		, ...ownedJavaScriptCheckoutContractRepairIntegrationPaths
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedJavaScriptCheckoutContractRepairHistoryPath, "utf8"));

/**
 * Require the recurring and scoped producers to share the complete bounded
 * checkout contract while retaining every semantic JavaScript gate.
 *
 * @param recurring - Complete Consumer Matrix workflow source.
 * @param scoped - Complete dedicated npm producer workflow source.
 */
export const assertOwnedJavaScriptCheckoutContractRepair = (
	recurring, scoped
) => {
	const recurringContract = assertOwnedJavaScriptWasmCi(recurring);
	const scopedContract = assertOwnedCheckedRecordNpmProducer(
		scoped, recurring);
	return { recurringContract, scopedContract, checkoutFields: 5 };
};

/**
 * Reverse one authenticated repair transition.
 *
 * @param source - Complete later source.
 * @param update - Authenticated transition.
 */
export const reverseOwnedJavaScriptCheckoutContractRepairUpdate = (
	source, update
) => {
	assert.ok(ownedJavaScriptCheckoutContractRepairNormalizationPaths
		.includes(update.path), update.path);
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort()
			, ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start
			, edit.start + edit.current.length), edit.current, update.path);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only the authenticated checkout-contract repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeOwnedJavaScriptCheckoutContractRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedJavaScriptCheckoutContractRepairNormalizationPaths
			.includes(path)) return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected)
			return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseOwnedJavaScriptCheckoutContractRepairUpdate(
				current, update);
	}
	return current;
};
