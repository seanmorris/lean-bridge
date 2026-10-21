/**
 * Preserve the exact source transition that promotes hosted PHP-Wasm
 * value-index evidence into the public type surface.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const checkedRecordValueIndexPhpWasmPromotionHistoryPath
	= "docs/evidence/checked-record-value-index-php-wasm-promotion-source-history-20261020.json";
export const checkedRecordValueIndexPhpWasmPromotionPredecessor
	= "12646a8ad32b98d6825310677c809f1a7b50f84a";
export const checkedRecordValueIndexPhpWasmPromotionDraftParent
	= "f7ca536a20b5cdf005b64ca8201d8efd5cf4c38b";
export const checkedRecordValueIndexPhpWasmPromotionFoundationModifiedPaths
	= Object.freeze([
		"docs/evidence/README.md"
		, "docs/lean/existing-package.md"
		, "docs/lean/export-decisions.md"
		, "docs/php.md"
		, "docs/type-surface.v1.json"
		, "tests/helpers/checked-record-value-index-php-wasm-evidence-tests.mjs"
		, "tests/type-surface.test.mjs"
	]);
export const checkedRecordValueIndexPhpWasmPromotionFoundationAddedPaths
	= Object.freeze([
		"docs/evidence/checked-record-value-index-php-wasm-promotion-20261020.md"
		, "scripts/promote-checked-record-value-index-php-wasm.mjs"
		, "tests/helpers/checked-record-value-index-php-wasm-promotion-tests.mjs"
		, "tests/helpers/checked-record-value-index-php-wasm-promotion.mjs"
	]);
export const checkedRecordValueIndexPhpWasmPromotionChangedPaths
	= Object.freeze([
		...checkedRecordValueIndexPhpWasmPromotionFoundationModifiedPaths
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const checkedRecordValueIndexPhpWasmPromotionHistoryAddedPaths
	= Object.freeze([
		"scripts/update-checked-record-value-index-php-wasm-promotion-source-history.mjs"
		, "tests/helpers/checked-record-value-index-php-wasm-promotion-source-history-tests.mjs"
		, "tests/helpers/checked-record-value-index-php-wasm-promotion-source-history.mjs"
	]);
export const checkedRecordValueIndexPhpWasmPromotionAddedSourcePaths
	= Object.freeze([
		...checkedRecordValueIndexPhpWasmPromotionFoundationAddedPaths
		, ...checkedRecordValueIndexPhpWasmPromotionHistoryAddedPaths
	]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	checkedRecordValueIndexPhpWasmPromotionHistoryPath, "utf8"
));

/**
 * Reverse one exact hosted PHP-Wasm value-index promotion source transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseCheckedRecordValueIndexPhpWasmPromotionUpdate = (
	source, update
) => {
	assert.ok(checkedRecordValueIndexPhpWasmPromotionChangedPaths.includes(
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
 * Remove only the exact hosted PHP-Wasm value-index promotion source layer.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCheckedRecordValueIndexPhpWasmPromotionSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !checkedRecordValueIndexPhpWasmPromotionChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseCheckedRecordValueIndexPhpWasmPromotionUpdate(source, update)
		: source;
};
