/**
 * Reverse the explicit PHP-Wasm callback tiles trace repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const phpWasmCallbackTilesTraceRepairHistoryPath
	= "docs/evidence/php-wasm-callback-tiles-trace-repair-source-history-20261024.json";
export const phpWasmCallbackTilesTraceRepairPredecessor
	= "a0b746c57304e6573fec15a5e270bb6ffaa59188";
export const phpWasmCallbackTilesTraceRepairImplementation
	= "58924bc64024fd80f1f4640d42d09a1f65f429c5";
export const phpWasmCallbackTilesTraceRepairIntegrationBase
	= "96ba23f482637f6dd76f2086a2fe93b677ccb057";
export const phpWasmCallbackTilesTraceRepairChangedPaths = Object.freeze([
	"tests/helpers/php-wasm-callback-entry-plan-tests.mjs"
	, "tests/helpers/php-wasm-callback-entry-plan.mjs"
]);
export const phpWasmCallbackTilesTraceRepairIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const phpWasmCallbackTilesTraceRepairNormalizationPaths = Object.freeze([
	...phpWasmCallbackTilesTraceRepairChangedPaths
	, ...phpWasmCallbackTilesTraceRepairIntegrationPaths
]);
export const phpWasmCallbackTilesTraceRepairAddedPaths = Object.freeze([
	"scripts/update-php-wasm-callback-tiles-trace-repair-source-history.mjs"
	, "tests/helpers/php-wasm-callback-tiles-trace-repair-source-history-tests.mjs"
	, "tests/helpers/php-wasm-callback-tiles-trace-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	phpWasmCallbackTilesTraceRepairHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reversePhpWasmCallbackTilesTraceRepairUpdate = (
	source, update
) => {
	assert.ok(phpWasmCallbackTilesTraceRepairNormalizationPaths
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
 * Remove only the exact PHP-Wasm callback tiles trace repair.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforePhpWasmCallbackTilesTraceRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !phpWasmCallbackTilesTraceRepairNormalizationPaths.includes(path))
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
		current = reversePhpWasmCallbackTilesTraceRepairUpdate(current, update);
	}
	return current;
};
