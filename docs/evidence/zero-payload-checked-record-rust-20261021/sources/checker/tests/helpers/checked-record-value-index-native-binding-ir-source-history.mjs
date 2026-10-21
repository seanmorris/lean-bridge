/**
 * Preserve the native value-index report repair that separates reviewed and
 * compiler-derived Binding IR identities.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const checkedRecordValueIndexNativeBindingIrHistoryPath
	= "docs/evidence/checked-record-value-index-native-binding-ir-source-history-20261019.json";
export const checkedRecordValueIndexNativeBindingIrPredecessor
	= "df22aa02bea72c3de550f15ab00b2a89b70f279e";
export const checkedRecordValueIndexNativeBindingIrDraftParent
	= "6135b91bc84dae8f7e901b13f3d84b736b828794";
export const checkedRecordValueIndexNativeBindingIrFoundationModifiedPaths
	= Object.freeze([
		"tests/checked-record-value-index-native.test.mjs"
		, "tests/helpers/checked-record-value-index-native-report.mjs"
	]);
export const checkedRecordValueIndexNativeBindingIrFoundationAddedPaths
	= Object.freeze([
		"tests/helpers/checked-record-value-index-native-report-tests.mjs"
	]);
export const checkedRecordValueIndexNativeBindingIrChangedPaths
	= Object.freeze([
		...checkedRecordValueIndexNativeBindingIrFoundationModifiedPaths
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const checkedRecordValueIndexNativeBindingIrHistoryAddedPaths
	= Object.freeze([
		"scripts/update-checked-record-value-index-native-binding-ir-source-history.mjs"
		, "tests/helpers/checked-record-value-index-native-binding-ir-source-history-tests.mjs"
		, "tests/helpers/checked-record-value-index-native-binding-ir-source-history.mjs"
	]);
export const checkedRecordValueIndexNativeBindingIrAddedPaths
	= Object.freeze([
		...checkedRecordValueIndexNativeBindingIrFoundationAddedPaths
		, ...checkedRecordValueIndexNativeBindingIrHistoryAddedPaths
	]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	checkedRecordValueIndexNativeBindingIrHistoryPath, "utf8"
));

/**
 * Reverse one exact native Binding IR report repair transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseCheckedRecordValueIndexNativeBindingIrUpdate = (
	source, update
) => {
	assert.ok(checkedRecordValueIndexNativeBindingIrChangedPaths.includes(
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
 * Remove only the exact native Binding IR report repair source layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCheckedRecordValueIndexNativeBindingIrSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !checkedRecordValueIndexNativeBindingIrChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseCheckedRecordValueIndexNativeBindingIrUpdate(source, update)
		: source;
};
