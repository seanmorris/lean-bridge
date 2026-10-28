/**
 * Reverse the inherited checked-record documentation replay repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const inheritedDocsReplayRepairHistoryPath
	= "docs/evidence/inherited-docs-replay-repair-source-history-20261023.json";
export const inheritedDocsReplayRepairPredecessor
	= "7340e71a4e16a0589f69199408b8abf6d367f8c9";
export const inheritedDocsReplayRepairImplementation
	= "79a2ec5f94ba40c3666e733f7b5d3c2596b5a480";
export const inheritedDocsReplayRepairChangedPaths = Object.freeze([
	"tests/helpers/inherited-checked-record-docs-closure-source-history-tests.mjs"
]);
export const inheritedDocsReplayRepairIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/lean-author-documentation.test.mjs"
]);
export const inheritedDocsReplayRepairNormalizationPaths = Object.freeze([
	...inheritedDocsReplayRepairChangedPaths
	, ...inheritedDocsReplayRepairIntegrationPaths
]);
export const inheritedDocsReplayRepairAddedPaths = Object.freeze([
	"scripts/update-inherited-docs-replay-repair-source-history.mjs"
	, "tests/helpers/inherited-docs-replay-repair-source-history-tests.mjs"
	, "tests/helpers/inherited-docs-replay-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	inheritedDocsReplayRepairHistoryPath, "utf8"
));

/**
 * Restore one exact source transition after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseInheritedDocsReplayRepairUpdate = (source, update) => {
	assert.ok(inheritedDocsReplayRepairNormalizationPaths.includes(update.path));
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
 * Remove only the exact inherited documentation replay repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeInheritedDocsReplayRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !inheritedDocsReplayRepairNormalizationPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = [...value.integrationUpdates, ...value.updates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update ? reverseInheritedDocsReplayRepairUpdate(source, update) : source;
};
