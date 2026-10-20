/**
 * Authenticate the hosted recursive checked-record native archive pin as one
 * exact, reversible source transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const mutualCheckedRecordNativeArchiveHistoryPath
	= "docs/evidence/mutual-checked-record-native-archive-source-history-20261018.json";
export const mutualCheckedRecordNativeArchivePredecessor
	= "9d95e09a9bf04b187a7de086deb7a44e4b3193c6";
export const mutualCheckedRecordNativeArchiveDraftParent
	= "9d95e09a9bf04b187a7de086deb7a44e4b3193c6";
export const mutualCheckedRecordNativeArchiveChangedPaths = Object.freeze([
	"tests/helpers/checked-javascript-disposition-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/mutual-checked-record-native-evidence.mjs"
]);
export const mutualCheckedRecordNativeArchiveAddedPaths = Object.freeze([
	"scripts/update-mutual-checked-record-native-archive-history.mjs"
	, "tests/helpers/mutual-checked-record-native-archive-source-history.mjs"
]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	mutualCheckedRecordNativeArchiveHistoryPath, "utf8"
));

/**
 * Reverse one exact recursive native archive-pin transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseMutualCheckedRecordNativeArchiveUpdate = (
	source, update
) => {
	assert.ok(mutualCheckedRecordNativeArchiveChangedPaths.includes(
		update.path));
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
 * Remove only the exact recursive native archive-pin layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeMutualCheckedRecordNativeArchiveSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !mutualCheckedRecordNativeArchiveChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseMutualCheckedRecordNativeArchiveUpdate(source, update)
		: source;
};
