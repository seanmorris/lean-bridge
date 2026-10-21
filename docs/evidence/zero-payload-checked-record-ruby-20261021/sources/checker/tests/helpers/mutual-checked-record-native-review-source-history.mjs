/**
 * Authenticate the independent-review corrections for recursive checked-record
 * native evidence as one exact, reversible source transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const mutualCheckedRecordNativeReviewHistoryPath
	= "docs/evidence/mutual-checked-record-native-review-source-history-20261018.json";
export const mutualCheckedRecordNativeReviewPredecessor
	= "6ee571bb17efd72158343c5fa1aa3f8f98c8d879";
export const mutualCheckedRecordNativeReviewDraftParent
	= "6ee571bb17efd72158343c5fa1aa3f8f98c8d879";
export const mutualCheckedRecordNativeReviewChangedPaths = Object.freeze([
	"scripts/archive-mutual-checked-record-native.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/mutual-checked-record-native-controls.mjs"
	, "tests/helpers/mutual-checked-record-native-evidence.mjs"
	, "tests/helpers/mutual-checked-record-native-hardening-source-history-tests.mjs"
	, "tests/helpers/mutual-checked-record-native-installed-tests.mjs"
	, "tests/helpers/mutual-checked-record-native-report.mjs"
	, "tests/mutual-checked-records.test.mjs"
]);
export const mutualCheckedRecordNativeReviewAddedPaths = Object.freeze([
	"scripts/update-mutual-checked-record-native-review-source-history.mjs"
	, "tests/helpers/mutual-checked-record-native-review-source-history.mjs"
	, "tests/helpers/mutual-checked-record-native-review-source-history-tests.mjs"
]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	mutualCheckedRecordNativeReviewHistoryPath, "utf8"));

/**
 * Reverse one exact recursive-native review correction.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseMutualCheckedRecordNativeReviewUpdate = (
	source, update
) => {
	assert.ok(mutualCheckedRecordNativeReviewChangedPaths.includes(update.path));
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
 * Remove only the exact recursive-native review layer from current source.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeMutualCheckedRecordNativeReviewSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !mutualCheckedRecordNativeReviewChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseMutualCheckedRecordNativeReviewUpdate(source, update)
		: source;
};
