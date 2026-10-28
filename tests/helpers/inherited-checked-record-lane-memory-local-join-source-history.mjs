/**
 * Preserve the local join between the Perl milestone-read/Ruby layers and the
 * inherited checked-record lane-memory integration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const inheritedCheckedRecordLaneMemoryLocalJoinHistoryPath
	= "docs/evidence/inherited-checked-record-lane-memory-local-join-source-history-20261028.json";
export const inheritedCheckedRecordLaneMemoryLocalJoinPredecessor
	= "981a52bbd79a2c0375b3cd75f1127a95e29262fc";
export const inheritedCheckedRecordLaneMemoryLocalJoinImplementation
	= "cbccc82efb17ee000b7da2faba5d538ae4e15500";
export const inheritedCheckedRecordLaneMemoryLocalJoinCommits = Object.freeze([
	"879a99249056f2f3f81ad2451d90ab1cc085475d"
	, "cbccc82efb17ee000b7da2faba5d538ae4e15500"
]);
export const inheritedCheckedRecordLaneMemoryLocalJoinChangedPaths
	= Object.freeze([
		"tests/checked-javascript-partition-10.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const inheritedCheckedRecordLaneMemoryLocalJoinNormalizationPaths
	= inheritedCheckedRecordLaneMemoryLocalJoinChangedPaths;
export const inheritedCheckedRecordLaneMemoryLocalJoinImplementationAddedPaths
	= Object.freeze([
		"docs/evidence/inherited-checked-record-lane-memory-integration-source-history-20261028.json"
		, "scripts/update-inherited-checked-record-lane-memory-integration-source-history.mjs"
		, "tests/helpers/inherited-checked-record-lane-memory-integration-source-history-tests.mjs"
		, "tests/helpers/inherited-checked-record-lane-memory-integration-source-history.mjs"
	]);
export const inheritedCheckedRecordLaneMemoryLocalJoinHistoryAddedPaths
	= Object.freeze([
		"scripts/update-inherited-checked-record-lane-memory-local-join-source-history.mjs"
		, "tests/helpers/inherited-checked-record-lane-memory-local-join-source-history-tests.mjs"
		, "tests/helpers/inherited-checked-record-lane-memory-local-join-source-history.mjs"
	]);
export const inheritedCheckedRecordLaneMemoryLocalJoinAddedPaths
	= Object.freeze([
		...inheritedCheckedRecordLaneMemoryLocalJoinImplementationAddedPaths
		, ...inheritedCheckedRecordLaneMemoryLocalJoinHistoryAddedPaths
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	inheritedCheckedRecordLaneMemoryLocalJoinHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated source transition.
 *
 * @param source - Complete current source.
 * @param update - Recorded transition.
 */
export const reverseInheritedCheckedRecordLaneMemoryLocalJoinUpdate
	= (source, update) => {
		assert.ok(inheritedCheckedRecordLaneMemoryLocalJoinNormalizationPaths
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
 * Reverse the local join and merged memory integration to an exact digest.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping SHA-256.
 */
export const beforeInheritedCheckedRecordLaneMemoryLocalJoinSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !inheritedCheckedRecordLaneMemoryLocalJoinNormalizationPaths
			.includes(path)) return source;
	const value = record();
	const updates = [...value.integrationUpdates, ...value.updates];
	let current = source;
	for(let count = 0; count < updates.length; ++count)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseInheritedCheckedRecordLaneMemoryLocalJoinUpdate(
			current, update);
	}
	return current;
};
