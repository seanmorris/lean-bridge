/**
 * Reverse the explicit Author refinement guidance repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const authorRefinementGuidanceRepairHistoryPath
	= "docs/evidence/author-refinement-guidance-repair-source-history-20261024.json";
export const authorRefinementGuidanceRepairPredecessor
	= "3298c7461ce704c058d6eadf98871a3db1b61680";
export const authorRefinementGuidanceRepairImplementation
	= "71c8f73906c670290177d331dfbf5f2be67e70af";
export const authorRefinementGuidanceRepairIntegrationBase
	= "71c8f73906c670290177d331dfbf5f2be67e70af";
export const authorRefinementGuidanceRepairChangedPaths = Object.freeze([
	"docs/lean/existing-package.md"
	, "scripts/generate-type-docs.mjs"
	, "tests/callback-subtype-promotion.test.mjs"
	, "tests/lean-author-documentation.test.mjs"
]);
export const authorRefinementGuidanceRepairIntegrationPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/checked-javascript.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/lean-author-documentation.test.mjs"
]);
export const authorRefinementGuidanceRepairNormalizationPaths = Object.freeze([
	...authorRefinementGuidanceRepairChangedPaths
	, ...authorRefinementGuidanceRepairIntegrationPaths
]);
export const authorRefinementGuidanceRepairAddedPaths = Object.freeze([
	"scripts/update-author-refinement-guidance-repair-source-history.mjs"
	, "tests/helpers/author-refinement-guidance-repair-source-history-tests.mjs"
	, "tests/helpers/author-refinement-guidance-repair-source-history.mjs"
	, "tests/helpers/author-refinement-consistency-tests.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	authorRefinementGuidanceRepairHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseAuthorRefinementGuidanceRepairUpdate = (
	source, update
) => {
	assert.ok(authorRefinementGuidanceRepairNormalizationPaths
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
 * Remove only the exact Author refinement guidance repair.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeAuthorRefinementGuidanceRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !authorRefinementGuidanceRepairNormalizationPaths.includes(path))
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
		current = reverseAuthorRefinementGuidanceRepairUpdate(current, update);
	}
	return current;
};
