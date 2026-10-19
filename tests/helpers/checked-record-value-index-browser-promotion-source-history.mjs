/**
 * Preserve the exact source transition that promoted hosted closed value-index
 * browser evidence into the public type surface.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const checkedRecordValueIndexBrowserPromotionHistoryPath
	= "docs/evidence/checked-record-value-index-browser-promotion-source-history-20261019.json";
export const checkedRecordValueIndexBrowserPromotionPredecessor
	= "ec4ad40b1312a5b70ea51fd76d8e54ba4f691dad";
export const checkedRecordValueIndexBrowserPromotionDraftParent
	= "412daba4711c39b2cb3f144a235f389b596d6ab3";
export const checkedRecordValueIndexBrowserPromotionFoundationModifiedPaths
	= Object.freeze([
		"docs/evidence/README.md"
		, "docs/javascript-typescript.md"
		, "docs/lean/existing-package.md"
		, "docs/lean/export-decisions.md"
		, "docs/reference/types.md"
		, "docs/type-surface.v1.json"
		, "scripts/generate-type-docs.mjs"
		, "tests/checked-record-value-index-browser.test.mjs"
	]);
export const checkedRecordValueIndexBrowserPromotionFoundationAddedPaths
	= Object.freeze([
		"docs/evidence/checked-record-value-index-browser-promotion-20261019.md"
		, "scripts/promote-checked-record-value-index-browser.mjs"
		, "tests/helpers/checked-record-value-index-browser-promotion-tests.mjs"
		, "tests/helpers/checked-record-value-index-browser-promotion.mjs"
	]);
export const checkedRecordValueIndexBrowserPromotionChangedPaths
	= Object.freeze([
		...checkedRecordValueIndexBrowserPromotionFoundationModifiedPaths
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const checkedRecordValueIndexBrowserPromotionHistoryAddedPaths
	= Object.freeze([
		"scripts/update-checked-record-value-index-browser-promotion-source-history.mjs"
		, "tests/helpers/checked-record-value-index-browser-promotion-source-history-tests.mjs"
		, "tests/helpers/checked-record-value-index-browser-promotion-source-history.mjs"
	]);
export const checkedRecordValueIndexBrowserPromotionAddedSourcePaths
	= Object.freeze([
		...checkedRecordValueIndexBrowserPromotionFoundationAddedPaths
		, ...checkedRecordValueIndexBrowserPromotionHistoryAddedPaths
	]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	checkedRecordValueIndexBrowserPromotionHistoryPath, "utf8"
));

/**
 * Reverse one exact hosted browser value-index promotion source transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseCheckedRecordValueIndexBrowserPromotionUpdate = (
	source, update
) => {
	assert.ok(checkedRecordValueIndexBrowserPromotionChangedPaths.includes(
		update.path));
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
 * Remove only the exact hosted value-index browser promotion source layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCheckedRecordValueIndexBrowserPromotionSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !checkedRecordValueIndexBrowserPromotionChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseCheckedRecordValueIndexBrowserPromotionUpdate(source, update)
		: source;
};
