/**
 * Preserve the exact Kotlin null-boundary diagnostic correction separately
 * from the original installed-JVM acceptance evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const checkedRecordValueIndexJvmNullBoundaryHistoryPath
	= "docs/evidence/checked-record-value-index-jvm-null-boundary-source-history-20261019.json";
export const checkedRecordValueIndexJvmNullBoundaryPredecessor
	= "7cbe4dd60ffa7e484219110f22d6953991092520";
export const checkedRecordValueIndexJvmNullBoundaryDraftParent
	= "dbcb121d073f4f1f34bbeea8e1658fd31a69045e";
export const checkedRecordValueIndexJvmNullBoundaryFoundationModifiedPaths
	= Object.freeze([
		"tests/fixtures/checked-record-value-index-jvm/kotlin.kt"
	]);
export const checkedRecordValueIndexJvmNullBoundaryChangedPaths
	= Object.freeze([
		...checkedRecordValueIndexJvmNullBoundaryFoundationModifiedPaths
		, "tests/checked-record-value-index-jvm.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const checkedRecordValueIndexJvmNullBoundaryHistoryAddedPaths
	= Object.freeze([
		"scripts/update-checked-record-value-index-jvm-null-boundary-source-history.mjs"
		, "tests/helpers/checked-record-value-index-jvm-null-boundary-source-history-tests.mjs"
		, "tests/helpers/checked-record-value-index-jvm-null-boundary-source-history.mjs"
	]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	checkedRecordValueIndexJvmNullBoundaryHistoryPath, "utf8"
));

/**
 * Reverse one exact Kotlin null-boundary source transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseCheckedRecordValueIndexJvmNullBoundaryUpdate = (
	source, update
) => {
	assert.ok(checkedRecordValueIndexJvmNullBoundaryChangedPaths.includes(
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
 * Remove only the exact Kotlin null-boundary diagnostic source layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCheckedRecordValueIndexJvmNullBoundarySource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !checkedRecordValueIndexJvmNullBoundaryChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseCheckedRecordValueIndexJvmNullBoundaryUpdate(source, update)
		: source;
};
