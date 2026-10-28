/**
 * Reverse the fail-closed dependent checked-record promotion contract.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const dependentCheckedRecordPromotionContractHistoryPath
	= "docs/evidence/dependent-checked-record-promotion-contract-source-history-20261022.json";
export const dependentCheckedRecordPromotionContractPredecessor
	= "6cff3434bff38689ea6bda776ae143057a265ad5";
export const dependentCheckedRecordPromotionContractImplementation
	= "52bfa85c58f5e0b6f3641f639f619a9be0a8904f";
export const dependentCheckedRecordPromotionContractImplementationPaths
	= Object.freeze([
		"scripts/promote-dependent-checked-record-evidence.mjs"
		, "src/adoption/test-profiles.mjs"
		, "tests/dependent-checked-record-promotion.test.mjs"
		, "tests/helpers/dependent-checked-record-promotion.mjs"
	]);
export const dependentCheckedRecordPromotionContractModifiedPaths
	= Object.freeze(["src/adoption/test-profiles.mjs"]);
export const dependentCheckedRecordPromotionContractImplementationAdditions
	= Object.freeze([
		"scripts/promote-dependent-checked-record-evidence.mjs"
		, "tests/dependent-checked-record-promotion.test.mjs"
		, "tests/helpers/dependent-checked-record-promotion.mjs"
	]);
export const dependentCheckedRecordPromotionContractIntegrationPaths
	= Object.freeze([
		"tests/component-array-contract.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const dependentCheckedRecordPromotionContractChangedPaths
	= Object.freeze([
		...dependentCheckedRecordPromotionContractModifiedPaths
		, ...dependentCheckedRecordPromotionContractIntegrationPaths
	]);
export const dependentCheckedRecordPromotionContractAddedPaths
	= Object.freeze([
		...dependentCheckedRecordPromotionContractImplementationAdditions
		, "scripts/update-dependent-checked-record-promotion-contract-source-history.mjs"
		, "tests/helpers/dependent-checked-record-promotion-contract-source-history-tests.mjs"
		, "tests/helpers/dependent-checked-record-promotion-contract-source-history.mjs"
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	dependentCheckedRecordPromotionContractHistoryPath, "utf8"));

/**
 * Restore one exact promotion-contract transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseDependentCheckedRecordPromotionContractUpdate = (
	source, update
) => {
	assert.ok(dependentCheckedRecordPromotionContractChangedPaths
		.includes(update.path));
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
		assert.equal(typeof edit.previous, "string");
		assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start
			, edit.start + edit.current.length), edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only the exact dependent checked-record promotion contract.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeDependentCheckedRecordPromotionContractSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !dependentCheckedRecordPromotionContractChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = [...value.updates, ...value.integrationUpdates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reverseDependentCheckedRecordPromotionContractUpdate(source, update)
		: source;
};
