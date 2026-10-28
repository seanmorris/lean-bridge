/**
 * Reverse the complete PHP-Wasm refinement entry topology milestone.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const phpWasmRefinementEntryMatrixHistoryPath
	= "docs/evidence/php-wasm-refinement-entry-matrix-source-history-20261022.json";
export const phpWasmRefinementEntryMatrixPredecessor
	= "42ffbb8b6a1562241039f3c8ca7f48cdadfe0824";
export const phpWasmRefinementEntryMatrixImplementation
	= "70eec0a2c0c51815cc48553ccb676391b30a9ffd";
export const phpWasmRefinementEntryMatrixUpdatedPaths = Object.freeze([
	"tests/php-wasm-fin.test.mjs"
]);
export const phpWasmRefinementEntryMatrixImplementationAdditions = Object.freeze([
	"tests/helpers/php-wasm-refinement-entry-matrix-tests.mjs"
	, "tests/helpers/php-wasm-refinement-entry-matrix.mjs"
]);
export const phpWasmRefinementEntryMatrixImplementationPaths = Object.freeze([
	...phpWasmRefinementEntryMatrixUpdatedPaths
	, ...phpWasmRefinementEntryMatrixImplementationAdditions
]);
export const phpWasmRefinementEntryMatrixIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
]);
export const phpWasmRefinementEntryMatrixChangedPaths = Object.freeze([
	...phpWasmRefinementEntryMatrixUpdatedPaths
	, ...phpWasmRefinementEntryMatrixIntegrationPaths
]);
export const phpWasmRefinementEntryMatrixAddedPaths = Object.freeze([
	...phpWasmRefinementEntryMatrixImplementationAdditions
	, "scripts/update-php-wasm-refinement-entry-matrix-source-history.mjs"
	, "tests/helpers/php-wasm-refinement-entry-matrix-source-history-tests.mjs"
	, "tests/helpers/php-wasm-refinement-entry-matrix-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	phpWasmRefinementEntryMatrixHistoryPath, "utf8"));

/**
 * Restore one exact entry-matrix source transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reversePhpWasmRefinementEntryMatrixUpdate = (source, update) => {
	assert.ok(phpWasmRefinementEntryMatrixChangedPaths.includes(update.path));
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
 * Remove only the exact PHP-Wasm refinement entry topology milestone.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforePhpWasmRefinementEntryMatrixSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !phpWasmRefinementEntryMatrixChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path
		&& item.currentSha256 === digest);
	return update
		? reversePhpWasmRefinementEntryMatrixUpdate(source, update) : source;
};
