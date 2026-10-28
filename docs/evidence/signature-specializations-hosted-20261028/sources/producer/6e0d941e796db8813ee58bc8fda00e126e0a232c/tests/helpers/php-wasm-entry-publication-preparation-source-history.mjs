/**
 * Authenticate the PHP-Wasm entry publication preparation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const phpWasmEntryPublicationPreparationHistoryPath
	= "docs/evidence/php-wasm-entry-publication-preparation-source-history-20261025.json";
export const phpWasmEntryPublicationPreparationPredecessor
	= "0e4ee2db1f0e00e1a279d6de593907b656f54d55";
export const phpWasmEntryPublicationPreparationImplementation
	= "a13254bee44fddc65a72b9be5647752c441a8d15";
export const phpWasmEntryPublicationPreparationIntegrationBase
	= "a13254bee44fddc65a72b9be5647752c441a8d15";
export const phpWasmEntryPublicationPreparationCommits = Object.freeze([
	"a13254bee44fddc65a72b9be5647752c441a8d15"
]);
export const phpWasmEntryPublicationPreparationChangedPaths = Object.freeze([
	"tests/checked-javascript.test.mjs"
]);
export const phpWasmEntryPublicationPreparationImplementationAddedPaths = Object.freeze([
	"tests/helpers/php-wasm-refinement-entry-publication-docs-tests.mjs"
	, "tests/helpers/php-wasm-refinement-entry-publication-docs.mjs"
	, "tests/helpers/php-wasm-refinement-entry-publication-tests.mjs"
	, "tests/helpers/php-wasm-refinement-entry-publication.mjs"
]);
export const phpWasmEntryPublicationPreparationImplementationPaths = Object.freeze([
	...phpWasmEntryPublicationPreparationChangedPaths
	, ...phpWasmEntryPublicationPreparationImplementationAddedPaths
]);
export const phpWasmEntryPublicationPreparationIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const phpWasmEntryPublicationPreparationNormalizationPaths = Object.freeze([
	...phpWasmEntryPublicationPreparationChangedPaths
	, ...phpWasmEntryPublicationPreparationIntegrationPaths
]);
export const phpWasmEntryPublicationPreparationHistoryAddedPaths = Object.freeze([
	"scripts/update-php-wasm-entry-publication-preparation-source-history.mjs"
	, "tests/helpers/php-wasm-entry-publication-preparation-source-history-tests.mjs"
	, "tests/helpers/php-wasm-entry-publication-preparation-source-history.mjs"
]);
export const phpWasmEntryPublicationPreparationAddedPaths = Object.freeze([
	...phpWasmEntryPublicationPreparationImplementationAddedPaths
	, ...phpWasmEntryPublicationPreparationHistoryAddedPaths
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	phpWasmEntryPublicationPreparationHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reversePhpWasmEntryPublicationPreparationUpdate = (
	source, update
) => {
	assert.ok(phpWasmEntryPublicationPreparationNormalizationPaths
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
 * Remove only the exact PHP-Wasm entry publication preparation.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforePhpWasmEntryPublicationPreparationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !phpWasmEntryPublicationPreparationNormalizationPaths.includes(path))
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
		current = reversePhpWasmEntryPublicationPreparationUpdate(current, update);
	}
	return current;
};
