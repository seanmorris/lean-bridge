/**
 * Preserve the Core static sparse-checkout milestone.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreStaticSparseCheckoutHistoryPath
	= "docs/evidence/core-static-sparse-checkout-source-history-20261026.json";
export const coreStaticSparseCheckoutPredecessor
	= "2aba3c511fa582be26a2063635aa2e1ec5c3fd88";
export const coreStaticSparseCheckoutImplementation
	= "3d68a64365d574a8a19f79e20563616eb465f2d8";
export const coreStaticSparseCheckoutImplementationPaths = Object.freeze([
	".github/workflows/quality.yml"
	, "docs/type-surface.v1.json"
	, "tests/helpers/core-quality-budget-tests.mjs"
]);
export const coreStaticSparseCheckoutIntegrationPaths = Object.freeze([
	"tests/helpers/core-historical-evidence-replay-source-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const coreStaticSparseCheckoutNormalizationPaths = Object.freeze([
	...coreStaticSparseCheckoutImplementationPaths
	, ...coreStaticSparseCheckoutIntegrationPaths
]);
export const coreStaticSparseCheckoutAddedPaths = Object.freeze([
	"scripts/update-core-static-sparse-checkout-source-history.mjs"
	, "tests/helpers/core-static-sparse-checkout-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	coreStaticSparseCheckoutHistoryPath, "utf8"
));

/**
 * Restore one exact, non-overlapping source transition.
 *
 * @param source - Complete current source.
 * @param update - Authenticated transition record.
 */
export const reverseCoreStaticSparseCheckoutUpdate = (source, update) => {
	assert.ok(coreStaticSparseCheckoutNormalizationPaths.includes(update.path));
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
 * Remove only the authenticated Core static sparse-checkout milestone.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeCoreStaticSparseCheckoutSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreStaticSparseCheckoutNormalizationPaths.includes(path))
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
		current = reverseCoreStaticSparseCheckoutUpdate(current, update);
	}
	return current;
};
