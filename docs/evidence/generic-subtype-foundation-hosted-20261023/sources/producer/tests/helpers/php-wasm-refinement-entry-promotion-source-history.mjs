/**
 * Reverse the recurring PHP-Wasm refinement-entry promotion milestone.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const phpWasmRefinementEntryPromotionHistoryPath
	= "docs/evidence/php-wasm-refinement-entry-promotion-source-history-20261022.json";
export const phpWasmRefinementEntryPromotionPredecessor
	= "6f3e029a8bd47893160a82d2a0668e8e17dc5061";
export const phpWasmRefinementEntryPromotionImplementation
	= "e98ee772d9203aa09c9bcb4e1acb4f2621bc9c23";
export const phpWasmRefinementEntryPromotionUpdatedPaths = Object.freeze([
	".github/workflows/php-wasm-callback-entry.yml"
	, ".github/workflows/php-wasm-indexed-refinement-entry.yml"
	, ".github/workflows/php-wasm-owned-refinement-entry.yml"
	, ".github/workflows/php-wasm-refinement-entry.yml"
	, "tests/helpers/php-wasm-refinement-ci-matrix-tests.mjs"
	, "tests/helpers/php-wasm-refinement-ci-matrix.mjs"
	, "tests/php-wasm-fin.test.mjs"
]);
export const phpWasmRefinementEntryPromotionImplementationAdditions
	= Object.freeze([
		".github/workflows/php-wasm-refinement-entry-promotion.yml"
		, "tests/helpers/php-wasm-refinement-entry-promotion-ci-tests.mjs"
		, "tests/helpers/php-wasm-refinement-entry-promotion-ci.mjs"
	]);
export const phpWasmRefinementEntryPromotionImplementationPaths = Object.freeze([
	...phpWasmRefinementEntryPromotionUpdatedPaths
	, ...phpWasmRefinementEntryPromotionImplementationAdditions
]);
export const phpWasmRefinementEntryPromotionIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
]);
export const phpWasmRefinementEntryPromotionChangedPaths = Object.freeze([
	...phpWasmRefinementEntryPromotionUpdatedPaths
	, ...phpWasmRefinementEntryPromotionIntegrationPaths
]);
export const phpWasmRefinementEntryPromotionAddedPaths = Object.freeze([
	...phpWasmRefinementEntryPromotionImplementationAdditions
	, "scripts/update-php-wasm-refinement-entry-promotion-source-history.mjs"
	, "tests/helpers/php-wasm-refinement-entry-promotion-source-history-tests.mjs"
	, "tests/helpers/php-wasm-refinement-entry-promotion-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	phpWasmRefinementEntryPromotionHistoryPath, "utf8"));

/**
 * Restore one exact recurring-promotion source transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reversePhpWasmRefinementEntryPromotionUpdate = (source, update) => {
	assert.ok(phpWasmRefinementEntryPromotionChangedPaths.includes(update.path));
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
 * Remove only the exact recurring promotion milestone.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforePhpWasmRefinementEntryPromotionSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !phpWasmRefinementEntryPromotionChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path
		&& item.currentSha256 === digest);
	return update
		? reversePhpWasmRefinementEntryPromotionUpdate(source, update) : source;
};
