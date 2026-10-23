/**
 * Reverse the structured-callback public-fallback repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const structuredCallbackPublicFallbackRepairHistoryPath
	= "docs/evidence/structured-callback-public-fallback-repair-source-history-20261023.json";
export const structuredCallbackPublicFallbackRepairPredecessor
	= "e7d2c268684889dca3c1dae480584a03082c9380";
export const structuredCallbackPublicFallbackRepairImplementation
	= "a9fbf709ce2d5689e913021e8737d36c4214ead9";
export const structuredCallbackPublicFallbackRepairChangedPaths = Object.freeze([
	"src/build/component-structured-callable-lean.mjs"
	, "tests/component-structured-callable-contract.test.mjs"
]);
export const structuredCallbackPublicFallbackRepairIntegrationPaths
	= Object.freeze([
		"tests/component-array-contract.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const structuredCallbackPublicFallbackRepairNormalizationPaths
	= Object.freeze([
		...structuredCallbackPublicFallbackRepairChangedPaths
		, ...structuredCallbackPublicFallbackRepairIntegrationPaths
	]);
export const structuredCallbackPublicFallbackRepairAddedPaths = Object.freeze([
	"scripts/update-structured-callback-public-fallback-repair-source-history.mjs"
	, "tests/helpers/structured-callback-public-fallback-repair-source-history-tests.mjs"
	, "tests/helpers/structured-callback-public-fallback-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	structuredCallbackPublicFallbackRepairHistoryPath, "utf8"
));

/**
 * Reverse one exact structured-callback fallback transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseStructuredCallbackPublicFallbackRepairUpdate = (
	source, update
) => {
	assert.ok(structuredCallbackPublicFallbackRepairNormalizationPaths
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
 * Remove only the exact structured-callback fallback repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeStructuredCallbackPublicFallbackRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !structuredCallbackPublicFallbackRepairNormalizationPaths
			.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = [...value.integrationUpdates, ...value.updates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reverseStructuredCallbackPublicFallbackRepairUpdate(source, update)
		: source;
};
