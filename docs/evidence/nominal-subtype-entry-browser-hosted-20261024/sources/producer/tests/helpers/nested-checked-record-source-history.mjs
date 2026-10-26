/**
 * Authenticate the exact nested checked-record compiler transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const nestedCheckedRecordHistoryPath
	= "docs/evidence/nested-checked-record-source-history-20261016.json";
export const nestedCheckedRecordPredecessor
	= "e0fed7f5f86d8c254a1064fc9eb1ad2e1b39ea0e";
export const nestedCheckedRecordDraftParent
	= "e8e5d81de28592f08ad58a8bbdfba1e97b73fecc";
export const nestedCheckedRecordChangedPaths = Object.freeze([
	"schema/compiler-adapter-plan.schema.json"
	, "schema/lean-export-configuration.schema.json"
	, "src/abi/refinements.mjs"
	, "src/analyze/NativeExports.lean"
	, "src/analyze/checked-refinement-selection.mjs"
	, "src/analyze/elaborated-metadata.mjs"
	, "src/analyze/native-types.mjs"
	, "src/analyze/reviewed-source.mjs"
	, "src/analyze/semantic-model.mjs"
	, "src/backends/javascript/generate.mjs"
	, "src/backends/native/fin-refinements.mjs"
	, "src/build/compiler-adapters.mjs"
	, "src/build/component-fin-guards.mjs"
	, "src/build/component-refinement-mirrors.mjs"
	, "src/build/component-refinements.mjs"
	, "src/build/native-model.mjs"
	, "src/build/refinement-mirrors.mjs"
	, "tests/c-structured-callable-contract.test.mjs"
	, "tests/helpers/checked-record-fixture.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
let history;

/**
 * Reverse one authenticated complete-source transition.
 *
 * @param source - Complete current source.
 * @param update - Exact reversible transition record.
 */
export const reverseNestedCheckedRecordUpdate = (source, update) => {
	assert.ok(nestedCheckedRecordChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0; const parts = [];
	for(const edit of update.edits)
	{
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
		assert.equal(typeof edit.previous, "string");
		assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start, edit.start + edit.current.length), edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor)); const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only this transition when its complete current identity matches.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current source.
 */
export const withoutNestedCheckedRecord = (path, source) => {
	if(typeof source !== "string" || !nestedCheckedRecordChangedPaths.includes(path))
		return source;
	const record = history ??= JSON.parse(readFileSync(nestedCheckedRecordHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === sha256(source)
		? reverseNestedCheckedRecordUpdate(source, update) : source;
};

/**
 * Preserve unknown edits and stop at an explicitly requested digest.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current source.
 * @param expected - Optional exact stopping SHA-256.
 */
export const beforeNestedCheckedRecordSource = (path, source, expected) => {
	if(typeof source !== "string" || !nestedCheckedRecordChangedPaths.includes(path)
		|| sha256(source) === expected) return source;
	return withoutNestedCheckedRecord(path, source);
};
