/**
 * Authenticate the checked-record PHP-Wasm foundation without changing installed support.
 *
 * @file
 */
import assert from "node:assert/strict";
import { beforeCheckedRecordPhpWasmArchiveSource } from "./checked-record-php-wasm-archive-history.mjs";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const checkedRecordPhpWasmHistoryPath = "docs/evidence/checked-record-php-wasm-source-history-20261011.json";
export const checkedRecordPhpWasmPredecessor = "ebad9755490619052a87c1385af49f669ac48f86";
export const checkedRecordPhpWasmChangedPaths = [
	"tests/checked-records.test.mjs"
	, "tests/helpers/checked-record-browser-promotion-history.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
];
let history;

/**
 * Restore only a complete recorded transition with matching before/after digests.
 *
 * @param source - Current complete file text.
 * @param update - Exact immutable transition.
 */
export const reverseCheckedRecordPhpWasmUpdate = (source, update) => {
	assert.ok(checkedRecordPhpWasmChangedPaths.includes(update.path));
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
export const beforeCheckedRecordPhpWasmSource = (path, source, expected) => {
	source = beforeCheckedRecordPhpWasmArchiveSource(path, source, expected);
	if(typeof source !== "string" || !checkedRecordPhpWasmChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(checkedRecordPhpWasmHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseCheckedRecordPhpWasmUpdate(source, update) : source;
};
