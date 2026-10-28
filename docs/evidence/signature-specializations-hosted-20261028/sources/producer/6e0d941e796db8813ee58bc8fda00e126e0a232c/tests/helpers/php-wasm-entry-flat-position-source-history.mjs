/**
 * Reverse the PHP-Wasm entry flat-position plan.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const phpWasmEntryFlatPositionHistoryPath
	= "docs/evidence/php-wasm-entry-flat-position-source-history-20261024.json";
export const phpWasmEntryFlatPositionPredecessor
	= "365fc25becae54113f6fde7678ed3dbeb3526446";
export const phpWasmEntryFlatPositionImplementation
	= "7618ba333ff167fcc11e1efbf2a295650263a196";
export const phpWasmEntryFlatPositionChangedPaths = Object.freeze([
	"tests/fixtures/php-wasm-refinement-entry/nominal-full.php"
	, "tests/fixtures/php-wasm-refinement-entry/nominal-result-only.php"
	, "tests/helpers/php-wasm-refinement-entry-plan-tests.mjs"
	, "tests/helpers/php-wasm-refinement-entry-plan.mjs"
	, "tests/helpers/php-wasm-refinement-entry-report.mjs"
]);
export const phpWasmEntryFlatPositionIntegrationPaths = Object.freeze([
	"tests/component-array-contract.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const phpWasmEntryFlatPositionNormalizationPaths = Object.freeze([
	...phpWasmEntryFlatPositionChangedPaths
	, ...phpWasmEntryFlatPositionIntegrationPaths
]);
export const phpWasmEntryFlatPositionAddedPaths = Object.freeze([
	"scripts/update-php-wasm-entry-flat-position-source-history.mjs"
	, "tests/helpers/php-wasm-entry-flat-position-source-history-tests.mjs"
	, "tests/helpers/php-wasm-entry-flat-position-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	phpWasmEntryFlatPositionHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param {string} source - Complete current source text.
 * @param {object} update - Exact recorded transition.
 */
export const reversePhpWasmEntryFlatPositionUpdate = (
	source, update
) => {
	assert.ok(phpWasmEntryFlatPositionNormalizationPaths
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
 * Remove only the exact PHP-Wasm entry flat-position plan.
 *
 * @param {string} path - Repository-relative source path.
 * @param {string} source - Complete current or historical source.
 * @param {string} [expected] - Optional digest at which normalization stops.
 */
export const beforePhpWasmEntryFlatPositionSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !phpWasmEntryFlatPositionNormalizationPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = [...value.integrationUpdates, ...value.updates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update === undefined ? source
		: reversePhpWasmEntryFlatPositionUpdate(source, update);
};
