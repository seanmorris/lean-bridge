/**
 * Preserve the source layer that promotes hosted Rust value-index evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const checkedRecordValueIndexRustPromotionHistoryPath
	= "docs/evidence/checked-record-value-index-rust-promotion-source-history-20261020.json";
export const checkedRecordValueIndexRustPromotionPredecessor
	= "2bcf998d058a38f44fb3ec104a339966b1e329f1";
export const checkedRecordValueIndexRustPromotionDraftParent
	= "e6034e3a288a4b75abacf71994cea258b7c01e33";
export const checkedRecordValueIndexRustPromotionFoundationModifiedPaths
	= Object.freeze([
		"docs/consume/rust.md", "docs/evidence/README.md"
		, "docs/type-surface.v1.json"
		, "tests/helpers/checked-record-value-index-rust-evidence-tests.mjs"
	]);
export const checkedRecordValueIndexRustPromotionFoundationAddedPaths
	= Object.freeze([
		"docs/evidence/checked-record-value-index-rust-promotion-20261020.md"
		, "scripts/promote-checked-record-value-index-rust.mjs"
		, "tests/helpers/checked-record-value-index-rust-promotion-tests.mjs"
		, "tests/helpers/checked-record-value-index-rust-promotion.mjs"
	]);
export const checkedRecordValueIndexRustPromotionChangedPaths = Object.freeze([
	...checkedRecordValueIndexRustPromotionFoundationModifiedPaths
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const checkedRecordValueIndexRustPromotionHistoryAddedPaths
	= Object.freeze([
		"scripts/update-checked-record-value-index-rust-promotion-source-history.mjs"
		, "tests/helpers/checked-record-value-index-rust-promotion-source-history-tests.mjs"
		, "tests/helpers/checked-record-value-index-rust-promotion-source-history.mjs"
	]);
export const checkedRecordValueIndexRustPromotionAddedSourcePaths
	= Object.freeze([
		...checkedRecordValueIndexRustPromotionFoundationAddedPaths
		, ...checkedRecordValueIndexRustPromotionHistoryAddedPaths
	]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	checkedRecordValueIndexRustPromotionHistoryPath, "utf8"));

/**
 * Reverse one authenticated Rust promotion update.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseCheckedRecordValueIndexRustPromotionUpdate = (
	source, update
) => {
	assert.ok(checkedRecordValueIndexRustPromotionChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0; const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
		assert.equal(typeof edit.previous, "string");
		assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start, edit.start + edit.current.length)
			, edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only the hosted Rust value-index promotion layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCheckedRecordValueIndexRustPromotionSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !checkedRecordValueIndexRustPromotionChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseCheckedRecordValueIndexRustPromotionUpdate(source, update) : source;
};
