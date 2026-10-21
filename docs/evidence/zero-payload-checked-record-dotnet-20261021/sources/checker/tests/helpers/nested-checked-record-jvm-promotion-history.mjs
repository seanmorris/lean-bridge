/**
 * Authenticate the exact nested checked-record Java/Kotlin promotion.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
	beforeNestedCheckedRecordDotnetPromotionPins
	, beforeNestedCheckedRecordDotnetPromotionSource
} from "./nested-checked-record-dotnet-promotion-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

export const nestedCheckedRecordJvmPromotionHistoryPath
	= "docs/evidence/nested-checked-record-jvm-promotion-source-history-20261016.json";
export const nestedCheckedRecordJvmPromotionPredecessor
	= "8008ae87eef3585b00421098eda67b558f6e31f3";
export const nestedCheckedRecordJvmPromotionDraftParent
	= nestedCheckedRecordJvmPromotionPredecessor;
export const nestedCheckedRecordJvmPromotionChangedPaths = [
	"docs/consume/java.md"
	, "docs/consume/kotlin.md"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "docs/reference/types.md"
	, "docs/type-surface.v1.json"
	, "scripts/generate-type-docs.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/nested-checked-record-jvm.test.mjs"
	, "tests/type-surface.test.mjs"
];
let history;

/**
 * Reverse one complete transition after checking its path, digests and edits.
 *
 * @param source - Complete current source text.
 * @param update - Exact immutable transition.
 */
export const reverseNestedCheckedRecordJvmPromotionUpdate = (source, update) => {
	assert.ok(nestedCheckedRecordJvmPromotionChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.ok(Number.isSafeInteger(edit.start) && edit.start >= cursor
			&& edit.start <= source.length);
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
 * Remove only this promotion when its complete current identity matches.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current source text.
 */
export const withoutNestedCheckedRecordJvmPromotion = (path, source) => {
	if(typeof source !== "string"
		|| !nestedCheckedRecordJvmPromotionChangedPaths.includes(path)) return source;
	const record = history ??= JSON.parse(readFileSync(
		nestedCheckedRecordJvmPromotionHistoryPath, "utf8"
	));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === sha256(source)
		? reverseNestedCheckedRecordJvmPromotionUpdate(source, update) : source;
};

/**
 * Reverse this promotion, then continue through every older authenticated layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeNestedCheckedRecordJvmPromotionSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !nestedCheckedRecordJvmPromotionChangedPaths.includes(path))
		return beforeNestedCheckedRecordDotnetPromotionSource(path, source, expected);
	if(sha256(source) === expected) return source;
	const previous = withoutNestedCheckedRecordJvmPromotion(path, source);
	if(previous !== source) return previous;
	return beforeNestedCheckedRecordDotnetPromotionSource(path, source, expected);
};

/**
 * Restore source pins through this promotion and every preceding milestone.
 *
 * @param inventory - Current type-surface inventory.
 */
export const beforeNestedCheckedRecordJvmPromotionPins = inventory => {
	const previous = structuredClone(inventory);
	const record = history ??= JSON.parse(readFileSync(
		nestedCheckedRecordJvmPromotionHistoryPath, "utf8"
	));
	for(const entry of previous.evidence) for(const file of entry.files)
	{
		const update = record.updates.find(item => item.path === file.path);
		if(update && file.sha256 === update.currentSha256)
			file.sha256 = update.previousSha256;
	}
	return beforeNestedCheckedRecordDotnetPromotionPins(previous);
};
