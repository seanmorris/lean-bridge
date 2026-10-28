/**
 * Preserve the exact shared-object sparse performance checkouts, their workflow pin refresh and their central
 * history registration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const performanceReproducibilityCheckoutHistoryPath
	= "docs/evidence/performance-reproducibility-checkout-source-history-20261028.json";
export const performanceReproducibilityCheckoutPredecessor
	= "c9b2b9fff8867dc16c98e82386865975048d7a12";
export const performanceReproducibilityCheckoutImplementation
	= "9a055a3a9096c2418139fbe332e0978c8c7526f3";
export const performanceReproducibilityCheckoutWorkflowCommit
	= "aaebc1052552858f38a237003c6fffb489f381e6";
export const performanceReproducibilityCheckoutCommits = Object.freeze([
	performanceReproducibilityCheckoutWorkflowCommit
	, performanceReproducibilityCheckoutImplementation
]);
export const performanceReproducibilityCheckoutTypeSurfacePath = "docs/type-surface.v1.json";
export const performanceReproducibilityCheckoutPinCount = 1;
export const performanceReproducibilityCheckoutWorkflowPath = ".github/workflows/performance.yml";
export const performanceReproducibilityCheckoutScriptPath
	= "scripts/check-performance-build-reproducibility.sh";
export const performanceReproducibilityCheckoutTestPath = "tests/performance-reproducibility.test.mjs";
export const performanceReproducibilityCheckoutPinnedPaths = Object.freeze([
	performanceReproducibilityCheckoutWorkflowPath
]);
export const performanceReproducibilityCheckoutSourcePaths = Object.freeze([
	performanceReproducibilityCheckoutWorkflowPath
	, performanceReproducibilityCheckoutScriptPath
	, performanceReproducibilityCheckoutTestPath
]);
export const performanceReproducibilityCheckoutImplementationPaths = Object.freeze([
	performanceReproducibilityCheckoutWorkflowPath
	, performanceReproducibilityCheckoutTypeSurfacePath
	, performanceReproducibilityCheckoutScriptPath
	, performanceReproducibilityCheckoutTestPath
]);
export const performanceReproducibilityCheckoutIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const performanceReproducibilityCheckoutNormalizationPaths = Object.freeze([
	...performanceReproducibilityCheckoutImplementationPaths
	, ...performanceReproducibilityCheckoutIntegrationPaths
]);
export const performanceReproducibilityCheckoutAddedPaths = Object.freeze([
	"scripts/update-performance-reproducibility-checkout-source-history.mjs"
	, "tests/helpers/performance-reproducibility-checkout-source-history-tests.mjs"
	, "tests/helpers/performance-reproducibility-checkout-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	performanceReproducibilityCheckoutHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated source transition.
 *
 * @param source - Complete current source.
 * @param update - Path, both digests and the current-side edits of one change.
 */
export const reversePerformanceReproducibilityCheckoutUpdate = (source, update) => {
	assert.ok(performanceReproducibilityCheckoutNormalizationPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
		assert.equal(typeof edit.previous, "string");
		assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start, edit.start + edit.current.length)
			, edit.current, update.path);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only the recognized checkout repair and its registration.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforePerformanceReproducibilityCheckoutSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !performanceReproducibilityCheckoutNormalizationPaths.includes(path))
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
		current = reversePerformanceReproducibilityCheckoutUpdate(current, update);
	}
	return current;
};
