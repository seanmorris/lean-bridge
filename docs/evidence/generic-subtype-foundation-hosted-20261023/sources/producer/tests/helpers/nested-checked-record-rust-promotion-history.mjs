/**
 * Authenticate the exact nested checked-record Rust support transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
	beforeNestedCheckedRecordPhpWasmPromotionPins
	, beforeNestedCheckedRecordPhpWasmPromotionSource
} from "./nested-checked-record-php-wasm-promotion-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

export const nestedCheckedRecordRustPromotionHistoryPath
	= "docs/evidence/nested-checked-record-rust-promotion-source-history-20261016.json";
export const nestedCheckedRecordRustPromotionPredecessor
	= "90dd7fe4490bf4a0949ace8f176e0ea43e4d0b98";
export const nestedCheckedRecordRustPromotionDraftParent
	= nestedCheckedRecordRustPromotionPredecessor;
export const nestedCheckedRecordRustPromotionChangedPaths = [
	"docs/consume/rust.md"
	, "docs/evidence/README.md"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "docs/reference/types.md"
	, "docs/type-surface.v1.json"
	, "scripts/generate-type-docs.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/nested-checked-record-rust-tests.mjs"
	, "tests/type-surface.test.mjs"
];
let history;

/**
 * Reverse only a complete transition with exact before and after digests.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated immutable transition.
 */
export const reverseNestedCheckedRecordRustPromotionUpdate = (source, update) => {
	assert.ok(nestedCheckedRecordRustPromotionChangedPaths.includes(update.path));
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
	parts.push(source.slice(cursor)); const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove this promotion only, without traversing older history layers.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current source text.
 */
export const withoutNestedCheckedRecordRustPromotion = (path, source) => {
	if(typeof source !== "string"
		|| !nestedCheckedRecordRustPromotionChangedPaths.includes(path))
		return source;
	const record = history ??= JSON.parse(readFileSync(
		nestedCheckedRecordRustPromotionHistoryPath, "utf8"
	));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === sha256(source)
		? reverseNestedCheckedRecordRustPromotionUpdate(source, update) : source;
};

/**
 * Preserve unknown edits and stop at the explicitly requested epoch.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current source text.
 * @param expected - Optional requested stopping digest.
 */
export const beforeNestedCheckedRecordRustPromotionSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !nestedCheckedRecordRustPromotionChangedPaths.includes(path))
		return beforeNestedCheckedRecordPhpWasmPromotionSource(
			path, source, expected
		);
	const digest = sha256(source); if(digest === expected) return source;
	const previous = withoutNestedCheckedRecordRustPromotion(path, source);
	if(previous !== source) return previous;
	return beforeNestedCheckedRecordPhpWasmPromotionSource(
		path, source, expected
	);
};

/**
 * Restore only this milestone's exact current-source pins.
 *
 * @param inventory - Current type-surface inventory.
 */
export const beforeNestedCheckedRecordRustPromotionPins = inventory => {
	const previous = structuredClone(inventory);
	const record = history ??= JSON.parse(readFileSync(
		nestedCheckedRecordRustPromotionHistoryPath, "utf8"
	));
	for(const entry of previous.evidence) for(const file of entry.files)
	{
		const update = record.updates.find(item => item.path === file.path);
		if(update && file.sha256 === update.currentSha256)
			file.sha256 = update.previousSha256;
	}
	return previous;
};

/**
 * Reverse source pins above the preceding PHP-Wasm milestone.
 *
 * @param inventory - Current type-surface inventory.
 */
export const beforeNestedCheckedRecordRustPromotionPinsAll = inventory =>
	beforeNestedCheckedRecordPhpWasmPromotionPins(
		beforeNestedCheckedRecordRustPromotionPins(inventory)
	);
