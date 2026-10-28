/**
 * Authenticate the Core aggregate sparse checkout.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreAggregateSparseCheckoutHistoryPath
	= "docs/evidence/core-aggregate-sparse-checkout-source-history-20261025.json";
export const coreAggregateSparseCheckoutPredecessor
	= "c9c6435b7616807cfa9c97280bd9a49848b810dc";
export const coreAggregateSparseCheckoutImplementation
	= "df8bf8e05351e52eacf922bad46511dd292a63d7";
export const coreAggregateSparseCheckoutIntegrationBase
	= "df8bf8e05351e52eacf922bad46511dd292a63d7";
export const coreAggregateSparseCheckoutCommits = Object.freeze([
	"df8bf8e05351e52eacf922bad46511dd292a63d7"
]);
export const coreAggregateSparseCheckoutChangedPaths = Object.freeze([
	".github/workflows/quality.yml"
	, "tests/helpers/core-quality-budget-tests.mjs"
	, "docs/type-surface.v1.json"
]);
export const coreAggregateSparseCheckoutImplementationAddedPaths = Object.freeze([
	"docs/evidence/core-aggregate-sparse-checkout-20261025/acceptance.json"
	, "docs/evidence/core-aggregate-sparse-checkout-20261025/diagnostics.json"
	, "docs/evidence/core-aggregate-sparse-checkout-20261025/pin-audit.json"
	, "docs/evidence/core-aggregate-sparse-checkout-20261025/pin-audit.mjs"
	, "docs/evidence/core-aggregate-sparse-checkout-20261025/reproduction.tap"
	, "docs/evidence/core-aggregate-sparse-checkout-20261025/run.tap"
]);
export const coreAggregateSparseCheckoutImplementationPaths = Object.freeze([
	...coreAggregateSparseCheckoutChangedPaths
	, ...coreAggregateSparseCheckoutImplementationAddedPaths
]);
export const coreAggregateSparseCheckoutIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const coreAggregateSparseCheckoutNormalizationPaths = Object.freeze([
	...coreAggregateSparseCheckoutChangedPaths
	, ...coreAggregateSparseCheckoutIntegrationPaths
]);
export const coreAggregateSparseCheckoutHistoryAddedPaths = Object.freeze([
	"scripts/update-core-aggregate-sparse-checkout-source-history.mjs"
	, "tests/helpers/core-aggregate-sparse-checkout-source-history-tests.mjs"
	, "tests/helpers/core-aggregate-sparse-checkout-source-history.mjs"
]);
export const coreAggregateSparseCheckoutAddedPaths = Object.freeze([
	...coreAggregateSparseCheckoutImplementationAddedPaths
	, ...coreAggregateSparseCheckoutHistoryAddedPaths
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	coreAggregateSparseCheckoutHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseCoreAggregateSparseCheckoutUpdate = (
	source, update
) => {
	assert.ok(coreAggregateSparseCheckoutNormalizationPaths
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
 * Remove only the exact Core aggregate sparse checkout.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeCoreAggregateSparseCheckoutSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreAggregateSparseCheckoutNormalizationPaths.includes(path))
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
		current = reverseCoreAggregateSparseCheckoutUpdate(current, update);
	}
	return current;
};
