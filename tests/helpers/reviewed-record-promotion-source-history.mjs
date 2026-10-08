/**
 * Preserve exact source predecessors when reconciling reviewed generic-record observations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const reviewedRecordPromotionHistoryPath = "docs/evidence/reviewed-record-promotion-source-history-20261008.json";
export const reviewedRecordPromotionPredecessor = "6b00a8f929416adf6d85fadce54ec355f6460f0a";
export const reviewedRecordPromotionChangedPaths = [
	"docs/type-surface.v1.json"
	, "scripts/generate-type-docs.mjs"
	, "tests/type-surface-docs.test.mjs"
	, "docs/javascript-typescript.md"
	, "docs/consume/c.md"
	, "docs/consume/cpp.md"
	, "docs/php.md"
	, "tests/reviewed-instantiations.test.mjs"
	, "tests/helpers/browser-generic-promotion.mjs"
	, "tests/helpers/browser-generic-promotion-source-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/php-dispatch-integration-source-history.mjs"
	, "tests/helpers/php-dispatch-integration-source-history-tests.mjs"
];
let history;

/**
 * Reverse registered spans only when both complete source hashes match.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseReviewedRecordPromotionUpdate = (source, update) => {
	assert.ok(reviewedRecordPromotionChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0; const parts = [];
	for(const edit of update.edits)
	{
		assert.ok(Number.isSafeInteger(edit.start) && edit.start >= cursor && edit.start <= source.length);
		assert.equal(typeof edit.previous, "string"); assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start, edit.start + edit.current.length), edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Restore the pre-integration source, stopping at an explicitly requested identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeReviewedRecordPromotionSource = (path, source, expected) => {
	if(typeof source !== "string" || !reviewedRecordPromotionChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(reviewedRecordPromotionHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseReviewedRecordPromotionUpdate(source, update) : source;
};
