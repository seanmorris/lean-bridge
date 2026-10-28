/**
 * Authenticate the PHP-Wasm entry publication pin repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const phpWasmEntryPublicationPinRepairHistoryPath
	= "docs/evidence/php-wasm-entry-publication-pin-repair-source-history-20261025.json";
export const phpWasmEntryPublicationPinRepairPredecessor
	= "febe63cfcf0d5e1c5ae0df11c3e6a56bb25d9c57";
export const phpWasmEntryPublicationPinRepairImplementation
	= "2ed4ec693448dcdf70c928618c16aa334f50ec5d";
export const phpWasmEntryPublicationPinRepairIntegrationBase
	= "2ed4ec693448dcdf70c928618c16aa334f50ec5d";
export const phpWasmEntryPublicationPinRepairCommits = Object.freeze([
	"2ed4ec693448dcdf70c928618c16aa334f50ec5d"
]);
export const phpWasmEntryPublicationPinRepairChangedPaths = Object.freeze([
	"scripts/publish-php-wasm-refinement-entry-probes.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const phpWasmEntryPublicationPinRepairImplementationAddedPaths = Object.freeze([
	"tests/helpers/php-wasm-refinement-entry-publication-pins.mjs"
	, "tests/helpers/php-wasm-refinement-entry-publication-pins-tests.mjs"
]);
export const phpWasmEntryPublicationPinRepairImplementationPaths = Object.freeze([
	...phpWasmEntryPublicationPinRepairChangedPaths
	, ...phpWasmEntryPublicationPinRepairImplementationAddedPaths
]);
export const phpWasmEntryPublicationPinRepairIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const phpWasmEntryPublicationPinRepairNormalizationPaths = Object.freeze([
	...phpWasmEntryPublicationPinRepairChangedPaths
	, ...phpWasmEntryPublicationPinRepairIntegrationPaths
]);
export const phpWasmEntryPublicationPinRepairHistoryAddedPaths = Object.freeze([
	"scripts/update-php-wasm-entry-publication-pin-repair-source-history.mjs"
	, "tests/helpers/php-wasm-entry-publication-pin-repair-source-history-tests.mjs"
	, "tests/helpers/php-wasm-entry-publication-pin-repair-source-history.mjs"
]);
export const phpWasmEntryPublicationPinRepairAddedPaths = Object.freeze([
	...phpWasmEntryPublicationPinRepairImplementationAddedPaths
	, ...phpWasmEntryPublicationPinRepairHistoryAddedPaths
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	phpWasmEntryPublicationPinRepairHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reversePhpWasmEntryPublicationPinRepairUpdate = (
	source, update
) => {
	assert.ok(phpWasmEntryPublicationPinRepairNormalizationPaths
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
 * Remove only the exact PHP-Wasm entry publication pin repair.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforePhpWasmEntryPublicationPinRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !phpWasmEntryPublicationPinRepairNormalizationPaths.includes(path))
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
		current = reversePhpWasmEntryPublicationPinRepairUpdate(current, update);
	}
	return current;
};
