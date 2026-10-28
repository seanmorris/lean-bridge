/**
 * Preserve the exact source transition that promotes hosted dependent checked
 * records into the public type surface.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const dependentCheckedRecordPromotionHistoryPath
	= "docs/evidence/dependent-checked-record-promotion-source-history-20261023.json";
export const dependentCheckedRecordPromotionImplementation
	= "2d45fdb442070f5b2019b90b77cce6d09d98fe74";
export const dependentCheckedRecordPromotionSourcePredecessor
	= "d34c296f5aadcfcc0c64086f8d8ecfee54a64ecc";
export const dependentCheckedRecordPromotionModifiedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/dependent-checked-record-promotion.test.mjs"
	, "tests/helpers/dependent-checked-record-promotion.mjs"
]);
export const dependentCheckedRecordPromotionFoundationAddedPaths
	= Object.freeze([
		"docs/evidence/dependent-checked-record-promotion.md"
	]);
export const dependentCheckedRecordPromotionIntegrationPaths = Object.freeze([
	"tests/component-array-contract.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const dependentCheckedRecordPromotionChangedPaths = Object.freeze([
	...dependentCheckedRecordPromotionModifiedPaths
	, ...dependentCheckedRecordPromotionIntegrationPaths
]);
export const dependentCheckedRecordPromotionHistoryAddedPaths = Object.freeze([
	"scripts/update-dependent-checked-record-promotion-source-history.mjs"
	, "tests/helpers/dependent-checked-record-promotion-source-history-tests.mjs"
	, "tests/helpers/dependent-checked-record-promotion-source-history.mjs"
]);
export const dependentCheckedRecordPromotionAddedPaths = Object.freeze([
	...dependentCheckedRecordPromotionFoundationAddedPaths
	, ...dependentCheckedRecordPromotionHistoryAddedPaths
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	dependentCheckedRecordPromotionHistoryPath, "utf8"
));

/**
 * Reverse one exact dependent checked-record promotion update.
 *
 * @param {string} source Current source bytes.
 * @param {object} update Authenticated source transition.
 */
export const reverseDependentCheckedRecordPromotionUpdate = (
	source, update
) => {
	assert.ok(dependentCheckedRecordPromotionChangedPaths.includes(update.path));
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
 * Remove only the exact dependent checked-record promotion layer.
 *
 * @param {string} path Repository-relative source path.
 * @param {string} source Current source bytes.
 * @param {string} [expected] Requested historical source digest.
 */
export const beforeDependentCheckedRecordPromotionSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !dependentCheckedRecordPromotionChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = [...value.integrationUpdates, ...value.updates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reverseDependentCheckedRecordPromotionUpdate(source, update)
		: source;
};
