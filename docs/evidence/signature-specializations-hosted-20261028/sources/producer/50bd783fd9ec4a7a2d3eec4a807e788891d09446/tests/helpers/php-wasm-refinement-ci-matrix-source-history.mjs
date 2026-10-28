/**
 * Reverse the complete PHP-Wasm refinement CI matrix audit.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const phpWasmRefinementCiMatrixHistoryPath
	= "docs/evidence/php-wasm-refinement-ci-matrix-source-history-20261022.json";
export const phpWasmRefinementCiMatrixPredecessor
	= "fe5424900e0ebaa6717a0f1a00be8e5d77c3a8a1";
export const phpWasmRefinementCiMatrixImplementation
	= "107b6d94b484382b442b1662a729ee2854427a22";
export const phpWasmRefinementCiMatrixUpdatedPaths = Object.freeze([
	"tests/php-wasm-fin.test.mjs"
]);
export const phpWasmRefinementCiMatrixImplementationAdditions = Object.freeze([
	"tests/helpers/php-wasm-refinement-ci-matrix-tests.mjs"
	, "tests/helpers/php-wasm-refinement-ci-matrix.mjs"
]);
export const phpWasmRefinementCiMatrixImplementationPaths = Object.freeze([
	...phpWasmRefinementCiMatrixUpdatedPaths
	, ...phpWasmRefinementCiMatrixImplementationAdditions
]);
export const phpWasmRefinementCiMatrixIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
]);
export const phpWasmRefinementCiMatrixChangedPaths = Object.freeze([
	...phpWasmRefinementCiMatrixUpdatedPaths
	, ...phpWasmRefinementCiMatrixIntegrationPaths
]);
export const phpWasmRefinementCiMatrixAddedPaths = Object.freeze([
	...phpWasmRefinementCiMatrixImplementationAdditions
	, "scripts/update-php-wasm-refinement-ci-matrix-source-history.mjs"
	, "tests/helpers/php-wasm-refinement-ci-matrix-source-history-tests.mjs"
	, "tests/helpers/php-wasm-refinement-ci-matrix-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	phpWasmRefinementCiMatrixHistoryPath, "utf8"));

/**
 * Restore one exact CI-matrix source transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reversePhpWasmRefinementCiMatrixUpdate = (source, update) => {
	assert.ok(phpWasmRefinementCiMatrixChangedPaths.includes(update.path));
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
 * Remove only the exact complete PHP-Wasm refinement CI matrix audit.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforePhpWasmRefinementCiMatrixSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !phpWasmRefinementCiMatrixChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path
		&& item.currentSha256 === digest);
	return update ? reversePhpWasmRefinementCiMatrixUpdate(source, update) : source;
};
