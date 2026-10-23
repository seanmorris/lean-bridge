/**
 * Reverse the exact Core first-run source-pin replay repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreFirstRunPinReplayRepairHistoryPath
	= "docs/evidence/core-first-run-pin-replay-repair-source-history-20261023.json";
export const coreFirstRunPinReplayRepairPredecessor
	= "e0c582f64143a47a80548cd949909a5047f712a0";
export const coreFirstRunPinReplayRepairImplementation
	= "b50d2504ee19f7ec438a1550aa7d99740723d90d";
export const coreFirstRunPinReplayRepairChangedPaths = Object.freeze([
	"tests/helpers/core-first-run-repair-source-history-tests.mjs"
]);
export const coreFirstRunPinReplayRepairIntegrationPaths = Object.freeze([
	"tests/component-array-contract.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const coreFirstRunPinReplayRepairNormalizationPaths = Object.freeze([
	...coreFirstRunPinReplayRepairChangedPaths
	, ...coreFirstRunPinReplayRepairIntegrationPaths
]);
export const coreFirstRunPinReplayRepairAddedPaths = Object.freeze([
	"scripts/update-core-first-run-pin-replay-repair-source-history.mjs"
	, "tests/helpers/core-first-run-pin-replay-repair-source-history-tests.mjs"
	, "tests/helpers/core-first-run-pin-replay-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	coreFirstRunPinReplayRepairHistoryPath, "utf8"
));

/**
 * Restore one exact source transition after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseCoreFirstRunPinReplayRepairUpdate = (source, update) => {
	assert.ok(coreFirstRunPinReplayRepairNormalizationPaths
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
 * Remove only the exact Core first-run source-pin replay repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCoreFirstRunPinReplayRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreFirstRunPinReplayRepairNormalizationPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = [...value.integrationUpdates, ...value.updates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reverseCoreFirstRunPinReplayRepairUpdate(source, update)
		: source;
};
