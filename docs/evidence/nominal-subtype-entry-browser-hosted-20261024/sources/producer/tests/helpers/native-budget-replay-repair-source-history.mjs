/**
 * Reverse the exact-history native-budget replay repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const nativeBudgetReplayRepairHistoryPath
	= "docs/evidence/native-budget-replay-repair-source-history-20261023.json";
export const nativeBudgetReplayRepairPredecessor
	= "b5570523e9116c8bb52b89892a2dbb727a6c1849";
export const nativeBudgetReplayRepairImplementation
	= "2fc30ac89bc5178360e0a5890cea7d4c059d82a1";
export const nativeBudgetReplayRepairChangedPaths = Object.freeze([
	"tests/helpers/native-consumer-budget-tests.mjs"
]);
export const nativeBudgetReplayRepairIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/native-ci-isolation.test.mjs"
]);
export const nativeBudgetReplayRepairNormalizationPaths = Object.freeze([
	...nativeBudgetReplayRepairChangedPaths
	, ...nativeBudgetReplayRepairIntegrationPaths
]);
export const nativeBudgetReplayRepairAddedPaths = Object.freeze([
	"scripts/update-native-budget-replay-repair-source-history.mjs"
	, "tests/helpers/native-budget-replay-repair-source-history-tests.mjs"
	, "tests/helpers/native-budget-replay-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	nativeBudgetReplayRepairHistoryPath, "utf8"
));

/**
 * Restore one exact source transition after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseNativeBudgetReplayRepairUpdate = (source, update) => {
	assert.ok(nativeBudgetReplayRepairNormalizationPaths.includes(update.path));
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
 * Remove only the exact native-budget replay repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeNativeBudgetReplayRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !nativeBudgetReplayRepairNormalizationPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = [...value.integrationUpdates, ...value.updates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update ? reverseNativeBudgetReplayRepairUpdate(source, update) : source;
};
