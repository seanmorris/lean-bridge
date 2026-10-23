/**
 * Reverse the PHP-Wasm callback-entry executed-scope trace-plan repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const phpWasmCallbackEntryTracePlanRepairHistoryPath
	= "docs/evidence/php-wasm-callback-entry-trace-plan-repair-source-history-20261023.json";
export const phpWasmCallbackEntryTracePlanRepairPredecessor
	= "35b604022f30a35de68efec0047ee8d33a08eded";
export const phpWasmCallbackEntryTracePlanRepairImplementation
	= "119b755afc1a63304eb18e746f789ad286883f48";
export const phpWasmCallbackEntryTracePlanRepairChangedPaths
	= Object.freeze([
		"tests/fixtures/php-wasm-callback-entry/driver.mjs"
		, "tests/helpers/php-wasm-callback-entry-driver-tests.mjs"
		, "tests/helpers/php-wasm-callback-entry-plan-tests.mjs"
		, "tests/helpers/php-wasm-callback-entry-plan.mjs"
	]);
export const phpWasmCallbackEntryTracePlanRepairIntegrationPaths
	= Object.freeze([
		"tests/component-array-contract.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const phpWasmCallbackEntryTracePlanRepairNormalizationPaths
	= Object.freeze([
		...phpWasmCallbackEntryTracePlanRepairChangedPaths
		, ...phpWasmCallbackEntryTracePlanRepairIntegrationPaths
	]);
export const phpWasmCallbackEntryTracePlanRepairAddedPaths
	= Object.freeze([
		"scripts/update-php-wasm-callback-entry-trace-plan-repair-source-history.mjs"
		, "tests/helpers/php-wasm-callback-entry-trace-plan-repair-source-history-tests.mjs"
		, "tests/helpers/php-wasm-callback-entry-trace-plan-repair-source-history.mjs"
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	phpWasmCallbackEntryTracePlanRepairHistoryPath, "utf8"
));

/**
 * Reverse one exact callback-entry trace-plan transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reversePhpWasmCallbackEntryTracePlanRepairUpdate = (
	source, update
) => {
	assert.ok(phpWasmCallbackEntryTracePlanRepairNormalizationPaths
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
 * Remove only the exact callback-entry executed-scope trace-plan repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforePhpWasmCallbackEntryTracePlanRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !phpWasmCallbackEntryTracePlanRepairNormalizationPaths
			.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = [...value.integrationUpdates, ...value.updates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reversePhpWasmCallbackEntryTracePlanRepairUpdate(source, update)
		: source;
};
