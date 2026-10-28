/**
 * Reverse the compiler-derived PHP-Wasm entry call-path oracle.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const phpWasmEntryCallPathHistoryPath
	= "docs/evidence/php-wasm-entry-call-path-source-history-20261024.json";
export const phpWasmEntryCallPathPredecessor
	= "390ae18d3a2607bc73463767a33fea0cfb9350b0";
export const phpWasmEntryCallPathImplementation
	= "18755a4be0d2373b33e36159290e14ada31d8907";
export const phpWasmEntryCallPathChangedPaths = Object.freeze([
	".github/workflows/php-wasm-callback-entry.yml"
	, ".github/workflows/php-wasm-indexed-refinement-entry.yml"
	, ".github/workflows/php-wasm-owned-refinement-entry.yml"
	, ".github/workflows/php-wasm-refinement-entry.yml"
	, "tests/fixtures/php-wasm-refinement-entry/driver.mjs"
	, "tests/helpers/php-wasm-entry-probe-deployment-tests.mjs"
	, "tests/helpers/php-wasm-owned-refinement-entry-installed-tests.mjs"
	, "tests/helpers/php-wasm-owned-refinement-entry-plan-tests.mjs"
	, "tests/helpers/php-wasm-owned-refinement-entry-plan.mjs"
	, "tests/helpers/php-wasm-refinement-entry-driver-tests.mjs"
	, "tests/helpers/php-wasm-refinement-entry-installed-tests.mjs"
	, "tests/helpers/php-wasm-refinement-entry-plan-tests.mjs"
	, "tests/helpers/php-wasm-refinement-entry-plan.mjs"
	, "tests/helpers/php-wasm-refinement-entry-report-tests.mjs"
	, "tests/helpers/php-wasm-refinement-entry-report.mjs"
	, "tests/helpers/type-corpus-php-wasm-install.mjs"
]);
export const phpWasmEntryCallPathIntegrationPaths = Object.freeze([
	"tests/component-array-contract.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const phpWasmEntryCallPathNormalizationPaths = Object.freeze([
	...phpWasmEntryCallPathChangedPaths
	, ...phpWasmEntryCallPathIntegrationPaths
]);
export const phpWasmEntryCallPathImplementationAdditions = Object.freeze([
	"tests/helpers/php-wasm-entry-call-targets.mjs"
]);
export const phpWasmEntryCallPathAddedPaths = Object.freeze([
	"scripts/update-php-wasm-entry-call-path-source-history.mjs"
	, "tests/helpers/php-wasm-entry-call-path-source-history-tests.mjs"
	, "tests/helpers/php-wasm-entry-call-path-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	phpWasmEntryCallPathHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param {string} source - Complete current source text.
 * @param {object} update - Exact recorded transition.
 */
export const reversePhpWasmEntryCallPathUpdate = (
	source, update
) => {
	assert.ok(phpWasmEntryCallPathNormalizationPaths
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
 * Remove only the exact PHP-Wasm entry call-path oracle.
 *
 * @param {string} path - Repository-relative source path.
 * @param {string} source - Complete current or historical source.
 * @param {string} [expected] - Optional digest at which normalization stops.
 */
export const beforePhpWasmEntryCallPathSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !phpWasmEntryCallPathNormalizationPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = [...value.integrationUpdates, ...value.updates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update === undefined ? source
		: reversePhpWasmEntryCallPathUpdate(source, update);
};
