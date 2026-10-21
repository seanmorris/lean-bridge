/**
 * Authenticate the native/.NET value-index verifier repair as one exact,
 * reversible source layer.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const checkedRecordValueIndexNativeDotnetVerifierRepairHistoryPath
	= "docs/evidence/checked-record-value-index-native-dotnet-verifier-repair-source-history-20261018.json";
export const checkedRecordValueIndexNativeDotnetVerifierRepairPredecessor
	= "029cc8e12af2adaddd9afa35dab09542ac4f431a";
export const checkedRecordValueIndexNativeDotnetVerifierRepairDraftParent
	= "4cc7834c5a7060fbdf9aaaa844850bf14b282ce9";
export const checkedRecordValueIndexNativeDotnetVerifierRepairFoundationPaths
	= Object.freeze([
		"tests/helpers/checked-record-value-index-dotnet-controls.mjs"
		, "tests/helpers/checked-record-value-index-native-controls.mjs"
		, "tests/helpers/checked-record-value-index-native-report.mjs"
	]);
export const checkedRecordValueIndexNativeDotnetVerifierRepairAddedPaths
	= Object.freeze([
		"scripts/update-checked-record-value-index-native-dotnet-verifier-repair-source-history.mjs"
		, "tests/helpers/checked-record-value-index-native-dotnet-verifier-repair-source-history-tests.mjs"
		, "tests/helpers/checked-record-value-index-native-dotnet-verifier-repair-source-history.mjs"
	]);
export const checkedRecordValueIndexNativeDotnetVerifierRepairChangedPaths
	= Object.freeze([
		"docs/type-surface.v1.json"
		, "tests/component-array-contract.test.mjs"
		, ...checkedRecordValueIndexNativeDotnetVerifierRepairFoundationPaths
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	checkedRecordValueIndexNativeDotnetVerifierRepairHistoryPath, "utf8"
));

/**
 * Reverse one exact native/.NET verifier transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseCheckedRecordValueIndexNativeDotnetVerifierRepairUpdate = (
	source, update
) => {
	assert.ok(checkedRecordValueIndexNativeDotnetVerifierRepairChangedPaths
		.includes(update.path));
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
 * Remove only the exact native/.NET value-index verifier repair layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCheckedRecordValueIndexNativeDotnetVerifierRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !checkedRecordValueIndexNativeDotnetVerifierRepairChangedPaths
			.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseCheckedRecordValueIndexNativeDotnetVerifierRepairUpdate(
			source, update)
		: source;
};
