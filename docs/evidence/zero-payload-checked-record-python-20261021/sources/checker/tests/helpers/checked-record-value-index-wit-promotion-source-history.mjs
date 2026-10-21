/**
 * Preserve the exact source transition that promotes hosted WIT/WASI
 * value-index evidence into the public type surface.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const checkedRecordValueIndexWitPromotionHistoryPath
	= "docs/evidence/checked-record-value-index-wit-promotion-source-history-20261020.json";
export const checkedRecordValueIndexWitPromotionPredecessor
	= "102da2b7ec1382625bc2a7f35a66c8d8515e17a6";
export const checkedRecordValueIndexWitPromotionDraftParent
	= "a01f7b1e430afad45ef3a83bcdf309ed69248ec8";
export const checkedRecordValueIndexWitPromotionFoundationModifiedPaths
	= Object.freeze([
		"docs/consume/wit-wasi.md"
		, "docs/evidence/README.md"
		, "docs/type-surface.v1.json"
		, "tests/helpers/checked-record-value-index-wit-evidence-tests.mjs"
		, "tests/type-surface.test.mjs"
	]);
export const checkedRecordValueIndexWitPromotionFoundationAddedPaths
	= Object.freeze([
		"docs/evidence/checked-record-value-index-wit-promotion-20261020.md"
		, "scripts/promote-checked-record-value-index-wit.mjs"
		, "tests/helpers/checked-record-value-index-wit-promotion-tests.mjs"
		, "tests/helpers/checked-record-value-index-wit-promotion.mjs"
	]);
export const checkedRecordValueIndexWitPromotionChangedPaths
	= Object.freeze([
		...checkedRecordValueIndexWitPromotionFoundationModifiedPaths
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const checkedRecordValueIndexWitPromotionHistoryAddedPaths
	= Object.freeze([
		"scripts/update-checked-record-value-index-wit-promotion-source-history.mjs"
		, "tests/helpers/checked-record-value-index-wit-promotion-source-history-tests.mjs"
		, "tests/helpers/checked-record-value-index-wit-promotion-source-history.mjs"
	]);
export const checkedRecordValueIndexWitPromotionAddedSourcePaths
	= Object.freeze([
		...checkedRecordValueIndexWitPromotionFoundationAddedPaths
		, ...checkedRecordValueIndexWitPromotionHistoryAddedPaths
	]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	checkedRecordValueIndexWitPromotionHistoryPath, "utf8"
));

/**
 * Reverse one exact hosted WIT/WASI value-index promotion transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseCheckedRecordValueIndexWitPromotionUpdate = (
	source, update
) => {
	assert.ok(checkedRecordValueIndexWitPromotionChangedPaths.includes(
		update.path));
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
 * Remove only the exact hosted WIT/WASI value-index promotion layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCheckedRecordValueIndexWitPromotionSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !checkedRecordValueIndexWitPromotionChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseCheckedRecordValueIndexWitPromotionUpdate(source, update)
		: source;
};
