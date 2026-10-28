/**
 * Reverse the PHP-Wasm refinement-entry documentation precision correction.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const phpWasmRefinementEntryDocumentationPrecisionHistoryPath
	= "docs/evidence/php-wasm-refinement-entry-documentation-precision-source-history-20261022.json";
export const phpWasmRefinementEntryDocumentationPrecisionPredecessor
	= "a9b6b2f2a34a2cfbf6171ff608e32877e39246f2";
export const phpWasmRefinementEntryDocumentationPrecisionImplementation
	= "ad44953855e63d3a5af288f9f76911362f6890d5";
export const phpWasmRefinementEntryDocumentationPrecisionImplementationPaths
	= Object.freeze([
		"docs/lean/existing-package.md"
		, "docs/php.md"
		, "docs/publish/php.md"
		, "docs/reference/types.md"
		, "tests/helpers/php-wasm-refinement-entry-documentation-tests.mjs"
	]);
export const phpWasmRefinementEntryDocumentationPrecisionIntegrationPaths
	= Object.freeze([
		"tests/helpers/fin-refinement-source-history.mjs"
		, "tests/php-wasm-fin.test.mjs"
	]);
export const phpWasmRefinementEntryDocumentationPrecisionChangedPaths
	= Object.freeze([
		...phpWasmRefinementEntryDocumentationPrecisionImplementationPaths
		, ...phpWasmRefinementEntryDocumentationPrecisionIntegrationPaths
	]);
export const phpWasmRefinementEntryDocumentationPrecisionAddedPaths
	= Object.freeze([
		"scripts/update-php-wasm-refinement-entry-documentation-precision-source-history.mjs"
		, "tests/helpers/php-wasm-refinement-entry-documentation-precision-source-history-tests.mjs"
		, "tests/helpers/php-wasm-refinement-entry-documentation-precision-source-history.mjs"
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	phpWasmRefinementEntryDocumentationPrecisionHistoryPath, "utf8"));

/**
 * Restore one exact source transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reversePhpWasmRefinementEntryDocumentationPrecisionUpdate
	= (source, update) => {
		assert.ok(phpWasmRefinementEntryDocumentationPrecisionChangedPaths
			.includes(update.path));
		assert.equal(sha256(source), update.currentSha256, update.path);
		assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
		let cursor = 0;
		const parts = [];
		for(const edit of update.edits)
		{
			assert.deepEqual(Object.keys(edit).sort()
				, ["current", "previous", "start"]);
			assert.ok(Number.isSafeInteger(edit.start)
				&& edit.start >= cursor && edit.start <= source.length);
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
 * Remove only the exact documentation precision correction.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforePhpWasmRefinementEntryDocumentationPrecisionSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !phpWasmRefinementEntryDocumentationPrecisionChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const data = record();
	const update = [...data.updates, ...data.integrationUpdates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reversePhpWasmRefinementEntryDocumentationPrecisionUpdate(source, update)
		: source;
};
