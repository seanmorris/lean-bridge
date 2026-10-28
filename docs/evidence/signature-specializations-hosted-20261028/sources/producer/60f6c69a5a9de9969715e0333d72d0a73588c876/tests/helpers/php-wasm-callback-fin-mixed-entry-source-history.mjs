/**
 * Reverse the explicit PHP-Wasm mixed Fin callback entry coverage.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const phpWasmCallbackFinMixedEntryHistoryPath
	= "docs/evidence/php-wasm-callback-fin-mixed-entry-source-history-20261024.json";
export const phpWasmCallbackFinMixedEntryPredecessor
	= "a0536e1ed272588a1702a9fe4b16445ded6f971d";
export const phpWasmCallbackFinMixedEntryImplementation
	= "2203aa81e7e74d365059ed0edcf4c8c3a0b6ca20";
export const phpWasmCallbackFinMixedEntryIntegrationBase
	= "87a73905874f3f06adfc7abccb1233dc79889778";
export const phpWasmCallbackFinMixedEntryChangedPaths = Object.freeze([
	"tests/fixtures/php-wasm-callback-entry/callback-fin.php"
	, "tests/helpers/php-wasm-callback-entry-plan-tests.mjs"
	, "tests/helpers/php-wasm-callback-entry-plan.mjs"
	, "tests/helpers/php-wasm-callback-entry-selection-tests.mjs"
	, "tests/helpers/php-wasm-callback-entry-selection.mjs"
	, "tests/helpers/php-wasm-callback-entry-source-fixtures.mjs"
]);
export const phpWasmCallbackFinMixedEntryIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const phpWasmCallbackFinMixedEntryNormalizationPaths = Object.freeze([
	...phpWasmCallbackFinMixedEntryChangedPaths
	, ...phpWasmCallbackFinMixedEntryIntegrationPaths
]);
export const phpWasmCallbackFinMixedEntryAddedPaths = Object.freeze([
	"scripts/update-php-wasm-callback-fin-mixed-entry-source-history.mjs"
	, "tests/helpers/php-wasm-callback-fin-mixed-entry-source-history-tests.mjs"
	, "tests/helpers/php-wasm-callback-fin-mixed-entry-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	phpWasmCallbackFinMixedEntryHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reversePhpWasmCallbackFinMixedEntryUpdate = (
	source, update
) => {
	assert.ok(phpWasmCallbackFinMixedEntryNormalizationPaths
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
 * Remove only the exact PHP-Wasm mixed Fin callback entry coverage.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforePhpWasmCallbackFinMixedEntrySource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !phpWasmCallbackFinMixedEntryNormalizationPaths.includes(path))
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
		current = reversePhpWasmCallbackFinMixedEntryUpdate(current, update);
	}
	return current;
};
