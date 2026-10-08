/**
 * Preserve exact predecessors of the PHP-Wasm Fin support promotion.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const phpWasmFinPromotionHistoryPath = "docs/evidence/php-wasm-fin-promotion-source-history-20261008.json";
export const phpWasmFinPromotionChangedPaths = [
	"docs/type-surface.v1.json"
	, "docs/php.md"
	, "docs/lean/existing-package.md"
	, "docs/evidence/refinement-closure-audit-20261007.md"
	, "tests/php-wasm-fin.test.mjs"
	, "tests/type-surface.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/native-consumer-ci-repair-source-history.mjs"
	, "tests/helpers/native-consumer-ci-repair-source-history-tests.mjs"
];
let history;

/**
 * Reverse only authenticated spans with matching complete before/after identities.
 *
 * @param source - Complete source text.
 * @param update - Exact recorded transition.
 */
export const reversePhpWasmFinPromotionUpdate = (source, update) => {
	assert.ok(phpWasmFinPromotionChangedPaths.includes(update.path));
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
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Restore the pre-promotion source, stopping at an explicitly requested identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforePhpWasmFinPromotionSource = (path, source, expected) => {
	if(typeof source !== "string" || !phpWasmFinPromotionChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(phpWasmFinPromotionHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reversePhpWasmFinPromotionUpdate(source, update) : source;
};
