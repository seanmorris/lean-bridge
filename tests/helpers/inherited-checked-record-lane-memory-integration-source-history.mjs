/**
 * Reverse central registration of the authenticated inherited checked-record lane memory bound.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const inheritedCheckedRecordLaneMemoryIntegrationHistoryPath
	= "docs/evidence/inherited-checked-record-lane-memory-integration-source-history-20261028.json";
export const inheritedCheckedRecordLaneMemoryIntegrationBase
	= "02f509b5accbd8cdff2a0bba06e3b3f63413e099";
export const inheritedCheckedRecordLaneMemoryIntegrationImplementation
	= "5ee05c3899bf04374ab6af2156d34aae35db0ff0";
export const inheritedCheckedRecordLaneMemoryIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript-partition-10.test.mjs"
]);
export const inheritedCheckedRecordLaneMemoryIntegrationNormalizationPaths
	= inheritedCheckedRecordLaneMemoryIntegrationPaths;
export const inheritedCheckedRecordLaneMemoryIntegrationAddedPaths = Object.freeze([
	"scripts/update-inherited-checked-record-lane-memory-integration-source-history.mjs"
	, "tests/helpers/inherited-checked-record-lane-memory-integration-source-history-tests.mjs"
	, "tests/helpers/inherited-checked-record-lane-memory-integration-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	inheritedCheckedRecordLaneMemoryIntegrationHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated integration transition.
 *
 * @param source - Complete current source text.
 * @param update - Recorded transition.
 */
export const reverseInheritedCheckedRecordLaneMemoryIntegrationUpdate = (
	source, update
) => {
	assert.ok(inheritedCheckedRecordLaneMemoryIntegrationPaths.includes(update.path));
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
			, edit.start + edit.current.length), edit.current, update.path);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only this integration layer, stopping at an optional exact digest.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeInheritedCheckedRecordLaneMemoryIntegrationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !inheritedCheckedRecordLaneMemoryIntegrationPaths.includes(path)) return source;
	if(sha256(source) === expected) return source;
	const update = record().updates.find(item =>
		item.path === path && item.currentSha256 === sha256(source));
	return update === undefined ? source
		: reverseInheritedCheckedRecordLaneMemoryIntegrationUpdate(source, update);
};
