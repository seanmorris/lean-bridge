/**
 * Reverse the value-index browser promotion closure repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const valueIndexBrowserPromotionClosureRepairHistoryPath
	= "docs/evidence/value-index-browser-promotion-closure-repair-source-history-20261023.json";
export const valueIndexBrowserPromotionClosureRepairPredecessor
	= "f8e47a79cf6b9380e52d05f820dcafac62cf781d";
export const valueIndexBrowserPromotionClosureRepairImplementation
	= "88b267add35680f9c9f7b71e5884c53b26bd4262";
export const valueIndexBrowserPromotionClosureRepairChangedPaths
	= Object.freeze([
		"tests/helpers/checked-record-value-index-browser-promotion-source-history-tests.mjs"
	]);
export const valueIndexBrowserPromotionClosureRepairIntegrationPaths
	= Object.freeze([
		"tests/component-array-contract.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const valueIndexBrowserPromotionClosureRepairNormalizationPaths
	= Object.freeze([
		...valueIndexBrowserPromotionClosureRepairChangedPaths
		, ...valueIndexBrowserPromotionClosureRepairIntegrationPaths
	]);
export const valueIndexBrowserPromotionClosureRepairAddedPaths
	= Object.freeze([
		"scripts/update-value-index-browser-promotion-closure-repair-source-history.mjs"
		, "tests/helpers/value-index-browser-promotion-closure-repair-source-history-tests.mjs"
		, "tests/helpers/value-index-browser-promotion-closure-repair-source-history.mjs"
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	valueIndexBrowserPromotionClosureRepairHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseValueIndexBrowserPromotionClosureRepairUpdate = (
	source, update
) => {
	assert.ok(valueIndexBrowserPromotionClosureRepairNormalizationPaths
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
 * Remove only this exact closure repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeValueIndexBrowserPromotionClosureRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !valueIndexBrowserPromotionClosureRepairNormalizationPaths
			.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = [...value.integrationUpdates, ...value.updates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reverseValueIndexBrowserPromotionClosureRepairUpdate(source, update)
		: source;
};
