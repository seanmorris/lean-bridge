/**
 * Authenticate the PHP-Wasm entry diagnostic retention.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const phpWasmEntryDiagnosticRetentionHistoryPath
	= "docs/evidence/php-wasm-entry-diagnostic-retention-source-history-20261025.json";
export const phpWasmEntryDiagnosticRetentionPredecessor
	= "e8a3410b22087a7f89b8655336af5dc4dde4715e";
export const phpWasmEntryDiagnosticRetentionImplementation
	= "700fea2378ffd59b61611deaaa6a1d15ba5d38d2";
export const phpWasmEntryDiagnosticRetentionIntegrationBase
	= "700fea2378ffd59b61611deaaa6a1d15ba5d38d2";
export const phpWasmEntryDiagnosticRetentionCommits = Object.freeze([
	"700fea2378ffd59b61611deaaa6a1d15ba5d38d2"
]);
export const phpWasmEntryDiagnosticRetentionChangedPaths = Object.freeze([
	"tests/checked-javascript.test.mjs"
]);
export const phpWasmEntryDiagnosticRetentionImplementationAddedPaths = Object.freeze([
	"scripts/archive-php-wasm-entry-hosted-diagnostic.mjs"
	, "scripts/check-php-wasm-entry-hosted-diagnostic.mjs"
	, "tests/helpers/php-wasm-refinement-entry-hosted-diagnostic.mjs"
	, "tests/helpers/php-wasm-refinement-entry-hosted-diagnostic-tests.mjs"
	, "tests/helpers/php-wasm-refinement-entry-hosted-storage.mjs"
	, "tests/helpers/php-wasm-refinement-entry-hosted-storage-tests.mjs"
]);
export const phpWasmEntryDiagnosticRetentionImplementationPaths = Object.freeze([
	...phpWasmEntryDiagnosticRetentionChangedPaths
	, ...phpWasmEntryDiagnosticRetentionImplementationAddedPaths
]);
export const phpWasmEntryDiagnosticRetentionIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const phpWasmEntryDiagnosticRetentionNormalizationPaths = Object.freeze([
	...phpWasmEntryDiagnosticRetentionChangedPaths
	, ...phpWasmEntryDiagnosticRetentionIntegrationPaths
]);
export const phpWasmEntryDiagnosticRetentionHistoryAddedPaths = Object.freeze([
	"scripts/update-php-wasm-entry-diagnostic-retention-source-history.mjs"
	, "tests/helpers/php-wasm-entry-diagnostic-retention-source-history-tests.mjs"
	, "tests/helpers/php-wasm-entry-diagnostic-retention-source-history.mjs"
]);
export const phpWasmEntryDiagnosticRetentionAddedPaths = Object.freeze([
	...phpWasmEntryDiagnosticRetentionImplementationAddedPaths
	, ...phpWasmEntryDiagnosticRetentionHistoryAddedPaths
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	phpWasmEntryDiagnosticRetentionHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reversePhpWasmEntryDiagnosticRetentionUpdate = (
	source, update
) => {
	assert.ok(phpWasmEntryDiagnosticRetentionNormalizationPaths
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
 * Remove only the exact PHP-Wasm entry diagnostic retention.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforePhpWasmEntryDiagnosticRetentionSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !phpWasmEntryDiagnosticRetentionNormalizationPaths.includes(path))
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
		current = reversePhpWasmEntryDiagnosticRetentionUpdate(current, update);
	}
	return current;
};
