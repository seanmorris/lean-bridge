/**
 * Reverse the dependent-record constructor-authority replay repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const dependentRecordAuthorityReplayRepairHistoryPath
	= "docs/evidence/dependent-record-authority-replay-repair-source-history-20261023.json";
export const dependentRecordAuthorityReplayRepairPredecessor
	= "6b786277d9c9c50be21a43efc42204c76e11d22f";
export const dependentRecordAuthorityReplayRepairImplementation
	= "4caae9c2c98203b6235ec30c57f6b5f7b8846461";
export const dependentRecordAuthorityReplayRepairChangedPaths = Object.freeze([
	"tests/helpers/dependent-record-constructor-authority-source-history-tests.mjs"
]);
export const dependentRecordAuthorityReplayRepairIntegrationPaths
	= Object.freeze([
		"tests/component-array-contract.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const dependentRecordAuthorityReplayRepairNormalizationPaths
	= Object.freeze([
		...dependentRecordAuthorityReplayRepairChangedPaths
		, ...dependentRecordAuthorityReplayRepairIntegrationPaths
	]);
export const dependentRecordAuthorityReplayRepairAddedPaths = Object.freeze([
	"scripts/update-dependent-record-authority-replay-repair-source-history.mjs"
	, "tests/helpers/dependent-record-authority-replay-repair-source-history-tests.mjs"
	, "tests/helpers/dependent-record-authority-replay-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	dependentRecordAuthorityReplayRepairHistoryPath, "utf8"
));

/**
 * Restore one exact source transition after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseDependentRecordAuthorityReplayRepairUpdate = (
	source, update
) => {
	assert.ok(dependentRecordAuthorityReplayRepairNormalizationPaths
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
 * Remove only the exact constructor-authority replay repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeDependentRecordAuthorityReplayRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !dependentRecordAuthorityReplayRepairNormalizationPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = [...value.integrationUpdates, ...value.updates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reverseDependentRecordAuthorityReplayRepairUpdate(source, update)
		: source;
};
