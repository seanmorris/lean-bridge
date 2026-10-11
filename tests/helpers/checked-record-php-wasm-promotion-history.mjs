/**
 * Authenticate the checked-record PHP-Wasm support promotion while preserving earlier evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const checkedRecordPhpWasmPromotionHistoryPath = "docs/evidence/checked-record-php-wasm-promotion-source-history-20261011.json";
export const checkedRecordPhpWasmPromotionPredecessor = "c3a115752a174e18a6e2f07c64718e5be4d641d3";
export const checkedRecordPhpWasmPromotionChangedPaths = [
	"docs/php.md"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "docs/reference/types.md"
	, "docs/type-surface.v1.json"
	, "scripts/generate-type-docs.mjs"
	, "tests/checked-records.test.mjs"
	, "tests/helpers/checked-record-php-wasm-ci-history.mjs"
	, "tests/helpers/checked-record-native-promotion-tests.mjs"
	, "tests/helpers/checked-record-perl-promotion-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/lean-author-documentation.test.mjs"
	, "tests/type-surface.test.mjs"
];
let history;

/**
 * Restore only a complete recorded transition with matching before/after digests.
 *
 * @param source - Current complete file text.
 * @param update - Exact immutable transition.
 */
export const reverseCheckedRecordPhpWasmPromotionUpdate = (source, update) => {
	assert.ok(checkedRecordPhpWasmPromotionChangedPaths.includes(update.path));
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
 * Preserve unknown edits and exact requested stopping points.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete source text.
 * @param expected - Optional stopping digest.
 */
export const beforeCheckedRecordPhpWasmPromotionSource = (path, source, expected) => {
	if(typeof source !== "string" || !checkedRecordPhpWasmPromotionChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(checkedRecordPhpWasmPromotionHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseCheckedRecordPhpWasmPromotionUpdate(source, update) : source;
};
