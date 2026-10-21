/**
 * Authenticate the exact source-quality cleanup after native record promotion.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
	beforeNestedCheckedRecordNativePromotionPins
	, beforeNestedCheckedRecordNativePromotionSource
} from "./nested-checked-record-native-promotion-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

export const nestedCheckedRecordQualityHistoryPath
	= "docs/evidence/nested-checked-record-quality-source-history-20261016.json";
export const nestedCheckedRecordQualityPredecessor
	= "d52eeecb776abfae00e41792b7ae0e98d272f12d";
export const nestedCheckedRecordQualityDraftParent
	= nestedCheckedRecordQualityPredecessor;
export const nestedCheckedRecordQualityChangedPaths = [
	"docs/type-surface.v1.json"
	, "scripts/update-recursive-subtype-php-wasm-history.mjs"
	, "src/backends/c/native-graph-adapters.mjs"
	, "src/build/php-wasm-graph-component.mjs"
	, "src/release/php-wasm-copied-package.mjs"
	, "tests/fixtures/nested-checked-record-consumers/full.mts"
	, "tests/fixtures/nested-checked-record-consumers/result-only.mts"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/recursive-subtype-php-wasm-source-history-tests.mjs"
	, "tests/helpers/recursive-subtype-php-wasm-source-history.mjs"
	, "tests/helpers/recursive-subtype-php-wasm-tests.mjs"
	, "tests/type-surface.test.mjs"
];
let history;

/**
 * Reverse one complete transition after checking its path, digests and edits.
 *
 * @param source - Complete current source text.
 * @param update - Exact immutable transition.
 */
export const reverseNestedCheckedRecordQualityUpdate = (source, update) => {
	assert.ok(nestedCheckedRecordQualityChangedPaths.includes(update.path));
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
 * Remove only this cleanup when its complete current identity matches.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current source text.
 */
export const withoutNestedCheckedRecordQuality = (path, source) => {
	if(typeof source !== "string"
		|| !nestedCheckedRecordQualityChangedPaths.includes(path)) return source;
	const record = history ??= JSON.parse(readFileSync(
		nestedCheckedRecordQualityHistoryPath, "utf8"
	));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === sha256(source)
		? reverseNestedCheckedRecordQualityUpdate(source, update) : source;
};

/**
 * Reverse this cleanup, then continue through every older authenticated layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeNestedCheckedRecordQualitySource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !nestedCheckedRecordQualityChangedPaths.includes(path))
		return beforeNestedCheckedRecordNativePromotionSource(path, source, expected);
	if(sha256(source) === expected) return source;
	const previous = withoutNestedCheckedRecordQuality(path, source);
	if(previous !== source) return previous;
	return beforeNestedCheckedRecordNativePromotionSource(path, source, expected);
};

/**
 * Restore source pins through this cleanup and every preceding native milestone.
 *
 * @param inventory - Current type-surface inventory.
 */
export const beforeNestedCheckedRecordQualityPins = inventory => {
	const previous = structuredClone(inventory);
	const record = history ??= JSON.parse(readFileSync(
		nestedCheckedRecordQualityHistoryPath, "utf8"
	));
	for(const entry of previous.evidence) for(const file of entry.files)
	{
		const update = record.updates.find(item => item.path === file.path);
		if(update && file.sha256 === update.currentSha256)
			file.sha256 = update.previousSha256;
	}
	return beforeNestedCheckedRecordNativePromotionPins(previous);
};
