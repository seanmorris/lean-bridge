/**
 * Authenticate the checked-record PHP-Wasm CI without changing installed support.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const checkedRecordPhpWasmCiHistoryPath = "docs/evidence/checked-record-php-wasm-ci-source-history-20261011.json";
export const checkedRecordPhpWasmCiPredecessor = "d65842fa5ac87dda2a364adc43c510685730027c";
export const checkedRecordPhpWasmCiChangedPaths = [
	"tests/checked-records.test.mjs"
	, "tests/helpers/checked-record-php-wasm-archive-history.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
];
let history;

/**
 * Restore only a complete recorded transition with matching before/after digests.
 *
 * @param source - Current complete file text.
 * @param update - Exact immutable transition.
 */
export const reverseCheckedRecordPhpWasmCiUpdate = (source, update) => {
	assert.ok(checkedRecordPhpWasmCiChangedPaths.includes(update.path));
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
export const beforeCheckedRecordPhpWasmCiSource = (path, source, expected) => {
	if(typeof source !== "string" || !checkedRecordPhpWasmCiChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(checkedRecordPhpWasmCiHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseCheckedRecordPhpWasmCiUpdate(source, update) : source;
};
