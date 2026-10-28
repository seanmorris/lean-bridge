/**
 * Preserve the live-pin repair after registering the Core runtime-budget
 * history in the component contract.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreRuntimeBudgetLivePinRepairHistoryPath
	= "docs/evidence/core-runtime-budget-live-pin-repair-source-history-20261026.json";
export const coreRuntimeBudgetLivePinRepairPredecessor
	= "6f93b3f19f9a17107ca5aa4ad753b17de0b390b3";
export const coreRuntimeBudgetLivePinRepairImplementation
	= "31730530ddba198417dd1f75c8e0074f007b061d";
export const coreRuntimeBudgetLivePinRepairImplementationPaths
	= Object.freeze([
		"docs/type-surface.v1.json"
	]);
export const coreRuntimeBudgetLivePinRepairIntegrationPaths = Object.freeze([
	"tests/helpers/core-historical-evidence-replay-source-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const coreRuntimeBudgetLivePinRepairNormalizationPaths = Object.freeze([
	...coreRuntimeBudgetLivePinRepairImplementationPaths
	, ...coreRuntimeBudgetLivePinRepairIntegrationPaths
]);
export const coreRuntimeBudgetLivePinRepairAddedPaths = Object.freeze([
	"scripts/update-core-runtime-budget-live-pin-repair-source-history.mjs"
	, "tests/helpers/core-runtime-budget-live-pin-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	coreRuntimeBudgetLivePinRepairHistoryPath, "utf8"
));

/**
 * Restore one exact, non-overlapping source transition.
 *
 * @param source - Complete current source.
 * @param update - Authenticated transition record.
 */
export const reverseCoreRuntimeBudgetLivePinRepairUpdate = (
	source, update
) => {
	assert.ok(coreRuntimeBudgetLivePinRepairNormalizationPaths.includes(
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
			, edit.start + edit.current.length), edit.current, update.path);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only the authenticated runtime-budget live-pin repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeCoreRuntimeBudgetLivePinRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreRuntimeBudgetLivePinRepairNormalizationPaths.includes(path))
		return source;
	const value = record();
	const updates = [...value.integrationUpdates, ...value.updates];
	let current = source;
	for(let count = 0; count < updates.length; ++count)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseCoreRuntimeBudgetLivePinRepairUpdate(current, update);
	}
	return current;
};
