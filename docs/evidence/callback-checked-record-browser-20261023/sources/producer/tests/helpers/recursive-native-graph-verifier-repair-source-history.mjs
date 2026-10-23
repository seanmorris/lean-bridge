/**
 * Authenticate the graph-aware recursive C/C++ package verifier repair after
 * the hosted selector correction.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const recursiveNativeGraphVerifierRepairHistoryPath
	= "docs/evidence/recursive-native-graph-verifier-repair-source-history-20261018.json";
export const recursiveNativeGraphVerifierRepairPredecessor
	= "0f09e410778a0097bd17129568fe619db9c079ad";
export const recursiveNativeGraphVerifierRepairDraftParent
	= "0f09e410778a0097bd17129568fe619db9c079ad";
export const recursiveNativeGraphVerifierRepairChangedPaths = Object.freeze([
	"tests/helpers/checked-javascript-disposition-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/mutual-checked-record-native-ci-tests.mjs"
	, "tests/helpers/mutual-checked-record-native-report.mjs"
	, "tests/helpers/nominal-primitive-subtype-native-generators.mjs"
]);
export const recursiveNativeGraphVerifierRepairAddedPaths = Object.freeze([
	"scripts/update-recursive-native-graph-verifier-repair-history.mjs"
	, "tests/helpers/recursive-native-graph-verifier-repair-source-history.mjs"
]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	recursiveNativeGraphVerifierRepairHistoryPath, "utf8"
));

/**
 * Reverse one exact recursive native graph-verifier repair transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseRecursiveNativeGraphVerifierRepairUpdate = (
	source, update
) => {
	assert.ok(recursiveNativeGraphVerifierRepairChangedPaths.includes(
		update.path));
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
 * Remove only this exact recursive native graph-verifier repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeRecursiveNativeGraphVerifierRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !recursiveNativeGraphVerifierRepairChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseRecursiveNativeGraphVerifierRepairUpdate(source, update)
		: source;
};
