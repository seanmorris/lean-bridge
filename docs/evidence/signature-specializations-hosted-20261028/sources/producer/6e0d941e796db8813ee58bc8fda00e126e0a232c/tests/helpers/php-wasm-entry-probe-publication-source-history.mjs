/**
 * Authenticate the PHP-Wasm entry probe publication.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const phpWasmEntryProbePublicationHistoryPath
	= "docs/evidence/php-wasm-entry-probe-publication-source-history-20261025.json";
export const phpWasmEntryProbePublicationPredecessor
	= "f2b19e9f539086ee45d4b918a9579285eb4acb78";
export const phpWasmEntryProbePublicationImplementation
	= "dc52c5f2f18b306daa109f275b31f7b5ccb0baba";
export const phpWasmEntryProbePublicationIntegrationBase
	= "dc52c5f2f18b306daa109f275b31f7b5ccb0baba";
export const phpWasmEntryProbePublicationCommits = Object.freeze([
	"07af61489bf126c0867d5317884e0c99c788cbd6"
	, "dc52c5f2f18b306daa109f275b31f7b5ccb0baba"
]);
export const phpWasmEntryProbePublicationChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "docs/php.md"
	, "docs/publish/php.md"
	, "docs/lean/existing-package.md"
	, "docs/reference/types.md"
	, "tests/checked-javascript.test.mjs"
]);
export const phpWasmEntryProbePublicationImplementationAddedPaths = Object.freeze([
	"docs/evidence/php-wasm-entry-probe-publication-20261025.json"
	, "tests/helpers/php-wasm-entry-published-probe-tests.mjs"
]);
export const phpWasmEntryProbePublicationImplementationPaths = Object.freeze([
	...phpWasmEntryProbePublicationChangedPaths
	, ...phpWasmEntryProbePublicationImplementationAddedPaths
]);
export const phpWasmEntryProbePublicationIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const phpWasmEntryProbePublicationNormalizationPaths = Object.freeze([
	...phpWasmEntryProbePublicationChangedPaths
	, ...phpWasmEntryProbePublicationIntegrationPaths
]);
export const phpWasmEntryProbePublicationHistoryAddedPaths = Object.freeze([
	"scripts/update-php-wasm-entry-probe-publication-source-history.mjs"
	, "tests/helpers/php-wasm-entry-probe-publication-source-history-tests.mjs"
	, "tests/helpers/php-wasm-entry-probe-publication-source-history.mjs"
]);
export const phpWasmEntryProbePublicationAddedPaths = Object.freeze([
	...phpWasmEntryProbePublicationImplementationAddedPaths
	, ...phpWasmEntryProbePublicationHistoryAddedPaths
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	phpWasmEntryProbePublicationHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reversePhpWasmEntryProbePublicationUpdate = (
	source, update
) => {
	assert.ok(phpWasmEntryProbePublicationNormalizationPaths
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
 * Remove only the exact PHP-Wasm entry probe publication.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforePhpWasmEntryProbePublicationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !phpWasmEntryProbePublicationNormalizationPaths.includes(path))
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
		current = reversePhpWasmEntryProbePublicationUpdate(current, update);
	}
	return current;
};
