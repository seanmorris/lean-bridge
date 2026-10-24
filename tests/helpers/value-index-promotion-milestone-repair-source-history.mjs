/**
 * Reverse the explicit Value-index promotion milestone repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const valueIndexPromotionMilestoneRepairHistoryPath
	= "docs/evidence/value-index-promotion-milestone-repair-source-history-20261024.json";
export const valueIndexPromotionMilestoneRepairPredecessor
	= "523ef62011b53c38444f01a9056392bfe3ed1d9a";
export const valueIndexPromotionMilestoneRepairImplementation
	= "8d98a43200580caa7dbd2c4485d5b84bbea3104d";
export const valueIndexPromotionMilestoneRepairIntegrationBase
	= "7bfc573c5427caf231b3860ed43256927c948cc5";
export const valueIndexPromotionMilestoneRepairChangedPaths = Object.freeze([
	"tests/helpers/checked-record-value-index-php-wasm-promotion-tests.mjs"
	, "tests/helpers/checked-record-value-index-php-wasm-promotion.mjs"
	, "tests/helpers/checked-record-value-index-python-promotion-tests.mjs"
	, "tests/helpers/checked-record-value-index-python-promotion.mjs"
	, "tests/helpers/checked-record-value-index-ruby-promotion-tests.mjs"
	, "tests/helpers/checked-record-value-index-ruby-promotion.mjs"
	, "tests/helpers/checked-record-value-index-rust-promotion-tests.mjs"
	, "tests/helpers/checked-record-value-index-rust-promotion.mjs"
	, "tests/helpers/checked-record-value-index-wit-promotion-tests.mjs"
	, "tests/helpers/checked-record-value-index-wit-promotion.mjs"
]);
export const valueIndexPromotionMilestoneRepairIntegrationPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-record-value-index-php-wasm.test.mjs"
]);
export const valueIndexPromotionMilestoneRepairNormalizationPaths = Object.freeze([
	...valueIndexPromotionMilestoneRepairChangedPaths
	, ...valueIndexPromotionMilestoneRepairIntegrationPaths
]);
export const valueIndexPromotionMilestoneRepairAddedPaths = Object.freeze([
	"scripts/update-value-index-promotion-milestone-repair-source-history.mjs"
	, "tests/helpers/value-index-promotion-milestone-repair-source-history-tests.mjs"
	, "tests/helpers/value-index-promotion-milestone-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	valueIndexPromotionMilestoneRepairHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseValueIndexPromotionMilestoneRepairUpdate = (
	source, update
) => {
	assert.ok(valueIndexPromotionMilestoneRepairNormalizationPaths
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
 * Remove only the exact Value-index promotion milestone repair.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeValueIndexPromotionMilestoneRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !valueIndexPromotionMilestoneRepairNormalizationPaths.includes(path))
		return source;
	const value = record();
	const updates = [...value.integrationUpdates, ...value.updates];
	let current = source;
	for(let count = 0; count < updates.length; count++)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseValueIndexPromotionMilestoneRepairUpdate(current, update);
	}
	return current;
};
