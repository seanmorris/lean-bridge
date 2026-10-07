/**
 * Preserve exact source predecessors of the PHP-Wasm Fin admission change (#1443).
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const phpWasmFinHistoryPath = "docs/evidence/php-wasm-fin-source-history-20261007.json";
export const phpWasmFinChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "docs/lean/existing-package.md"
	, "docs/type-surface.v1.json"
	, "src/adoption/test-profiles.mjs"
	, "src/build/native-model.mjs"
	, "src/build/php-wasm-graph-model.mjs"
	, "src/release/php-wasm-copied-package.mjs"
	, "tests/documentation.test.mjs"
	, "tests/helpers/fin-record-model.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/native-fin-records-source-history.mjs"
	, "tests/helpers/native-fin-records-source-history-tests.mjs"
	, "tests/native-refinement-boundaries.test.mjs"
];
let history;

/**
 * Reverse registered spans only when both complete source hashes match.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reversePhpWasmFinUpdate = (source, update) => {
	assert.ok(phpWasmFinChangedPaths.includes(update.path));
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
 * Restore the source before #1443, stopping at an explicitly requested identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforePhpWasmFinSource = (path, source, expected) => {
	if(typeof source !== "string" || !phpWasmFinChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(phpWasmFinHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reversePhpWasmFinUpdate(source, update) : source;
};
