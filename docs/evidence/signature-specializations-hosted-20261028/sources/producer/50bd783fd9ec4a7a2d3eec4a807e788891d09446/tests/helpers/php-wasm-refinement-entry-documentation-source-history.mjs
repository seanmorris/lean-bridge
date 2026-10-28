/**
 * Reverse the PHP-Wasm refinement-entry documentation boundary milestone.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const phpWasmRefinementEntryDocumentationHistoryPath
	= "docs/evidence/php-wasm-refinement-entry-documentation-source-history-20261022.json";
export const phpWasmRefinementEntryDocumentationPredecessor
	= "4553a2910f10725118b532b480820ad7907afc3e";
export const phpWasmRefinementEntryDocumentationImplementation
	= "34df06d23a68827be9ac2388b5d0035f4c001de0";
export const phpWasmRefinementEntryDocumentationUpdatedPaths = Object.freeze([
	"docs/lean/existing-package.md"
	, "docs/php.md"
	, "docs/publish/php.md"
	, "docs/reference/types.md"
	, "docs/type-surface.v1.json"
	, "tests/php-wasm-fin.test.mjs"
]);
export const phpWasmRefinementEntryDocumentationImplementationAdditions
	= Object.freeze([
		"tests/helpers/php-wasm-refinement-entry-documentation-tests.mjs"
	]);
export const phpWasmRefinementEntryDocumentationImplementationPaths = Object.freeze([
	...phpWasmRefinementEntryDocumentationUpdatedPaths
	, ...phpWasmRefinementEntryDocumentationImplementationAdditions
]);
export const phpWasmRefinementEntryDocumentationIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
]);
export const phpWasmRefinementEntryDocumentationChangedPaths = Object.freeze([
	...phpWasmRefinementEntryDocumentationUpdatedPaths
	, ...phpWasmRefinementEntryDocumentationIntegrationPaths
]);
export const phpWasmRefinementEntryDocumentationAddedPaths = Object.freeze([
	...phpWasmRefinementEntryDocumentationImplementationAdditions
	, "scripts/update-php-wasm-refinement-entry-documentation-source-history.mjs"
	, "tests/helpers/php-wasm-refinement-entry-documentation-source-history-tests.mjs"
	, "tests/helpers/php-wasm-refinement-entry-documentation-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	phpWasmRefinementEntryDocumentationHistoryPath, "utf8"));

/**
 * Restore one exact entry-documentation source transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reversePhpWasmRefinementEntryDocumentationUpdate = (source, update) => {
	assert.ok(phpWasmRefinementEntryDocumentationChangedPaths.includes(update.path));
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
 * Remove only the exact documentation-boundary milestone.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforePhpWasmRefinementEntryDocumentationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !phpWasmRefinementEntryDocumentationChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path
		&& item.currentSha256 === digest);
	return update
		? reversePhpWasmRefinementEntryDocumentationUpdate(source, update) : source;
};
