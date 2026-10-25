/**
 * Authenticate the PHP-Wasm entry source supplement.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const phpWasmEntrySourceSupplementHistoryPath
	= "docs/evidence/php-wasm-entry-source-supplement-source-history-20261025.json";
export const phpWasmEntrySourceSupplementPredecessor
	= "de7630309f4836ac8a9a82cd4a2e687177cbc97b";
export const phpWasmEntrySourceSupplementImplementation
	= "d0c9470af7a70e64f25f715508fc5ba793d1187e";
export const phpWasmEntrySourceSupplementIntegrationBase
	= "d0c9470af7a70e64f25f715508fc5ba793d1187e";
export const phpWasmEntrySourceSupplementCommits = Object.freeze([
	"d0c9470af7a70e64f25f715508fc5ba793d1187e"
]);
export const phpWasmEntrySourceSupplementChangedPaths = Object.freeze([
	"docs/contributing/testing.md"
	, "docs/type-surface.v1.json"
	, "tests/helpers/php-wasm-refinement-entry-hosted-replay-tests.mjs"
	, "tests/helpers/php-wasm-refinement-entry-hosted-replay.mjs"
]);
export const phpWasmEntrySourceSupplementImplementationAddedPaths = Object.freeze([
	"docs/evidence/php-wasm-entry-source-supplement-20261025.json"
	, "tests/helpers/php-wasm-entry-source-supplement.mjs"
	, "docs/evidence/php-wasm-entry-source-supplement-acceptance-20261025/acceptance.json"
	, "docs/evidence/php-wasm-entry-source-supplement-acceptance-20261025/run.tap"
	, "docs/evidence/php-wasm-entry-source-supplement-acceptance-20261025/pin-audit.mjs"
	, "docs/evidence/php-wasm-entry-source-supplement-acceptance-20261025/initial-check.log"
]);
export const phpWasmEntrySourceSupplementImplementationPaths = Object.freeze([
	...phpWasmEntrySourceSupplementChangedPaths
	, ...phpWasmEntrySourceSupplementImplementationAddedPaths
]);
export const phpWasmEntrySourceSupplementIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const phpWasmEntrySourceSupplementNormalizationPaths = Object.freeze([
	...phpWasmEntrySourceSupplementChangedPaths
	, ...phpWasmEntrySourceSupplementIntegrationPaths
]);
export const phpWasmEntrySourceSupplementHistoryAddedPaths = Object.freeze([
	"scripts/update-php-wasm-entry-source-supplement-source-history.mjs"
	, "tests/helpers/php-wasm-entry-source-supplement-source-history-tests.mjs"
	, "tests/helpers/php-wasm-entry-source-supplement-source-history.mjs"
]);
export const phpWasmEntrySourceSupplementAddedPaths = Object.freeze([
	...phpWasmEntrySourceSupplementImplementationAddedPaths
	, ...phpWasmEntrySourceSupplementHistoryAddedPaths
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	phpWasmEntrySourceSupplementHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reversePhpWasmEntrySourceSupplementUpdate = (
	source, update
) => {
	assert.ok(phpWasmEntrySourceSupplementNormalizationPaths
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
 * Remove only the exact PHP-Wasm entry source supplement.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforePhpWasmEntrySourceSupplementSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !phpWasmEntrySourceSupplementNormalizationPaths.includes(path))
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
		current = reversePhpWasmEntrySourceSupplementUpdate(current, update);
	}
	return current;
};
