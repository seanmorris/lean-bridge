/**
 * Reverse the callback Subtype evidence-review repair transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const callbackSubtypeReviewRepairHistoryPath
	= "docs/evidence/callback-subtype-review-repair-source-history-20261022.json";
export const callbackSubtypeReviewRepairPredecessor
	= "583415c670087eb6a2433518ff2ddce049fb6fc5";
export const callbackSubtypeReviewRepairImplementation
	= "3eb6a6976f8e0da61fed1ed370cefbc0f08f94a7";
export const callbackSubtypeReviewRepairImplementationPaths = Object.freeze([
	"scripts/archive-callback-subtype-evidence.mjs"
	, "tests/callback-subtype-hosted-archive.test.mjs"
	, "tests/callback-subtype-hosted-evidence.test.mjs"
	, "tests/callback-subtype-promotion.test.mjs"
	, "tests/helpers/callback-subtype-hosted-evidence-sources.mjs"
	, "tests/helpers/callback-subtype-hosted-evidence.mjs"
	, "tests/helpers/callback-subtype-promotion.mjs"
]);
export const callbackSubtypeReviewRepairModifiedPaths = Object.freeze([
	"scripts/archive-callback-subtype-evidence.mjs"
	, "tests/callback-subtype-hosted-archive.test.mjs"
	, "tests/callback-subtype-promotion.test.mjs"
	, "tests/helpers/callback-subtype-hosted-evidence-sources.mjs"
	, "tests/helpers/callback-subtype-hosted-evidence.mjs"
	, "tests/helpers/callback-subtype-promotion.mjs"
]);
export const callbackSubtypeReviewRepairIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/php-wasm-fin.test.mjs"
]);
export const callbackSubtypeReviewRepairChangedPaths = Object.freeze([
	...callbackSubtypeReviewRepairModifiedPaths
	, ...callbackSubtypeReviewRepairIntegrationPaths
]);
export const callbackSubtypeReviewRepairAddedPaths = Object.freeze([
	"scripts/update-callback-subtype-review-repair-source-history.mjs"
	, "tests/callback-subtype-hosted-evidence.test.mjs"
	, "tests/helpers/callback-subtype-review-repair-source-history-tests.mjs"
	, "tests/helpers/callback-subtype-review-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	callbackSubtypeReviewRepairHistoryPath, "utf8"));

/**
 * Restore one exact source transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseCallbackSubtypeReviewRepairUpdate = (source, update) => {
	assert.ok(callbackSubtypeReviewRepairChangedPaths.includes(update.path));
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
 * Remove only the exact callback Subtype review repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCallbackSubtypeReviewRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !callbackSubtypeReviewRepairChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const data = record();
	const update = [...data.updates, ...data.integrationUpdates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reverseCallbackSubtypeReviewRepairUpdate(source, update)
		: source;
};
