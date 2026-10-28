/**
 * Authenticate the exact nested checked-record npm/browser promotion.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
	beforeNestedCheckedRecordSource
} from "./nested-checked-record-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

export const nestedCheckedRecordBrowserPromotionHistoryPath
	= "docs/evidence/nested-checked-record-browser-promotion-source-history-20261016.json";
export const nestedCheckedRecordBrowserPromotionPredecessor
	= "4febfe6af6e99a073f0e30f7455f16aa55c6fdc2";
export const nestedCheckedRecordBrowserPromotionDraftParent
	= nestedCheckedRecordBrowserPromotionPredecessor;
export const nestedCheckedRecordBrowserPromotionChangedPaths = Object.freeze([
	"docs/evidence/README.md"
	, "docs/javascript-typescript.md"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "docs/reference/types.md"
	, "docs/type-surface.v1.json"
	, "scripts/generate-type-docs.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/nested-checked-record-browser-promotion.mjs"
	, "tests/helpers/nested-checked-record-browser-promotion-tests.mjs"
	, "tests/nested-checked-records.test.mjs"
	, "tests/type-surface.test.mjs"
]);
let history;

/**
 * Reverse one complete transition after checking both source identities.
 *
 * @param source - Complete source at the recorded current identity.
 * @param update - Authenticated transition for the source path.
 */
export const reverseNestedCheckedRecordBrowserPromotionUpdate = (source, update) => {
	assert.ok(nestedCheckedRecordBrowserPromotionChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0; const parts = [];
	for(const edit of update.edits)
	{
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
	parts.push(source.slice(cursor)); const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only this promotion when its complete current identity matches.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current source.
 */
export const withoutNestedCheckedRecordBrowserPromotion = (path, source) => {
	if(typeof source !== "string"
		|| !nestedCheckedRecordBrowserPromotionChangedPaths.includes(path)) return source;
	const record = history ??= JSON.parse(readFileSync(
		nestedCheckedRecordBrowserPromotionHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === sha256(source)
		? reverseNestedCheckedRecordBrowserPromotionUpdate(source, update) : source;
};

/**
 * Preserve unknown edits and walk into the preceding compiler transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current source.
 * @param expected - Optional digest at which traversal stops.
 */
export const beforeNestedCheckedRecordBrowserPromotionSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !nestedCheckedRecordBrowserPromotionChangedPaths.includes(path))
		return beforeNestedCheckedRecordSource(path, source, expected);
	if(sha256(source) === expected) return source;
	const previous = withoutNestedCheckedRecordBrowserPromotion(path, source);
	if(previous !== source) return previous;
	return beforeNestedCheckedRecordSource(path, source, expected);
};

/**
 * Restore only source pins changed by this promotion.
 *
 * @param inventory - Promoted type-surface inventory.
 */
export const beforeNestedCheckedRecordBrowserPromotionPins = inventory => {
	const previous = structuredClone(inventory);
	const record = history ??= JSON.parse(readFileSync(
		nestedCheckedRecordBrowserPromotionHistoryPath, "utf8"));
	for(const entry of previous.evidence) for(const file of entry.files)
	{
		const update = record.updates.find(item => item.path === file.path);
		if(update && file.sha256 === update.currentSha256)
			file.sha256 = update.previousSha256;
	}
	return previous;
};
