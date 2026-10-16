/**
 * Authenticate the exact nested checked-record C# promotion.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
	beforeNestedCheckedRecordQualityPins
	, beforeNestedCheckedRecordQualitySource
} from "./nested-checked-record-quality-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

export const nestedCheckedRecordDotnetPromotionHistoryPath
	= "docs/evidence/nested-checked-record-dotnet-promotion-source-history-20261016.json";
export const nestedCheckedRecordDotnetPromotionPredecessor
	= "07729e80d5a7972a2ec633c61e6e80517c4c9277";
export const nestedCheckedRecordDotnetPromotionDraftParent
	= nestedCheckedRecordDotnetPromotionPredecessor;
export const nestedCheckedRecordDotnetPromotionChangedPaths = [
	"docs/consume/dotnet.md"
	, "docs/evidence/README.md"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "docs/reference/types.md"
	, "docs/type-surface.v1.json"
	, "scripts/generate-type-docs.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/nested-checked-record-dotnet.test.mjs"
	, "tests/type-surface.test.mjs"
];
let history;

/**
 * Reverse one complete transition after checking its path, digests and edits.
 *
 * @param source - Complete current source text.
 * @param update - Exact immutable transition.
 */
export const reverseNestedCheckedRecordDotnetPromotionUpdate = (source, update) => {
	assert.ok(nestedCheckedRecordDotnetPromotionChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
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
 * Remove only this promotion when its complete current identity matches.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current source text.
 */
export const withoutNestedCheckedRecordDotnetPromotion = (path, source) => {
	if(typeof source !== "string"
		|| !nestedCheckedRecordDotnetPromotionChangedPaths.includes(path)) return source;
	const record = history ??= JSON.parse(readFileSync(
		nestedCheckedRecordDotnetPromotionHistoryPath, "utf8"
	));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === sha256(source)
		? reverseNestedCheckedRecordDotnetPromotionUpdate(source, update) : source;
};

/**
 * Reverse this promotion, then continue through every older authenticated layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeNestedCheckedRecordDotnetPromotionSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !nestedCheckedRecordDotnetPromotionChangedPaths.includes(path))
		return beforeNestedCheckedRecordQualitySource(path, source, expected);
	if(sha256(source) === expected) return source;
	const previous = withoutNestedCheckedRecordDotnetPromotion(path, source);
	if(previous !== source) return previous;
	return beforeNestedCheckedRecordQualitySource(path, source, expected);
};

/**
 * Restore source pins through this promotion and every preceding milestone.
 *
 * @param inventory - Current type-surface inventory.
 */
export const beforeNestedCheckedRecordDotnetPromotionPins = inventory => {
	const previous = structuredClone(inventory);
	const record = history ??= JSON.parse(readFileSync(
		nestedCheckedRecordDotnetPromotionHistoryPath, "utf8"
	));
	for(const entry of previous.evidence) for(const file of entry.files)
	{
		const update = record.updates.find(item => item.path === file.path);
		if(update && file.sha256 === update.currentSha256)
			file.sha256 = update.previousSha256;
	}
	return beforeNestedCheckedRecordQualityPins(previous);
};
