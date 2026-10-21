/**
 * Authenticate the exact recursive checked-Subtype PHP-Wasm promotion.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { beforeRecursiveSubtypePhpWasmSource } from "./recursive-subtype-php-wasm-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

export const recursiveSubtypePhpWasmPromotionHistoryPath = "docs/evidence/recursive-subtype-php-wasm-promotion-source-history-20261015.json";
export const recursiveSubtypePhpWasmPromotionPredecessor = "a54f8c653af24440754ff274df9095b54680f547";
export const recursiveSubtypePhpWasmPromotionDraftParent = "a54f8c653af24440754ff274df9095b54680f547";
export const recursiveSubtypePhpWasmPromotionChangedPaths = Object.freeze([
	"docs/evidence/README.md"
	, "docs/php.md"
	, "docs/reference/types.md"
	, "docs/type-surface.v1.json"
	, "scripts/generate-type-docs.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/php-wasm-direct-fin-promotion-history-tests.mjs"
	, "tests/helpers/php-wasm-direct-fin-promotion-tests.mjs"
	, "tests/helpers/php-wasm-entry-ci-history-tests.mjs"
	, "tests/helpers/php-wasm-entry-harness-history-tests.mjs"
	, "tests/helpers/php-wasm-fin-archive-source-history-tests.mjs"
	, "tests/helpers/php-wasm-fin-direct-history-tests.mjs"
	, "tests/helpers/php-wasm-fin-promotion-source-history-tests.mjs"
	, "tests/helpers/php-wasm-fin-promotion-tests.mjs"
	, "tests/helpers/php-wasm-fin-source-history-tests.mjs"
	, "tests/helpers/php-wasm-hosted-refinements-history-tests.mjs"
	, "tests/helpers/php-wasm-reviewed-fin-source-history-tests.mjs"
	, "tests/helpers/php-wasm-subtype-acceptance-history-tests.mjs"
	, "tests/helpers/php-wasm-subtype-entry-history-tests.mjs"
	, "tests/helpers/php-wasm-subtype-history-tests.mjs"
	, "tests/helpers/php-wasm-subtype-promotion-history-tests.mjs"
	, "tests/helpers/php-wasm-subtype-promotion-tests.mjs"
	, "tests/helpers/reviewed-php-wasm-fin-archive-source-history-tests.mjs"
	, "tests/recursive-subtype-php-wasm.test.mjs"
	, "tests/type-surface.test.mjs"
]);
let history;

/**
 * Reverse one complete transition after checking both source identities.
 *
 * @param source - Complete source at the recorded current identity.
 * @param update - Authenticated transition for the source path.
 */
export const reverseRecursiveSubtypePhpWasmPromotionUpdate = (source, update) => {
	assert.ok(recursiveSubtypePhpWasmPromotionChangedPaths.includes(update.path));
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
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only this promotion when the complete current identity matches.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete source text.
 */
export const withoutRecursiveSubtypePhpWasmPromotion = (path, source) => {
	if(typeof source !== "string" || !recursiveSubtypePhpWasmPromotionChangedPaths.includes(path))
		return source;
	const record = history ??= JSON.parse(readFileSync(
		recursiveSubtypePhpWasmPromotionHistoryPath, "utf8"
	));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === sha256(source)
		? reverseRecursiveSubtypePhpWasmPromotionUpdate(source, update) : source;
};

/**
 * Preserve unknown edits and stop at an explicitly requested digest.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete source text.
 * @param expected - Optional digest at which traversal stops.
 */
export const beforeRecursiveSubtypePhpWasmPromotionSource = (path, source, expected) => {
	if(typeof source !== "string" || !recursiveSubtypePhpWasmPromotionChangedPaths.includes(path))
		return beforeRecursiveSubtypePhpWasmSource(path, source, expected);
	if(sha256(source) === expected) return source;
	const previous = withoutRecursiveSubtypePhpWasmPromotion(path, source);
	if(previous !== source) return previous;
	return beforeRecursiveSubtypePhpWasmSource(path, source, expected);
};

/**
 * Restore only source pins changed by this promotion.
 *
 * @param inventory - Promoted type-surface inventory.
 */
export const beforeRecursiveSubtypePhpWasmPromotionPins = inventory => {
	const previous = structuredClone(inventory);
	const record = history ??= JSON.parse(readFileSync(
		recursiveSubtypePhpWasmPromotionHistoryPath, "utf8"
	));
	for(const entry of previous.evidence) for(const file of entry.files)
	{
		const update = record.updates.find(item => item.path === file.path);
		if(update && file.sha256 === update.currentSha256)
			file.sha256 = update.previousSha256;
	}
	return previous;
};
