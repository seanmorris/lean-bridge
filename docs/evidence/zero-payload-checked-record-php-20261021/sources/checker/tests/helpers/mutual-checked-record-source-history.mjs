/**
 * Authenticate the recursive-to-mutual checked-record compiler and C/C++ transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
	beforeNestedCheckedRecordMatrixClosurePins
	, beforeNestedCheckedRecordMatrixClosureSource
} from "./nested-checked-record-matrix-closure-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

export const mutualCheckedRecordHistoryPath
	= "docs/evidence/mutual-checked-record-source-history-20261016.json";
export const mutualCheckedRecordPredecessor
	= "90011edcbbedddf5a3f8af5f216bd726491b78e4";
export const mutualCheckedRecordDraftParent
	= "6eea8f1af961fb21c745240a83775bc742495bb8";
export const mutualCheckedRecordChangedPaths = [
	"docs/type-surface.v1.json"
	, "src/analyze/NativeExports.lean"
	, "src/analyze/checked-refinement-selection.mjs"
	, "src/analyze/copied-metadata-graph.mjs"
	, "src/analyze/elaborated-metadata.mjs"
	, "src/analyze/native-types.mjs"
	, "src/analyze/reviewed-source.mjs"
	, "src/analyze/semantic-model.mjs"
	, "src/backends/c/graph-package.mjs"
	, "src/backends/c/native-graph-adapters.mjs"
	, "src/backends/cpp/copied-graph-conversions.mjs"
	, "src/build/component-refinement-mirrors.mjs"
	, "src/build/component-refinements.mjs"
	, "src/build/native-c-projection.mjs"
	, "src/build/native-graph-sources.mjs"
	, "src/build/refinement-mirrors.mjs"
	, "tests/component-refinement-mirrors.test.mjs"
	, "tests/fixtures/component-refinement-mirrors/ComponentMirrors.lean"
	, "tests/helpers/component-refinement-mirrors-fixture.mjs"
	, "tests/helpers/component-refinement-mirrors-source-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/native-graph-package.test.mjs"
	, "tests/nested-checked-record-foundation.test.mjs"
	, "tests/type-surface.test.mjs"
];
let history;

/**
 * Reverse one complete transition after checking its path, digests and edits.
 *
 * @param source - Complete current source text.
 * @param update - Exact immutable transition.
 */
export const reverseMutualCheckedRecordUpdate = (source, update) => {
	assert.ok(mutualCheckedRecordChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.ok(Number.isSafeInteger(edit.start) && edit.start >= cursor
			&& edit.start <= source.length);
		assert.equal(typeof edit.previous, "string");
		assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start, edit.start + edit.current.length)
			, edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only this mutual checked-record transition at its exact current identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current source text.
 */
export const withoutMutualCheckedRecord = (path, source) => {
	if(typeof source !== "string"
		|| !mutualCheckedRecordChangedPaths.includes(path)) return source;
	const record = history ??= JSON.parse(readFileSync(
		mutualCheckedRecordHistoryPath, "utf8"
	));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === sha256(source)
		? reverseMutualCheckedRecordUpdate(source, update) : source;
};

/**
 * Reverse this transition, then continue through every older authenticated layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeMutualCheckedRecordSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !mutualCheckedRecordChangedPaths.includes(path))
		return beforeNestedCheckedRecordMatrixClosureSource(path, source, expected);
	if(sha256(source) === expected) return source;
	const previous = withoutMutualCheckedRecord(path, source);
	if(previous !== source) return previous;
	return beforeNestedCheckedRecordMatrixClosureSource(path, source, expected);
};

/**
 * Restore source pins through this transition and every preceding milestone.
 *
 * @param inventory - Current type-surface inventory.
 */
export const beforeMutualCheckedRecordPins = inventory => {
	const previous = structuredClone(inventory);
	const record = history ??= JSON.parse(readFileSync(
		mutualCheckedRecordHistoryPath, "utf8"
	));
	for(const entry of previous.evidence) for(const file of entry.files)
	{
		const update = record.updates.find(item => item.path === file.path);
		if(update && file.sha256 === update.currentSha256)
			file.sha256 = update.previousSha256;
	}
	return beforeNestedCheckedRecordMatrixClosurePins(previous);
};
