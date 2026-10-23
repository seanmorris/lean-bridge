/**
 * Reverse the authenticated C callback checked-record error-contract repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const callbackCheckedRecordNativeErrorRepairHistoryPath
	= "docs/evidence/callback-checked-record-native-error-repair-source-history-20261022.json";
export const callbackCheckedRecordNativeErrorRepairPredecessor
	= "90141cafeea08e6cfd0260a7b2bb15d5bcb78359";
export const callbackCheckedRecordNativeErrorRepairImplementation
	= "b51d39171aedc534eee6ee6479b866501c8d0d45";
export const callbackCheckedRecordNativeErrorRepairHistoricalPaths
	= Object.freeze([
		"src/backends/c/callable-graph-package.mjs"
		, "tests/callback-checked-record-native-ci.test.mjs"
		, "tests/callback-checked-record-native.test.mjs"
		, "tests/helpers/callback-checked-record-native-ci.mjs"
	]);
export const callbackCheckedRecordNativeErrorRepairRegistrationPaths
	= Object.freeze([
		"docs/type-surface.v1.json"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const callbackCheckedRecordNativeErrorRepairChangedPaths
	= Object.freeze([
		...callbackCheckedRecordNativeErrorRepairRegistrationPaths
		, ...callbackCheckedRecordNativeErrorRepairHistoricalPaths
	]);
export const callbackCheckedRecordNativeErrorRepairAddedPaths
	= Object.freeze([
		"scripts/update-callback-checked-record-native-error-repair-source-history.mjs"
		, "tests/helpers/callback-checked-record-native-error-repair-source-history.mjs"
		, "tests/helpers/callback-checked-record-native-error-repair-source-history-tests.mjs"
	]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	callbackCheckedRecordNativeErrorRepairHistoryPath, "utf8"
));

/**
 * Restore one complete update after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseCallbackCheckedRecordNativeErrorRepairUpdate = (
	source, update
) => {
	assert.ok(callbackCheckedRecordNativeErrorRepairChangedPaths.includes(
		update.path
	));
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
 * Remove only the exact C callback error-contract repair layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCallbackCheckedRecordNativeErrorRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !callbackCheckedRecordNativeErrorRepairChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item =>
		item.path === path && item.currentSha256 === digest
	);
	return update
		? reverseCallbackCheckedRecordNativeErrorRepairUpdate(source, update)
		: source;
};
