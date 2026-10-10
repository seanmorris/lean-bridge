/**
 * Authenticate PHP-Wasm Subtype entry probe integration without changing earlier evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const phpWasmSubtypeEntryHistoryPath = "docs/evidence/php-wasm-subtype-entry-source-history-20261010.json";
export const phpWasmSubtypeEntryPredecessor = "6ac0d2bacfb0ff53b4698a5310f3f3e5e45ad5d3";
export const phpWasmSubtypeEntryChangedPaths = [
	"docs/type-surface.v1.json"
	, "tests/helpers/fin-jvm-diagnostics-history-tests.mjs"
	, "tests/helpers/fin-jvm-diagnostics-history.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/php-wasm-direct-fin-promotion-tests.mjs"
	, "tests/helpers/php-wasm-subtype-promotion-tests.mjs"
	, "tests/php-wasm-fin.test.mjs"
];
let history;

/**
 * Reverse registered spans only after authenticating both complete sources.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reversePhpWasmSubtypeEntryUpdate = (source, update) => {
	assert.ok(phpWasmSubtypeEntryChangedPaths.includes(update.path));
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
 * Restore only authenticated predecessors, preserving requested stopping digests.
 *
 * @param path - Repository-relative path.
 * @param source - Complete source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforePhpWasmSubtypeEntrySource = (path, source, expected) => {
	if(typeof source !== "string" || !phpWasmSubtypeEntryChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(phpWasmSubtypeEntryHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reversePhpWasmSubtypeEntryUpdate(source, update) : source;
};
