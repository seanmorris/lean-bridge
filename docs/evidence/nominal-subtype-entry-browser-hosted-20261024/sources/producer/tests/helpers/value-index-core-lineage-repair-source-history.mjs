/**
 * Authenticate the Core partition repair and close the two historical
 * test-profile transitions introduced by value-index acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const valueIndexCoreLineageRepairHistoryPath
	= "docs/evidence/value-index-core-lineage-repair-source-history-20261018.json";
export const valueIndexCoreLineageRepairPredecessor
	= "f68eae559386b67172464c0a67e366c923283b11";
export const valueIndexCoreLineageRepairDraftParent
	= "228e0f114c5ae574c4a3907d250dfce6fc11af65";
export const valueIndexCoreLineageRepairChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/checked-records.test.mjs"
	, "tests/component-array-contract.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const valueIndexCoreLineageRepairHistoricalPaths = Object.freeze([
	"src/adoption/test-profiles.mjs"
]);
export const valueIndexCoreLineageRepairAddedPaths = Object.freeze([
	"scripts/update-value-index-core-lineage-repair-source-history.mjs"
	, "tests/helpers/value-index-core-lineage-repair-source-history.mjs"
	, "tests/helpers/value-index-core-lineage-repair-source-history-tests.mjs"
]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	valueIndexCoreLineageRepairHistoryPath, "utf8"
));

const reverse = (source, update, paths) => {
	assert.ok(paths.includes(update.path));
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
 * Reverse the exact current Core partition repair.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseValueIndexCoreLineageRepairUpdate = (source, update) =>
	reverse(source, update, valueIndexCoreLineageRepairChangedPaths);

/**
 * Reverse one historical value-index test-profile transition.
 *
 * @param source - Complete later source text.
 * @param update - Authenticated historical transition.
 */
export const reverseValueIndexCoreLineageHistoricalUpdate = (source, update) =>
	reverse(source, update, valueIndexCoreLineageRepairHistoricalPaths);

/**
 * Remove the current repair and, for test-profile source, both historical gaps.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeValueIndexCoreLineageRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string") return source;
	let digest = sha256(source);
	if(digest === expected) return source;
	if(valueIndexCoreLineageRepairChangedPaths.includes(path))
	{
		const update = record().updates.find(item => item.path === path);
		if(update?.currentSha256 === digest)
		{
			source = reverseValueIndexCoreLineageRepairUpdate(source, update);
			digest = sha256(source);
			if(digest === expected) return source;
		}
	}
	if(!valueIndexCoreLineageRepairHistoricalPaths.includes(path)) return source;
	while(true)
	{
		const update = record().historicalTransitions.find(item =>
			item.path === path && item.currentSha256 === digest
		);
		if(!update) return source;
		source = reverseValueIndexCoreLineageHistoricalUpdate(source, update);
		digest = sha256(source);
		if(digest === expected) return source;
	}
};
