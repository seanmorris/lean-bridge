/**
 * Reverse the callback Subtype documentation review repair transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const callbackSubtypeDocumentationReviewRepairHistoryPath
	= "docs/evidence/callback-subtype-documentation-review-repair-source-history-20261022.json";
export const callbackSubtypeDocumentationReviewRepairPredecessor
	= "e35f6c0b7c7915b8b74b6c6f1ad1abe6457b3c15";
export const callbackSubtypeDocumentationReviewRepairImplementation
	= "cde076a384b75212696ee2c94a80e96da69e60d9";
export const callbackSubtypeDocumentationReviewRepairImplementationPaths
	= Object.freeze([
		"scripts/promote-callback-subtype-evidence.mjs"
		, "tests/callback-subtype-promotion.test.mjs"
		, "tests/helpers/callback-subtype-documentation.mjs"
	]);
export const callbackSubtypeDocumentationReviewRepairModifiedPaths
	= callbackSubtypeDocumentationReviewRepairImplementationPaths;
export const callbackSubtypeDocumentationReviewRepairIntegrationPaths
	= Object.freeze([
		"tests/helpers/fin-refinement-source-history.mjs"
		, "tests/php-wasm-fin.test.mjs"
	]);
export const callbackSubtypeDocumentationReviewRepairChangedPaths
	= Object.freeze([
		...callbackSubtypeDocumentationReviewRepairModifiedPaths
		, ...callbackSubtypeDocumentationReviewRepairIntegrationPaths
	]);
export const callbackSubtypeDocumentationReviewRepairAddedPaths = Object.freeze([
	"scripts/update-callback-subtype-documentation-review-repair-source-history.mjs"
	, "tests/helpers/callback-subtype-documentation-review-repair-source-history-tests.mjs"
	, "tests/helpers/callback-subtype-documentation-review-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	callbackSubtypeDocumentationReviewRepairHistoryPath, "utf8"));

/**
 * Restore one exact transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseCallbackSubtypeDocumentationReviewRepairUpdate
	= (source, update) => {
		assert.ok(callbackSubtypeDocumentationReviewRepairChangedPaths
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
 * Remove only the exact callback Subtype documentation review repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCallbackSubtypeDocumentationReviewRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !callbackSubtypeDocumentationReviewRepairChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const data = record();
	const update = [...data.updates, ...data.integrationUpdates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reverseCallbackSubtypeDocumentationReviewRepairUpdate(source, update)
		: source;
};
