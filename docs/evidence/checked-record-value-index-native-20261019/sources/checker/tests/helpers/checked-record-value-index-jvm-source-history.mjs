/**
 * Authenticate the static JVM checked-record value-index foundation as one
 * exact, reversible transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const checkedRecordValueIndexJvmHistoryPath
	= "docs/evidence/checked-record-value-index-jvm-source-history-20261018.json";
export const checkedRecordValueIndexJvmPredecessor
	= "59d50c538589be9f2fd2460a7e4a1d383130ff00";
export const checkedRecordValueIndexJvmDraftParent
	= "f31d4b6b21b62cb494c648e1f0574942261b2d2d";
export const checkedRecordValueIndexJvmChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "src/adoption/test-profiles.mjs"
	, "tests/component-array-contract.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const checkedRecordValueIndexJvmFoundationAddedPaths = Object.freeze([
	"tests/checked-record-value-index-jvm.test.mjs"
	, "tests/fixtures/checked-record-value-index-jvm/java.java"
	, "tests/fixtures/checked-record-value-index-jvm/kotlin.kt"
	, "tests/helpers/checked-record-value-index-jvm-caller-tests.mjs"
	, "tests/helpers/checked-record-value-index-jvm-fixture-tests.mjs"
	, "tests/helpers/checked-record-value-index-jvm-fixture.mjs"
]);
export const checkedRecordValueIndexJvmHistoryAddedPaths = Object.freeze([
	"scripts/update-checked-record-value-index-jvm-source-history.mjs"
	, "tests/helpers/checked-record-value-index-jvm-source-history.mjs"
	, "tests/helpers/checked-record-value-index-jvm-source-history-tests.mjs"
]);
export const checkedRecordValueIndexJvmAddedPaths = Object.freeze([
	...checkedRecordValueIndexJvmFoundationAddedPaths
	, ...checkedRecordValueIndexJvmHistoryAddedPaths
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	checkedRecordValueIndexJvmHistoryPath, "utf8"
));

/**
 * Reverse one exact static JVM value-index foundation transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseCheckedRecordValueIndexJvmUpdate = (source, update) => {
	assert.ok(checkedRecordValueIndexJvmChangedPaths.includes(update.path));
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
 * Remove only the exact static JVM value-index foundation layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCheckedRecordValueIndexJvmSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !checkedRecordValueIndexJvmChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseCheckedRecordValueIndexJvmUpdate(source, update) : source;
};
