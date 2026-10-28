/**
 * Reverse the value-index promotion milestone and bounded-cell repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const valueIndexPromotionMemoryRepairHistoryPath
	= "docs/evidence/value-index-promotion-memory-repair-source-history-20261023.json";
export const valueIndexPromotionMemoryRepairPredecessor
	= "aa491aa67b77469478d18f00bb78f0c717e5bbfa";
export const valueIndexPromotionMemoryRepairImplementation
	= "555fb9a4c48e014f67c49eef6f9a504d73456cba";
export const valueIndexPromotionMemoryRepairChangedPaths = Object.freeze([
	"src/adoption/type-surface.mjs"
	, "tests/helpers/checked-record-value-index-browser-promotion-tests.mjs"
	, "tests/type-surface.test.mjs"
]);
export const valueIndexPromotionMemoryRepairIntegrationPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/component-array-contract.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const valueIndexPromotionMemoryRepairNormalizationPaths = Object.freeze([
	...valueIndexPromotionMemoryRepairChangedPaths
	, ...valueIndexPromotionMemoryRepairIntegrationPaths
]);
export const valueIndexPromotionMemoryRepairAddedPaths = Object.freeze([
	"scripts/update-value-index-promotion-memory-repair-source-history.mjs"
	, "tests/helpers/value-index-promotion-memory-repair-source-history-tests.mjs"
	, "tests/helpers/value-index-promotion-memory-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	valueIndexPromotionMemoryRepairHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseValueIndexPromotionMemoryRepairUpdate = (
	source, update
) => {
	assert.ok(valueIndexPromotionMemoryRepairNormalizationPaths
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
 * Remove only this exact value-index promotion memory repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeValueIndexPromotionMemoryRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !valueIndexPromotionMemoryRepairNormalizationPaths
			.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = [...value.integrationUpdates, ...value.updates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reverseValueIndexPromotionMemoryRepairUpdate(source, update)
		: source;
};
