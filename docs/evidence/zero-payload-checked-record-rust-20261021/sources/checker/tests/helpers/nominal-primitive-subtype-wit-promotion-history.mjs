/**
 * Authenticate the exact primitive-base WIT support transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { beforePrimitiveSubtypePhpWasmPromotionPins } from "./nominal-primitive-subtype-php-wasm-promotion-history.mjs";
import {
	beforeNestedCheckedRecordBrowserPromotionPins
	, beforeNestedCheckedRecordBrowserPromotionSource
} from "./nested-checked-record-browser-promotion-history.mjs";
import { beforeRecursiveSubtypePhpWasmPromotionPins } from "./recursive-subtype-php-wasm-promotion-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

export const nominalPrimitiveSubtypeWitPromotionHistoryPath = "docs/evidence/nominal-primitive-subtype-wit-promotion-source-history-20261015.json";
export const nominalPrimitiveSubtypeWitPromotionPredecessor = "08e186ed010a292b5a38c4339ecd53049ce50339";
export const nominalPrimitiveSubtypeWitPromotionDraftParent = "08e186ed010a292b5a38c4339ecd53049ce50339";
export const nominalPrimitiveSubtypeWitPromotionChangedPaths = [
	"docs/consume/wit-wasi.md"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "docs/reference/types.md"
	, "docs/type-surface.v1.json"
	, "scripts/generate-type-docs.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/nested-checked-record-browser-promotion-history-tests.mjs"
	, "tests/helpers/nested-checked-record-browser-promotion-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-php-wasm-promotion-history-tests.mjs"
	, "tests/helpers/nominal-primitive-subtype-tests.mjs"
	, "tests/helpers/recursive-subtype-php-wasm-promotion-history-tests.mjs"
	, "tests/helpers/recursive-subtype-php-wasm-promotion-tests.mjs"
	, "tests/type-surface.test.mjs"
];
let history;

/**
 * Reverse only a complete transition with exact before and after digests.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated immutable transition.
 */
export const reverseNominalPrimitiveSubtypeWitPromotionUpdate = (source, update) => {
	assert.ok(nominalPrimitiveSubtypeWitPromotionChangedPaths.includes(update.path));
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
	parts.push(source.slice(cursor)); const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path); return previous;
};

/**
 * Remove this promotion only, without traversing older history layers.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current source text.
 */
export const withoutNominalPrimitiveSubtypeWitPromotion = (path, source) => {
	if(typeof source !== "string" || !nominalPrimitiveSubtypeWitPromotionChangedPaths.includes(path)) return source;
	const record = history ??= JSON.parse(readFileSync(nominalPrimitiveSubtypeWitPromotionHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === sha256(source) ? reverseNominalPrimitiveSubtypeWitPromotionUpdate(source, update) : source;
};

/**
 * Preserve unknown edits and stop at the explicitly requested historical epoch.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current source text.
 * @param expected - Optional requested stopping digest.
 */
export const beforeNominalPrimitiveSubtypeWitPromotionSource = (path, source, expected) => {
	if(typeof source !== "string" || !nominalPrimitiveSubtypeWitPromotionChangedPaths.includes(path))
		return beforeNestedCheckedRecordBrowserPromotionSource(path, source, expected);
	const digest = sha256(source); if(digest === expected) return source;
	const previous = withoutNominalPrimitiveSubtypeWitPromotion(path, source);
	if(previous !== source) return previous;
	return beforeNestedCheckedRecordBrowserPromotionSource(path, source, expected);
};

/**
 * Restore only this milestone's exact current-source pins.
 *
 * @param inventory - Current type-surface inventory.
 */
export const beforeNominalPrimitiveSubtypeWitPromotionPins = inventory => {
	const previous = structuredClone(inventory);
	const record = history ??= JSON.parse(readFileSync(nominalPrimitiveSubtypeWitPromotionHistoryPath, "utf8"));
	for(const entry of previous.evidence) for(const file of entry.files)
	{
		const update = record.updates.find(item => item.path === file.path);
		if(update && file.sha256 === update.currentSha256) file.sha256 = update.previousSha256;
	}
	return previous;
};

/**
 * Reverse source pins above the nineteen-base PHP-Wasm milestone, newest first.
 *
 * @param inventory - Current type-surface inventory.
 */
export const beforePrimitiveSubtypeWitPromotionPins = inventory => beforePrimitiveSubtypePhpWasmPromotionPins(
	beforeRecursiveSubtypePhpWasmPromotionPins(beforeNestedCheckedRecordBrowserPromotionPins(
		beforeNominalPrimitiveSubtypeWitPromotionPins(inventory))));
