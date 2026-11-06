/**
 * Preserve the bounded blob-filter optimization for Performance checkouts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const performanceCheckoutFilterHistoryPath
	= "docs/evidence/performance-checkout-filter-source-history-20261106.json";
export const performanceCheckoutFilterPredecessor
	= "51770fecbfb4a19e085381225557df6427938112";
export const performanceCheckoutFilterImplementation
	= "137b13ad57697f5b7a14c285e85f42f8571c098d";
export const performanceCheckoutFilterPinRefresh
	= "cc718b5ea2990a4a4cc173e7e5cfe92a1eab6aaf";
export const performanceCheckoutFilterCurrentSources = Object.freeze([
	".github/workflows/performance.yml"
	, "tests/performance-reproducibility.test.mjs"
]);
export const performanceCheckoutFilterIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const performanceCheckoutFilterHistoryAdditions = Object.freeze([
	"scripts/update-performance-checkout-filter-source-history.mjs"
	, "tests/helpers/performance-checkout-filter-source-history-tests.mjs"
	, "tests/helpers/performance-checkout-filter-source-history.mjs"
]);
export const performanceCheckoutFilterNormalizationPaths = Object.freeze([
	...new Set([
		...performanceCheckoutFilterCurrentSources
		, ...performanceCheckoutFilterIntegrationPaths
		, "docs/type-surface.v1.json"
	])
].sort());

let history;
const record = () => history ??= JSON.parse(readFileSync(
	performanceCheckoutFilterHistoryPath, "utf8"));

/**
 * Reverse one authenticated source transition.
 *
 * @param source - Complete later source.
 * @param update - Authenticated reversible transition.
 */
export const reversePerformanceCheckoutFilterUpdate = (source, update) => {
	assert.ok(performanceCheckoutFilterNormalizationPaths
		.includes(update.path), update.path);
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
 * Remove integration, pin-refresh and implementation transitions in order.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping SHA-256.
 */
export const beforePerformanceCheckoutFilterSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !performanceCheckoutFilterNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [
		record().integrationUpdates, record().pinUpdates
		, record().implementationUpdates
	]) {
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reversePerformanceCheckoutFilterUpdate(current, update);
	}
	return current;
};
