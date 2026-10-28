/**
 * Reverse the explicit PHP-Wasm callback Subtype entry coverage.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const phpWasmCallbackSubtypeEntryHistoryPath
	= "docs/evidence/php-wasm-callback-subtype-entry-source-history-20261024.json";
export const phpWasmCallbackSubtypeEntryPredecessor
	= "ea29b1dc91b182f4a07885806e32f95e6300cb41";
export const phpWasmCallbackSubtypeEntryImplementation
	= "a0536e1ed272588a1702a9fe4b16445ded6f971d";
export const phpWasmCallbackSubtypeEntryIntegrationBase
	= "3f1c6a29e34eef6c61747398cff23349f8249cd3";
export const phpWasmCallbackSubtypeEntryChangedPaths = Object.freeze([
	"tests/fixtures/php-wasm-callback-entry/callback-checked-record.php"
	, "tests/fixtures/php-wasm-callback-entry/driver.mjs"
	, "tests/helpers/php-wasm-callback-entry-fixtures-tests.mjs"
	, "tests/helpers/php-wasm-callback-entry-fixtures.mjs"
	, "tests/helpers/php-wasm-callback-entry-installed-tests.mjs"
	, "tests/helpers/php-wasm-callback-entry-plan-tests.mjs"
	, "tests/helpers/php-wasm-callback-entry-plan.mjs"
	, "tests/helpers/php-wasm-callback-entry-report.mjs"
	, "tests/helpers/php-wasm-callback-entry-selection-tests.mjs"
	, "tests/helpers/php-wasm-callback-entry-selection.mjs"
	, "tests/helpers/php-wasm-callback-entry-source-fixtures.mjs"
]);
export const phpWasmCallbackSubtypeEntryImplementationAdditions = Object.freeze([
	"tests/fixtures/php-wasm-callback-entry/analyzer/callback-subtype-ordinary.identity.json"
	, "tests/fixtures/php-wasm-callback-entry/analyzer/callback-subtype-ordinary.model.json"
	, "tests/fixtures/php-wasm-callback-entry/callback-subtype.php"
]);
export const phpWasmCallbackSubtypeEntryIntegrationPaths = Object.freeze([
	".github/workflows/php-wasm-callback-entry.yml"
	, ".github/workflows/php-wasm-refinement-entry-promotion.yml"
	, "docs/lean/existing-package.md"
	, "docs/php.md"
	, "docs/publish/php.md"
	, "docs/reference/types.md"
	, "docs/type-surface.v1.json"
	, "scripts/run-php-wasm-callback-entry-ci.sh"
	, "tests/checked-javascript.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/php-wasm-callback-entry-ci-tests.mjs"
	, "tests/helpers/php-wasm-refinement-ci-matrix-tests.mjs"
	, "tests/helpers/php-wasm-refinement-ci-matrix.mjs"
	, "tests/helpers/php-wasm-refinement-entry-documentation-tests.mjs"
	, "tests/helpers/php-wasm-refinement-entry-hosted-summary-tests.mjs"
	, "tests/helpers/php-wasm-refinement-entry-matrix-tests.mjs"
	, "tests/helpers/php-wasm-refinement-entry-matrix.mjs"
	, "tests/helpers/php-wasm-refinement-entry-promotion-ci-tests.mjs"
	, "tests/helpers/php-wasm-refinement-entry-promotion-ci.mjs"
]);
export const phpWasmCallbackSubtypeEntryNormalizationPaths = Object.freeze([
	...phpWasmCallbackSubtypeEntryChangedPaths
	, ...phpWasmCallbackSubtypeEntryIntegrationPaths
]);
export const phpWasmCallbackSubtypeEntryAddedPaths = Object.freeze([
	"scripts/update-php-wasm-callback-subtype-entry-source-history.mjs"
	, "tests/helpers/php-wasm-callback-subtype-entry-source-history-tests.mjs"
	, "tests/helpers/php-wasm-callback-subtype-entry-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	phpWasmCallbackSubtypeEntryHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reversePhpWasmCallbackSubtypeEntryUpdate = (
	source, update
) => {
	assert.ok(phpWasmCallbackSubtypeEntryNormalizationPaths
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
 * Remove only the exact PHP-Wasm callback Subtype entry coverage.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforePhpWasmCallbackSubtypeEntrySource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !phpWasmCallbackSubtypeEntryNormalizationPaths.includes(path))
		return source;
	const value = record();
	const updates = [...value.integrationUpdates, ...value.updates];
	let current = source;
	for(let count = 0; count < updates.length; count++)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reversePhpWasmCallbackSubtypeEntryUpdate(current, update);
	}
	return current;
};
