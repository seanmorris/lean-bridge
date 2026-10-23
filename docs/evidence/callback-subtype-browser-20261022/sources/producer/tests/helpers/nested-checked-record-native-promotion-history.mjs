/**
 * Authenticate the exact nested checked-record C/C++ support transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
	beforeNestedCheckedRecordNativeCorrectionSource
	, beforeNestedCheckedRecordNativeCorrectionPins
} from "./nested-checked-record-native-correction-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

export const nestedCheckedRecordNativePromotionHistoryPath
	= "docs/evidence/nested-checked-record-native-promotion-source-history-20261016.json";
export const nestedCheckedRecordNativePromotionPredecessor
	= "d6fe6dfffc8f6b94e11a3110f704ea98634a2c0f";
export const nestedCheckedRecordNativePromotionDraftParent
	= nestedCheckedRecordNativePromotionPredecessor;
export const nestedCheckedRecordNativePromotionChangedPaths = [
	"docs/consume/c.md"
	, "docs/consume/cpp.md"
	, "docs/evidence/README.md"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "docs/reference/types.md"
	, "docs/type-surface.v1.json"
	, "scripts/generate-type-docs.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/lean-author-documentation.test.mjs"
	, "tests/nested-checked-records.test.mjs"
	, "tests/type-surface.test.mjs"
];
let history;

/**
 * Reverse one complete transition only after checking its path and both digests.
 *
 * @param source - Complete current source text.
 * @param update - Exact immutable transition.
 */
export const reverseNestedCheckedRecordNativePromotionUpdate = (source, update) => {
	assert.ok(nestedCheckedRecordNativePromotionChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0; const parts = [];
	for(const edit of update.edits)
	{
		assert.ok(Number.isSafeInteger(edit.start) && edit.start >= cursor
			&& edit.start <= source.length);
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
 * Remove only this promotion when the complete current identity matches.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current source text.
 */
export const withoutNestedCheckedRecordNativePromotion = (path, source) => {
	if(typeof source !== "string"
		|| !nestedCheckedRecordNativePromotionChangedPaths.includes(path)) return source;
	const record = history ??= JSON.parse(readFileSync(
		nestedCheckedRecordNativePromotionHistoryPath, "utf8"
	));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === sha256(source)
		? reverseNestedCheckedRecordNativePromotionUpdate(source, update) : source;
};

/**
 * Reverse this promotion, then continue through every older authenticated layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeNestedCheckedRecordNativePromotionSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !nestedCheckedRecordNativePromotionChangedPaths.includes(path))
		return beforeNestedCheckedRecordNativeCorrectionSource(path, source, expected);
	if(sha256(source) === expected) return source;
	const previous = withoutNestedCheckedRecordNativePromotion(path, source);
	if(previous !== source) return previous;
	return beforeNestedCheckedRecordNativeCorrectionSource(path, source, expected);
};

/**
 * Restore source pins through this milestone and the preceding correction.
 *
 * @param inventory - Current promoted type-surface inventory.
 */
export const beforeNestedCheckedRecordNativePromotionPins = inventory => {
	const previous = structuredClone(inventory);
	const record = history ??= JSON.parse(readFileSync(
		nestedCheckedRecordNativePromotionHistoryPath, "utf8"
	));
	for(const entry of previous.evidence) for(const file of entry.files)
	{
		const update = record.updates.find(item => item.path === file.path);
		if(update && file.sha256 === update.currentSha256)
			file.sha256 = update.previousSha256;
	}
	return beforeNestedCheckedRecordNativeCorrectionPins(previous);
};
