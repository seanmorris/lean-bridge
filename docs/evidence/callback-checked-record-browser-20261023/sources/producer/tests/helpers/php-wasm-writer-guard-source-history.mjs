/**
 * Authenticate PHP-Wasm history-writer guard repair as one exact, reversible
 * source transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const phpWasmWriterGuardHistoryPath
	= "docs/evidence/php-wasm-writer-guard-source-history-20261017.json";
export const phpWasmWriterGuardPredecessor
	= "d0f239bba51c8e0e79fa33a0c21107734cf55a04";
export const phpWasmWriterGuardDraftParent
	= "6046a8c0b5a98df685cad0b044e49de6489ec6af";
export const phpWasmWriterGuardChangedPaths = Object.freeze([
	"scripts/update-php-wasm-direct-fin-promotion-history.mjs"
	, "src/adoption/test-profiles.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const phpWasmWriterGuardAddedPaths = Object.freeze([
	"scripts/update-php-wasm-writer-guard-source-history.mjs"
	, "tests/helpers/php-wasm-writer-guard-source-history.mjs"
	, "tests/php-wasm-writer-guard-source-history.test.mjs"
]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	phpWasmWriterGuardHistoryPath, "utf8"
));

/**
 * Reverse one exact PHP-Wasm writer guard transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reversePhpWasmWriterGuardUpdate = (source, update) => {
	assert.ok(phpWasmWriterGuardChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
		assert.equal(typeof edit.previous, "string");
		assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start
			, edit.start + edit.current.length), edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only this PHP-Wasm history-writer guard repair from exact current source.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforePhpWasmWriterGuardSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !phpWasmWriterGuardChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reversePhpWasmWriterGuardUpdate(source, update)
		: source;
};
