/**
 * Authenticate the PHP-Wasm entry complete archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const phpWasmEntryCompleteArchiveHistoryPath
	= "docs/evidence/php-wasm-entry-complete-archive-source-history-20261025.json";
export const phpWasmEntryCompleteArchivePredecessor
	= "042b9b177217c992bd01a4d708a83c654bb7267e";
export const phpWasmEntryCompleteArchiveImplementation
	= "a0fb9a8459d4bccd5416637f6e73d75bcb2e4f4d";
export const phpWasmEntryCompleteArchiveIntegrationBase
	= "a0fb9a8459d4bccd5416637f6e73d75bcb2e4f4d";
export const phpWasmEntryCompleteArchiveCommits = Object.freeze([
	"a0fb9a8459d4bccd5416637f6e73d75bcb2e4f4d"
]);
export const phpWasmEntryCompleteArchiveChangedPaths = Object.freeze([
	"tests/checked-javascript.test.mjs"
]);
export const phpWasmEntryCompleteArchiveImplementationAddedPaths = Object.freeze([
	"scripts/archive-php-wasm-refinement-entry-hosted.mjs"
	, "scripts/check-php-wasm-refinement-entry-hosted-archive.mjs"
	, "tests/helpers/php-wasm-refinement-entry-hosted-archive-tests.mjs"
	, "tests/helpers/php-wasm-refinement-entry-hosted-archive.mjs"
]);
export const phpWasmEntryCompleteArchiveImplementationPaths = Object.freeze([
	...phpWasmEntryCompleteArchiveChangedPaths
	, ...phpWasmEntryCompleteArchiveImplementationAddedPaths
]);
export const phpWasmEntryCompleteArchiveIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const phpWasmEntryCompleteArchiveNormalizationPaths = Object.freeze([
	...phpWasmEntryCompleteArchiveChangedPaths
	, ...phpWasmEntryCompleteArchiveIntegrationPaths
]);
export const phpWasmEntryCompleteArchiveHistoryAddedPaths = Object.freeze([
	"scripts/update-php-wasm-entry-complete-archive-source-history.mjs"
	, "tests/helpers/php-wasm-entry-complete-archive-source-history-tests.mjs"
	, "tests/helpers/php-wasm-entry-complete-archive-source-history.mjs"
]);
export const phpWasmEntryCompleteArchiveAddedPaths = Object.freeze([
	...phpWasmEntryCompleteArchiveImplementationAddedPaths
	, ...phpWasmEntryCompleteArchiveHistoryAddedPaths
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	phpWasmEntryCompleteArchiveHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reversePhpWasmEntryCompleteArchiveUpdate = (
	source, update
) => {
	assert.ok(phpWasmEntryCompleteArchiveNormalizationPaths
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
 * Remove only the exact PHP-Wasm entry complete archive.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforePhpWasmEntryCompleteArchiveSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !phpWasmEntryCompleteArchiveNormalizationPaths.includes(path))
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
		current = reversePhpWasmEntryCompleteArchiveUpdate(current, update);
	}
	return current;
};
