/**
 * Reverse the retained callback checked-record promotion refresh.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const callbackCheckedRecordPromotionRefreshHistoryPath
	= "docs/evidence/callback-checked-record-promotion-refresh-source-history-20261023.json";
export const callbackCheckedRecordPromotionRefreshPredecessor
	= "e55e7fb4e5d38019f9c2305003652ec3dfc19e14";
export const callbackCheckedRecordPromotionRefreshImplementation
	= "98425db4d9b2314c6ab4de4d838410f675efd2c8";
export const callbackCheckedRecordPromotionRefreshChangedPaths
	= Object.freeze([
		"docs/consume/c.md"
		, "docs/consume/cpp.md"
		, "docs/javascript-typescript.md"
		, "docs/lean/existing-package.md"
		, "docs/lean/export-decisions.md"
		, "docs/reference/types.md"
		, "docs/type-surface.v1.json"
		, "scripts/generate-type-docs.mjs"
		, "scripts/promote-callback-checked-record-evidence.mjs"
		, "tests/callback-checked-record-promotion.test.mjs"
		, "tests/helpers/callback-checked-record-promotion.mjs"
		, "tests/helpers/callback-subtype-documentation.mjs"
	]);
export const callbackCheckedRecordPromotionRefreshApplicationAddedPaths
	= Object.freeze([
		"docs/evidence/callback-checked-record-promotion-20261023.md"
	]);
export const callbackCheckedRecordPromotionRefreshIntegrationPaths
	= Object.freeze([
		"tests/component-array-contract.test.mjs"
		, "tests/helpers/callback-checked-record-promotion-source-history-tests.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const callbackCheckedRecordPromotionRefreshNormalizationPaths
	= Object.freeze([
		...callbackCheckedRecordPromotionRefreshChangedPaths
		, ...callbackCheckedRecordPromotionRefreshIntegrationPaths
	]);
export const callbackCheckedRecordPromotionRefreshAddedPaths
	= Object.freeze([
		...callbackCheckedRecordPromotionRefreshApplicationAddedPaths
		, "scripts/update-callback-checked-record-promotion-refresh-source-history.mjs"
		, "tests/helpers/callback-checked-record-promotion-refresh-source-history-tests.mjs"
		, "tests/helpers/callback-checked-record-promotion-refresh-source-history.mjs"
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	callbackCheckedRecordPromotionRefreshHistoryPath, "utf8"
));

/**
 * Reverse one exact retained-promotion refresh transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseCallbackCheckedRecordPromotionRefreshUpdate = (
	source, update
) => {
	assert.ok(callbackCheckedRecordPromotionRefreshNormalizationPaths
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
 * Remove only the exact retained-promotion refresh.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCallbackCheckedRecordPromotionRefreshSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !callbackCheckedRecordPromotionRefreshNormalizationPaths
			.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = [...value.integrationUpdates, ...value.updates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reverseCallbackCheckedRecordPromotionRefreshUpdate(source, update)
		: source;
};
