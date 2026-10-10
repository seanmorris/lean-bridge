/**
 * Authenticate PHP-Wasm Subtype integration without changing earlier evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const phpWasmSubtypeHistoryPath = "docs/evidence/php-wasm-subtype-source-history-20261010.json";
export const phpWasmSubtypePredecessor = "bcc816d696f8285b4eaae6aa98d915f1a8a80b5f";
export const phpWasmSubtypeChangedPaths = [
	"docs/lean/existing-package.md"
	, "docs/php.md"
	, "docs/type-surface.v1.json"
	, "src/build/native-model.mjs"
	, "src/release/php-wasm-copied-package.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/php-wasm-direct-fin-promotion-history-tests.mjs"
	, "tests/helpers/php-wasm-direct-fin-promotion-history.mjs"
	, "tests/helpers/php-wasm-direct-fin-promotion-tests.mjs"
	, "tests/helpers/php-wasm-fin-fixtures.mjs"
	, "tests/native-refinement-boundaries.test.mjs"
	, "tests/php-wasm-fin.test.mjs"
];
let history;

/**
 * Reverse registered spans only after authenticating both complete sources.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reversePhpWasmSubtypeUpdate = (source, update) => {
	assert.ok(phpWasmSubtypeChangedPaths.includes(update.path));
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
export const beforePhpWasmSubtypeSource = (path, source, expected) => {
	if(typeof source !== "string" || !phpWasmSubtypeChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(phpWasmSubtypeHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reversePhpWasmSubtypeUpdate(source, update) : source;
};
