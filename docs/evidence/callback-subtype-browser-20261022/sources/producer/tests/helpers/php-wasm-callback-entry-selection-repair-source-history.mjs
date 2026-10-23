/**
 * Reverse the PHP-Wasm callback-entry selection closure repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const phpWasmCallbackEntrySelectionRepairHistoryPath
	= "docs/evidence/php-wasm-callback-entry-selection-repair-source-history-20261023.json";
export const phpWasmCallbackEntrySelectionRepairPredecessor
	= "7c43d3b2d6e0c78b52d5257b529ca4e240dcdd40";
export const phpWasmCallbackEntrySelectionRepairImplementation
	= "e5ac63988e7831f022d496b79f8a26c1d00ebfb4";
export const phpWasmCallbackEntrySelectionRepairChangedPaths = Object.freeze([
	"tests/helpers/php-wasm-callback-entry-installed-tests.mjs"
	, "tests/helpers/php-wasm-callback-entry-selection-tests.mjs"
	, "tests/helpers/php-wasm-callback-entry-selection.mjs"
]);
export const phpWasmCallbackEntrySelectionRepairIntegrationPaths
	= Object.freeze([
		"tests/callback-refinements-php-wasm.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const phpWasmCallbackEntrySelectionRepairNormalizationPaths
	= Object.freeze([
		...phpWasmCallbackEntrySelectionRepairChangedPaths
		, ...phpWasmCallbackEntrySelectionRepairIntegrationPaths
	]);
export const phpWasmCallbackEntrySelectionRepairAddedPaths = Object.freeze([
	"scripts/update-php-wasm-callback-entry-selection-repair-source-history.mjs"
	, "tests/helpers/php-wasm-callback-entry-selection-repair-source-history-tests.mjs"
	, "tests/helpers/php-wasm-callback-entry-selection-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	phpWasmCallbackEntrySelectionRepairHistoryPath, "utf8"
));

/**
 * Reverse one exact callback-entry selection repair transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reversePhpWasmCallbackEntrySelectionRepairUpdate = (
	source, update
) => {
	assert.ok(phpWasmCallbackEntrySelectionRepairNormalizationPaths
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
 * Remove only the exact callback-entry selection repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforePhpWasmCallbackEntrySelectionRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !phpWasmCallbackEntrySelectionRepairNormalizationPaths
			.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = [...value.integrationUpdates, ...value.updates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reversePhpWasmCallbackEntrySelectionRepairUpdate(source, update)
		: source;
};
