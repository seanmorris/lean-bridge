/**
 * Reverse the authenticated dependent/indexed PHP-Wasm entry measurement.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const phpWasmIndexedRefinementEntryHistoryPath
	= "docs/evidence/php-wasm-indexed-refinement-entry-source-history-20261022.json";
export const phpWasmIndexedRefinementEntryPredecessor
	= "650a34434da144ae283ac499c24c38a19c40c52c";
export const phpWasmIndexedRefinementEntryImplementation
	= "40b78afb4bd292d96bc7b15844b65aac346005ae";
export const phpWasmIndexedRefinementEntryUpdatedPaths = Object.freeze([
	"scripts/run-php-wasm-refinement-entry-ci.sh"
	, "tests/fixtures/php-wasm-refinement-entry/driver.mjs"
	, "tests/helpers/php-wasm-refinement-entry-build.mjs"
	, "tests/helpers/php-wasm-refinement-entry-callers-tests.mjs"
	, "tests/helpers/php-wasm-refinement-entry-callers.mjs"
	, "tests/helpers/php-wasm-refinement-entry-installed-tests.mjs"
	, "tests/helpers/php-wasm-refinement-entry-plan-tests.mjs"
	, "tests/helpers/php-wasm-refinement-entry-plan.mjs"
	, "tests/helpers/php-wasm-refinement-entry-report-tests.mjs"
	, "tests/helpers/php-wasm-refinement-entry-report.mjs"
	, "tests/helpers/php-wasm-refinement-entry-selection-tests.mjs"
	, "tests/helpers/php-wasm-refinement-entry-selection.mjs"
	, "tests/helpers/php-wasm-refinement-entry-source-fixtures.mjs"
	, "tests/helpers/php-wasm-refinement-entry-source-tests.mjs"
	, "tests/recursive-subtype-php-wasm.test.mjs"
]);
export const phpWasmIndexedRefinementEntryImplementationAdditions = Object.freeze([
	".github/workflows/php-wasm-indexed-refinement-entry.yml"
	, "tests/fixtures/php-wasm-refinement-entry/dependent-full.php"
	, "tests/fixtures/php-wasm-refinement-entry/dependent-result-only.php"
	, "tests/fixtures/php-wasm-refinement-entry/value-index-full.php"
	, "tests/fixtures/php-wasm-refinement-entry/value-index-result-only.php"
	, "tests/fixtures/php-wasm-refinement-entry/zero-payload-full.php"
	, "tests/fixtures/php-wasm-refinement-entry/zero-payload-result-only.php"
	, "tests/helpers/php-wasm-indexed-refinement-entry-ci-tests.mjs"
	, "tests/helpers/php-wasm-indexed-refinement-entry-fixtures.mjs"
]);
export const phpWasmIndexedRefinementEntryImplementationPaths = Object.freeze([
	...phpWasmIndexedRefinementEntryUpdatedPaths
	, ...phpWasmIndexedRefinementEntryImplementationAdditions
]);
export const phpWasmIndexedRefinementEntryIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/native-subtype.test.mjs"
]);
export const phpWasmIndexedRefinementEntryChangedPaths = Object.freeze([
	...phpWasmIndexedRefinementEntryUpdatedPaths
	, ...phpWasmIndexedRefinementEntryIntegrationPaths
]);
export const phpWasmIndexedRefinementEntryAddedPaths = Object.freeze([
	...phpWasmIndexedRefinementEntryImplementationAdditions
	, "scripts/update-php-wasm-indexed-refinement-entry-source-history.mjs"
	, "tests/helpers/php-wasm-indexed-refinement-entry-source-history-tests.mjs"
	, "tests/helpers/php-wasm-indexed-refinement-entry-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	phpWasmIndexedRefinementEntryHistoryPath, "utf8"));

/**
 * Restore one exact dependent/indexed entry source transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reversePhpWasmIndexedRefinementEntryUpdate = (source, update) => {
	assert.ok(phpWasmIndexedRefinementEntryChangedPaths.includes(update.path));
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
 * Remove only the exact dependent/indexed entry measurement milestone.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforePhpWasmIndexedRefinementEntrySource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !phpWasmIndexedRefinementEntryChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path
		&& item.currentSha256 === digest);
	return update
		? reversePhpWasmIndexedRefinementEntryUpdate(source, update) : source;
};
