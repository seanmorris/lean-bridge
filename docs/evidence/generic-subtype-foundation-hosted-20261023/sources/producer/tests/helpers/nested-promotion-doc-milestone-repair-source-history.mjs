/**
 * Reverse the exact nested-promotion documentation milestone repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const nestedPromotionDocMilestoneRepairHistoryPath
	= "docs/evidence/nested-promotion-doc-milestone-repair-source-history-20261023.json";
export const nestedPromotionDocMilestoneRepairPredecessor
	= "a9f3d0f66e5eca43318aa67813768de75e4cc5b1";
export const nestedPromotionDocMilestoneRepairImplementation
	= "91bae3d5b118e971a7124ac746639771ffe7de92";
export const nestedPromotionDocMilestoneRepairChangedPaths = Object.freeze([
	"tests/helpers/nested-checked-record-browser-promotion-tests.mjs"
	, "tests/helpers/nested-checked-record-python-promotion-tests.mjs"
]);
export const nestedPromotionDocMilestoneRepairIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/nested-checked-records.test.mjs"
]);
export const nestedPromotionDocMilestoneRepairNormalizationPaths = Object.freeze([
	...nestedPromotionDocMilestoneRepairChangedPaths
	, ...nestedPromotionDocMilestoneRepairIntegrationPaths
]);
export const nestedPromotionDocMilestoneRepairAddedPaths = Object.freeze([
	"scripts/update-nested-promotion-doc-milestone-repair-source-history.mjs"
	, "tests/helpers/nested-promotion-doc-milestone-repair-source-history-tests.mjs"
	, "tests/helpers/nested-promotion-doc-milestone-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	nestedPromotionDocMilestoneRepairHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseNestedPromotionDocMilestoneRepairUpdate = (source, update) => {
	assert.ok(nestedPromotionDocMilestoneRepairNormalizationPaths
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
 * Remove only the exact nested-promotion documentation milestone repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping SHA-256.
 */
export const beforeNestedPromotionDocMilestoneRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !nestedPromotionDocMilestoneRepairNormalizationPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = [...value.integrationUpdates, ...value.updates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reverseNestedPromotionDocMilestoneRepairUpdate(source, update)
		: source;
};
