/**
 * Reverse the authenticated owned-refinement PHP-Wasm entry measurement layer.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const phpWasmOwnedRefinementEntryHistoryPath
	= "docs/evidence/php-wasm-owned-refinement-entry-source-history-20261022.json";
export const phpWasmOwnedRefinementEntryPredecessor
	= "936cda7456a0aa35c801311e9a60e9210a62efd9";
export const phpWasmOwnedRefinementEntryImplementation
	= "6d03992c2d1c896f1bd986ded176bb33721954cc";
export const phpWasmOwnedRefinementEntryUpdatedPaths = Object.freeze([
	"tests/fixtures/php-wasm-refinement-entry/driver.mjs"
	, "tests/helpers/php-wasm-refinement-entry-build-tests.mjs"
	, "tests/helpers/php-wasm-refinement-entry-build.mjs"
	, "tests/helpers/php-wasm-refinement-entry-driver-tests.mjs"
	, "tests/helpers/php-wasm-refinement-entry-report-tests.mjs"
	, "tests/helpers/php-wasm-refinement-entry-report.mjs"
	, "tests/native-subtype.test.mjs"
]);
export const phpWasmOwnedRefinementEntryImplementationAdditions = Object.freeze([
	".github/workflows/php-wasm-owned-refinement-entry.yml"
	, "scripts/run-php-wasm-owned-refinement-entry-ci.sh"
	, "tests/fixtures/php-wasm-refinement-entry/owned-checked-record.php"
	, "tests/fixtures/php-wasm-refinement-entry/owned-subtype.php"
	, "tests/helpers/php-wasm-owned-refinement-entry-build.mjs"
	, "tests/helpers/php-wasm-owned-refinement-entry-ci-tests.mjs"
	, "tests/helpers/php-wasm-owned-refinement-entry-fixtures-tests.mjs"
	, "tests/helpers/php-wasm-owned-refinement-entry-fixtures.mjs"
	, "tests/helpers/php-wasm-owned-refinement-entry-installed-tests.mjs"
	, "tests/helpers/php-wasm-owned-refinement-entry-plan-tests.mjs"
	, "tests/helpers/php-wasm-owned-refinement-entry-plan.mjs"
	, "tests/helpers/php-wasm-owned-refinement-entry-selection-tests.mjs"
	, "tests/helpers/php-wasm-owned-refinement-entry-selection.mjs"
	, "tests/helpers/php-wasm-owned-refinement-entry-source-fixtures.mjs"
	, "tests/helpers/php-wasm-owned-refinement-entry-source-tests.mjs"
]);
export const phpWasmOwnedRefinementEntryImplementationPaths = Object.freeze([
	...phpWasmOwnedRefinementEntryUpdatedPaths
	, ...phpWasmOwnedRefinementEntryImplementationAdditions
]);
export const phpWasmOwnedRefinementEntryIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
]);
export const phpWasmOwnedRefinementEntryChangedPaths = Object.freeze([
	...phpWasmOwnedRefinementEntryUpdatedPaths
	, ...phpWasmOwnedRefinementEntryIntegrationPaths
]);
export const phpWasmOwnedRefinementEntryAddedPaths = Object.freeze([
	...phpWasmOwnedRefinementEntryImplementationAdditions
	, "scripts/update-php-wasm-owned-refinement-entry-source-history.mjs"
	, "tests/helpers/php-wasm-owned-refinement-entry-source-history-tests.mjs"
	, "tests/helpers/php-wasm-owned-refinement-entry-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	phpWasmOwnedRefinementEntryHistoryPath, "utf8"));

/**
 * Restore one exact owned-refinement entry source transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reversePhpWasmOwnedRefinementEntryUpdate = (source, update) => {
	assert.ok(phpWasmOwnedRefinementEntryChangedPaths.includes(update.path));
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
 * Remove only this exact owned-refinement entry measurement milestone.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforePhpWasmOwnedRefinementEntrySource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !phpWasmOwnedRefinementEntryChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path
		&& item.currentSha256 === digest);
	return update
		? reversePhpWasmOwnedRefinementEntryUpdate(source, update)
		: source;
};
