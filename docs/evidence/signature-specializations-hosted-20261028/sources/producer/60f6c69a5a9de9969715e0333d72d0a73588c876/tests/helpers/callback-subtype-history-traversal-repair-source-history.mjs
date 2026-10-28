/**
 * Reverse the exact callback-Subtype history traversal repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const callbackSubtypeHistoryTraversalRepairHistoryPath
	= "docs/evidence/callback-subtype-history-traversal-repair-source-history-20261023.json";
export const callbackSubtypeHistoryTraversalRepairPredecessor
	= "a0e845cf59b3a7fb7a88706c891fcb0d03d88f6a";
export const callbackSubtypeHistoryTraversalRepairImplementation
	= "e3917721921830895c74cf958a7dd2a2b59b398e";
export const callbackSubtypeHistoryTraversalRepairImplementationPaths
	= Object.freeze([
		"tests/helpers/callback-subtype-promotion-source-history.mjs"
		, "tests/helpers/callback-subtype-promotion-source-history-tests.mjs"
	]);
export const callbackSubtypeHistoryTraversalRepairIntegrationPaths
	= Object.freeze([
		"tests/helpers/fin-refinement-source-history.mjs"
		, "tests/php-wasm-fin.test.mjs"
	]);
export const callbackSubtypeHistoryTraversalRepairChangedPaths = Object.freeze([
	...callbackSubtypeHistoryTraversalRepairImplementationPaths
	, ...callbackSubtypeHistoryTraversalRepairIntegrationPaths
]);
export const callbackSubtypeHistoryTraversalRepairAddedPaths = Object.freeze([
	"scripts/update-callback-subtype-history-traversal-repair-source-history.mjs"
	, "tests/helpers/callback-subtype-history-traversal-repair-source-history-tests.mjs"
	, "tests/helpers/callback-subtype-history-traversal-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	callbackSubtypeHistoryTraversalRepairHistoryPath, "utf8"));

/**
 * Restore one exact authenticated transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseCallbackSubtypeHistoryTraversalRepairUpdate = (
	source, update
) => {
	assert.ok(callbackSubtypeHistoryTraversalRepairChangedPaths
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
 * Remove only the callback-Subtype history traversal repair layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCallbackSubtypeHistoryTraversalRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !callbackSubtypeHistoryTraversalRepairChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const data = record();
	const update = [...data.updates, ...data.integrationUpdates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reverseCallbackSubtypeHistoryTraversalRepairUpdate(source, update)
		: source;
};
