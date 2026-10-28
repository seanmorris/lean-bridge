/**
 * Reverse the PHP-Wasm refinement-entry generator-closure transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const phpWasmRefinementEntryGeneratorClosureHistoryPath
	= "docs/evidence/php-wasm-refinement-entry-generator-closure-source-history-20261022.json";
export const phpWasmRefinementEntryGeneratorClosurePredecessor
	= "fcec9453137799bea805c347313f1c361093d0d8";
export const phpWasmRefinementEntryGeneratorClosureImplementation
	= "4ac6688f7d925312da8e4a1ff4da9a09d4a76ea8";
export const phpWasmRefinementEntryGeneratorClosureImplementationPaths
	= Object.freeze([
		"scripts/generate-type-docs.mjs"
		, "tests/callback-subtype-promotion.test.mjs"
	]);
export const phpWasmRefinementEntryGeneratorClosureModifiedPaths
	= phpWasmRefinementEntryGeneratorClosureImplementationPaths;
export const phpWasmRefinementEntryGeneratorClosureIntegrationPaths
	= Object.freeze([
		"tests/helpers/fin-refinement-source-history.mjs"
		, "tests/php-wasm-fin.test.mjs"
	]);
export const phpWasmRefinementEntryGeneratorClosureChangedPaths
	= Object.freeze([
		...phpWasmRefinementEntryGeneratorClosureModifiedPaths
		, ...phpWasmRefinementEntryGeneratorClosureIntegrationPaths
	]);
export const phpWasmRefinementEntryGeneratorClosureAddedPaths = Object.freeze([
	"scripts/update-php-wasm-refinement-entry-generator-closure-source-history.mjs"
	, "tests/helpers/php-wasm-refinement-entry-generator-closure-source-history-tests.mjs"
	, "tests/helpers/php-wasm-refinement-entry-generator-closure-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	phpWasmRefinementEntryGeneratorClosureHistoryPath, "utf8"));

/**
 * Restore one exact transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reversePhpWasmRefinementEntryGeneratorClosureUpdate
	= (source, update) => {
		assert.ok(phpWasmRefinementEntryGeneratorClosureChangedPaths
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
 * Remove only the exact PHP-Wasm refinement-entry generator closure.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforePhpWasmRefinementEntryGeneratorClosureSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !phpWasmRefinementEntryGeneratorClosureChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const data = record();
	const update = [...data.updates, ...data.integrationUpdates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reversePhpWasmRefinementEntryGeneratorClosureUpdate(source, update)
		: source;
};
