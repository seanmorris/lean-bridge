/**
 * Authenticate the escaped C/C++ test selector repair after the callback Fin
 * gate review.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const recursiveNativeSelectorRepairHistoryPath
	= "docs/evidence/recursive-native-selector-repair-source-history-20261018.json";
export const recursiveNativeSelectorRepairPredecessor
	= "378095ebf5bb66c944f3785de16c77882cd1fe4f";
export const recursiveNativeSelectorRepairDraftParent
	= "378095ebf5bb66c944f3785de16c77882cd1fe4f";
export const recursiveNativeSelectorRepairChangedPaths = Object.freeze([
	"scripts/run-mutual-checked-record-native-ci.sh"
	, "tests/helpers/checked-javascript-disposition-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/mutual-checked-record-native-ci-tests.mjs"
]);
export const recursiveNativeSelectorRepairAddedPaths = Object.freeze([
	"scripts/update-recursive-native-selector-repair-history.mjs"
	, "tests/helpers/recursive-native-selector-repair-source-history.mjs"
]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	recursiveNativeSelectorRepairHistoryPath, "utf8"
));

/**
 * Reverse one exact recursive native selector repair transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseRecursiveNativeSelectorRepairUpdate = (source, update) => {
	assert.ok(recursiveNativeSelectorRepairChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256);
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
	assert.equal(sha256(previous), update.previousSha256);
	return previous;
};

/**
 * Remove only this exact hosted selector repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeRecursiveNativeSelectorRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !recursiveNativeSelectorRepairChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseRecursiveNativeSelectorRepairUpdate(source, update)
		: source;
};
