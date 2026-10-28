/**
 * Preserve the Core historical-addition checkout repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreHistoricalAdditionCheckoutRepairHistoryPath
	= "docs/evidence/core-historical-addition-checkout-repair-source-history-20261027.json";
export const coreHistoricalAdditionCheckoutRepairPredecessor
	= "3c8260b75411fe0e2375e4a43df7eaabf92a80d5";
export const coreHistoricalAdditionCheckoutRepairImplementation
	= "a715e39cd9337a8eb3fd2d740425e2be6306c3ed";
export const coreHistoricalAdditionCheckoutRepairImplementationPaths
	= Object.freeze([
		"scripts/core-contract-evidence.mjs"
		, "tests/helpers/core-contract-evidence-tests.mjs"
	]);
export const coreHistoricalAdditionCheckoutRepairIntegrationPaths
	= Object.freeze([
		"tests/helpers/core-historical-evidence-replay-source-history-tests.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const coreHistoricalAdditionCheckoutRepairNormalizationPaths
	= Object.freeze([
		...coreHistoricalAdditionCheckoutRepairImplementationPaths
		, ...coreHistoricalAdditionCheckoutRepairIntegrationPaths
	]);
export const coreHistoricalAdditionCheckoutRepairAddedPaths = Object.freeze([
	"scripts/update-core-historical-addition-checkout-repair-source-history.mjs"
	, "tests/helpers/core-historical-addition-checkout-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	coreHistoricalAdditionCheckoutRepairHistoryPath, "utf8"
));

/**
 * Restore one exact, authenticated source transition.
 *
 * @param source - Complete current source.
 * @param update - Authenticated transition record.
 */
export const reverseCoreHistoricalAdditionCheckoutRepairUpdate = (
	source, update
) => {
	assert.ok(coreHistoricalAdditionCheckoutRepairNormalizationPaths.includes(
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
 * Remove only the authenticated historical-addition checkout repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeCoreHistoricalAdditionCheckoutRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreHistoricalAdditionCheckoutRepairNormalizationPaths.includes(path))
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
		current = reverseCoreHistoricalAdditionCheckoutRepairUpdate(
			current, update
		);
	}
	return current;
};
