/**
 * Reverse the explicit Core milestone replay repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreMilestoneReplayRepairHistoryPath
	= "docs/evidence/core-milestone-replay-repair-source-history-20261024.json";
export const coreMilestoneReplayRepairPredecessor
	= "31a51782926e2bd37c5812d063e5f4c8e7b55852";
export const coreMilestoneReplayRepairImplementation
	= "4f7529762dbc3b18bd7fb3928cd2d2c5b1852f87";
export const coreMilestoneReplayRepairIntegrationBase
	= "4f7529762dbc3b18bd7fb3928cd2d2c5b1852f87";
export const coreMilestoneReplayRepairChangedPaths = Object.freeze([
	"scripts/generate-type-docs.mjs"
	, "tests/callback-subtype-promotion.test.mjs"
	, "tests/helpers/php-wasm-recursive-evidence-replay-repair-source-history-tests.mjs"
	, "tests/helpers/php-wasm-recursive-evidence-replay-repair-source-history.mjs"
]);
export const coreMilestoneReplayRepairIntegrationPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/php-wasm-recursive-evidence-replay-repair-source-history-tests.mjs"
]);
export const coreMilestoneReplayRepairNormalizationPaths = Object.freeze([
	...coreMilestoneReplayRepairChangedPaths
	, ...coreMilestoneReplayRepairIntegrationPaths
]);
export const coreMilestoneReplayRepairAddedPaths = Object.freeze([
	"scripts/update-core-milestone-replay-repair-source-history.mjs"
	, "tests/helpers/core-milestone-replay-repair-source-history-tests.mjs"
	, "tests/helpers/core-milestone-replay-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	coreMilestoneReplayRepairHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseCoreMilestoneReplayRepairUpdate = (
	source, update
) => {
	assert.ok(coreMilestoneReplayRepairNormalizationPaths
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
 * Remove only the exact Core milestone replay repair.
 * Without a requested stop, unwind both stages of this one repair; its test
 * registration also changes an implementation file during integration.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeCoreMilestoneReplayRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreMilestoneReplayRepairNormalizationPaths.includes(path))
		return source;
	const value = record();
	const updates = [...value.integrationUpdates, ...value.updates];
	let current = source;
	for(let count = 0; count < updates.length; count++)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseCoreMilestoneReplayRepairUpdate(current, update);
	}
	return current;
};
