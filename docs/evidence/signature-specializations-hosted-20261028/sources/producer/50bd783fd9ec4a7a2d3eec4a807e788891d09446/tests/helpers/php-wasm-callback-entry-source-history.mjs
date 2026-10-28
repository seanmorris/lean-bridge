/**
 * Reverse the authenticated synchronous callback-entry PHP-Wasm measurement.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const phpWasmCallbackEntryHistoryPath
	= "docs/evidence/php-wasm-callback-entry-source-history-20261022.json";
export const phpWasmCallbackEntryPredecessor
	= "7bfe1c35be3e3321f37a051870169ab1a58063a4";
export const phpWasmCallbackEntryImplementation
	= "73ccff54a71e4d00efd8b5a1b1fc7153f8e22554";
export const phpWasmCallbackEntryUpdatedPaths = Object.freeze([
	"tests/callback-refinements-php-wasm.test.mjs"
	, "tests/helpers/php-wasm-refinement-entry-build-tests.mjs"
	, "tests/helpers/php-wasm-refinement-entry-build.mjs"
]);
export const phpWasmCallbackEntryImplementationAdditions = Object.freeze([
	".github/workflows/php-wasm-callback-entry.yml"
	, "scripts/check-php-wasm-callback-entry-records.mjs"
	, "scripts/run-php-wasm-callback-entry-ci.sh"
	, "tests/fixtures/php-wasm-callback-entry/callback-checked-record.php"
	, "tests/fixtures/php-wasm-callback-entry/callback-fin.php"
	, "tests/fixtures/php-wasm-callback-entry/driver.mjs"
	, "tests/helpers/php-wasm-callback-entry-build.mjs"
	, "tests/helpers/php-wasm-callback-entry-c-tests.mjs"
	, "tests/helpers/php-wasm-callback-entry-c.mjs"
	, "tests/helpers/php-wasm-callback-entry-ci-tests.mjs"
	, "tests/helpers/php-wasm-callback-entry-driver-tests.mjs"
	, "tests/helpers/php-wasm-callback-entry-fixtures-tests.mjs"
	, "tests/helpers/php-wasm-callback-entry-fixtures.mjs"
	, "tests/helpers/php-wasm-callback-entry-installed-tests.mjs"
	, "tests/helpers/php-wasm-callback-entry-plan-tests.mjs"
	, "tests/helpers/php-wasm-callback-entry-plan.mjs"
	, "tests/helpers/php-wasm-callback-entry-report-tests.mjs"
	, "tests/helpers/php-wasm-callback-entry-report.mjs"
	, "tests/helpers/php-wasm-callback-entry-selection-tests.mjs"
	, "tests/helpers/php-wasm-callback-entry-selection.mjs"
	, "tests/helpers/php-wasm-callback-entry-source-fixtures.mjs"
	, "tests/helpers/php-wasm-callback-entry-source-tests.mjs"
	, "tests/helpers/php-wasm-callback-entry-trace.mjs"
]);
export const phpWasmCallbackEntryImplementationPaths = Object.freeze([
	...phpWasmCallbackEntryUpdatedPaths
	, ...phpWasmCallbackEntryImplementationAdditions
]);
export const phpWasmCallbackEntryIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
]);
export const phpWasmCallbackEntryChangedPaths = Object.freeze([
	...phpWasmCallbackEntryUpdatedPaths
	, ...phpWasmCallbackEntryIntegrationPaths
]);
export const phpWasmCallbackEntryAddedPaths = Object.freeze([
	...phpWasmCallbackEntryImplementationAdditions
	, "scripts/update-php-wasm-callback-entry-source-history.mjs"
	, "tests/helpers/php-wasm-callback-entry-source-history-tests.mjs"
	, "tests/helpers/php-wasm-callback-entry-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	phpWasmCallbackEntryHistoryPath, "utf8"));

/**
 * Restore one exact synchronous callback-entry source transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reversePhpWasmCallbackEntryUpdate = (source, update) => {
	assert.ok(phpWasmCallbackEntryChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
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
 * Remove only the exact synchronous callback-entry milestone.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforePhpWasmCallbackEntrySource = (path, source, expected) => {
	if(typeof source !== "string" || !phpWasmCallbackEntryChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path
		&& item.currentSha256 === digest);
	return update ? reversePhpWasmCallbackEntryUpdate(source, update) : source;
};
