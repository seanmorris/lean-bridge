/**
 * Authenticate recursive checked-record native hardening as one reversible source layer.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const mutualCheckedRecordNativeHardeningHistoryPath
	= "docs/evidence/mutual-checked-record-native-hardening-source-history-20261018.json";
export const mutualCheckedRecordNativeHardeningPredecessor
	= "a07cb9086fac597cfe48d53be3ddef3b6cb8c470";
export const mutualCheckedRecordNativeHardeningDraftParent
	= "a07cb9086fac597cfe48d53be3ddef3b6cb8c470";
export const mutualCheckedRecordNativeHardeningChangedPaths = Object.freeze([
	"scripts/archive-mutual-checked-record-native.mjs"
	, "scripts/check-mutual-checked-record-native-ci.mjs"
	, "scripts/run-mutual-checked-record-native-ci.sh"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/mutual-checked-record-native-ci-report.mjs"
	, "tests/helpers/mutual-checked-record-native-ci-tests.mjs"
	, "tests/helpers/mutual-checked-record-native-evidence.mjs"
	, "tests/helpers/mutual-checked-record-native-installed-tests.mjs"
	, "tests/helpers/mutual-checked-record-native-report.mjs"
	, "tests/mutual-checked-record-native-ci.test.mjs"
	, "tests/mutual-checked-records.test.mjs"
]);
export const mutualCheckedRecordNativeHardeningAddedPaths = Object.freeze([
	"scripts/update-mutual-checked-record-native-hardening-source-history.mjs"
	, "tests/helpers/mutual-checked-record-native-controls.mjs"
	, "tests/helpers/mutual-checked-record-native-hardening-source-history.mjs"
	, "tests/helpers/mutual-checked-record-native-hardening-source-history-tests.mjs"
]);
export const mutualCheckedRecordNativeHardeningDeletedPaths = Object.freeze([
	"tests/mutual-checked-record-native-ci.test.mjs"
]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	mutualCheckedRecordNativeHardeningHistoryPath, "utf8"));

/**
 * Reverse one exact native-hardening transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseMutualCheckedRecordNativeHardeningUpdate = (
	source, update
) => {
	assert.ok(mutualCheckedRecordNativeHardeningChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
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
 * Remove only the exact recursive-native hardening layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeMutualCheckedRecordNativeHardeningSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !mutualCheckedRecordNativeHardeningChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseMutualCheckedRecordNativeHardeningUpdate(source, update)
		: source;
};
