/**
 * Authenticate the measured Core shard runtime-budget repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreContractRuntimeBudgetHistoryPath
	= "docs/evidence/core-contract-runtime-budget-source-history-20261026.json";
export const coreContractRuntimeBudgetPredecessor
	= "36aebfedc3fa0991e35a84a6c212d564e153ce33";
export const coreContractRuntimeBudgetImplementation
	= "fe4c631bae8e7cf3047b62aaa6434df98aaf1e53";
export const coreContractRuntimeBudgetImplementationPaths = Object.freeze([
	".github/workflows/quality.yml"
	, "docs/type-surface.v1.json"
	, "tests/helpers/core-quality-budget-tests.mjs"
]);
export const coreContractRuntimeBudgetIntegrationPaths = Object.freeze([
	"tests/component-array-contract.test.mjs"
	, "tests/helpers/core-historical-evidence-replay-source-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const coreContractRuntimeBudgetNormalizationPaths = Object.freeze([
	...coreContractRuntimeBudgetImplementationPaths
	, ...coreContractRuntimeBudgetIntegrationPaths
]);
export const coreContractRuntimeBudgetAddedPaths = Object.freeze([
	"scripts/update-core-contract-runtime-budget-source-history.mjs"
	, "tests/helpers/core-contract-runtime-budget-source-history-tests.mjs"
	, "tests/helpers/core-contract-runtime-budget-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	coreContractRuntimeBudgetHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseCoreContractRuntimeBudgetUpdate = (source, update) => {
	assert.ok(coreContractRuntimeBudgetNormalizationPaths.includes(update.path));
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
 * Remove only the authenticated Core shard runtime-budget repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeCoreContractRuntimeBudgetSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreContractRuntimeBudgetNormalizationPaths.includes(path))
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
		current = reverseCoreContractRuntimeBudgetUpdate(current, update);
	}
	return current;
};
