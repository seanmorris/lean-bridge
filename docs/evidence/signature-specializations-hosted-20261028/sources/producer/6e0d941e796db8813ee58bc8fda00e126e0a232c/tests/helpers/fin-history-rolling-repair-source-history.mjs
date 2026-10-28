/**
 * Reverse the explicit Fin history rolling repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const finHistoryRollingRepairHistoryPath
	= "docs/evidence/fin-history-rolling-repair-source-history-20261024.json";
export const finHistoryRollingRepairPredecessor
	= "21d0dfc7f0e487ca6937d450eed5b33198b00366";
export const finHistoryRollingRepairImplementation
	= "9ce78fcac3dfff304fae9b284c2259a9b3a3c7be";
export const finHistoryRollingRepairIntegrationBase
	= "63e7041b4c18cd6891873cf5975c3e500a42f938";
export const finHistoryRollingRepairChangedPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
]);
export const finHistoryRollingRepairIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const finHistoryRollingRepairNormalizationPaths = Object.freeze([
	...finHistoryRollingRepairChangedPaths
	, ...finHistoryRollingRepairIntegrationPaths
]);
export const finHistoryRollingRepairAddedPaths = Object.freeze([
	"scripts/update-fin-history-rolling-repair-source-history.mjs"
	, "tests/helpers/fin-history-rolling-repair-source-history-tests.mjs"
	, "tests/helpers/fin-history-rolling-repair-source-history.mjs"
	, "tests/helpers/fin-history-rolling-stage-tests.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	finHistoryRollingRepairHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseFinHistoryRollingRepairUpdate = (
	source, update
) => {
	assert.ok(finHistoryRollingRepairNormalizationPaths
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
 * Remove only the exact Fin history rolling repair.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeFinHistoryRollingRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !finHistoryRollingRepairNormalizationPaths.includes(path))
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
		current = reverseFinHistoryRollingRepairUpdate(current, update);
	}
	return current;
};
