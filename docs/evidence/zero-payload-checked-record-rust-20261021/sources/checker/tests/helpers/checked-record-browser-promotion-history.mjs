/**
 * Authenticate the checked-record browser support promotion while preserving earlier evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeCheckedRecordPhpWasmSource } from "./checked-record-php-wasm-history.mjs";

export const checkedRecordBrowserPromotionHistoryPath = "docs/evidence/checked-record-browser-promotion-source-history-20261011.json";
export const checkedRecordBrowserPromotionPredecessor = "0052726d1845afec0815feccbb104adaadbd4d95";
export const checkedRecordBrowserPromotionChangedPaths = [
	"docs/javascript-typescript.md"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "docs/reference/types.md"
	, "docs/type-surface.v1.json"
	, "scripts/generate-type-docs.mjs"
	, "tests/checked-records.test.mjs"
	, "tests/helpers/checked-record-browser-ci-history.mjs"
	, "tests/helpers/checked-record-perl-promotion-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/lean-author-documentation.test.mjs"
];
let history;

/**
 * Restore only a complete recorded transition with matching before/after digests.
 *
 * @param source - Current complete file text.
 * @param update - Exact immutable transition.
 */
export const reverseCheckedRecordBrowserPromotionUpdate = (source, update) => {
	assert.ok(checkedRecordBrowserPromotionChangedPaths.includes(update.path));
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
export const beforeCheckedRecordBrowserPromotionSource = (path, source, expected) => {
	source = beforeCheckedRecordPhpWasmSource(path, source, expected);
	if(typeof source !== "string" || !checkedRecordBrowserPromotionChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(checkedRecordBrowserPromotionHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseCheckedRecordBrowserPromotionUpdate(source, update) : source;
};
