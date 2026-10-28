/**
 * Authenticate the PHP-Wasm entry build-input supplement.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const phpWasmEntryBuildInputSupplementHistoryPath
	= "docs/evidence/php-wasm-entry-build-input-supplement-source-history-20261025.json";
export const phpWasmEntryBuildInputSupplementPredecessor
	= "337744bc2a7c1761fa742ce4eb8f7758a00d63f8";
export const phpWasmEntryBuildInputSupplementImplementation
	= "4aae9d81d44859b67f5f077805c5c9fe657374cb";
export const phpWasmEntryBuildInputSupplementIntegrationBase
	= "4aae9d81d44859b67f5f077805c5c9fe657374cb";
export const phpWasmEntryBuildInputSupplementCommits = Object.freeze([
	"4aae9d81d44859b67f5f077805c5c9fe657374cb"
]);
export const phpWasmEntryBuildInputSupplementChangedPaths = Object.freeze([
	"docs/contributing/testing.md"
	, "docs/type-surface.v1.json"
	, "tests/helpers/php-wasm-refinement-entry-hosted-replay-tests.mjs"
	, "tests/helpers/php-wasm-refinement-entry-hosted-replay.mjs"
]);
export const phpWasmEntryBuildInputSupplementImplementationAddedPaths = Object.freeze([
	"docs/evidence/php-wasm-entry-build-input-supplement-20261025.json"
	, "tests/helpers/php-wasm-entry-build-input-supplement.mjs"
	, "docs/evidence/php-wasm-entry-build-input-supplement-acceptance-20261025/acceptance.json"
	, "docs/evidence/php-wasm-entry-build-input-supplement-acceptance-20261025/run.tap"
	, "docs/evidence/php-wasm-entry-build-input-supplement-acceptance-20261025/initial-license.tap"
	, "docs/evidence/php-wasm-entry-build-input-supplement-acceptance-20261025/initial-notice.tap"
	, "docs/evidence/php-wasm-entry-build-input-supplement-acceptance-20261025/initial-checkout.log"
	, "docs/evidence/php-wasm-entry-build-input-supplement-acceptance-20261025/source-audit.mjs"
	, "docs/evidence/php-wasm-entry-build-input-supplement-acceptance-20261025/source-audit.json"
	, "docs/evidence/php-wasm-entry-build-input-supplement-acceptance-20261025/pin-audit.mjs"
]);
export const phpWasmEntryBuildInputSupplementImplementationPaths = Object.freeze([
	...phpWasmEntryBuildInputSupplementChangedPaths
	, ...phpWasmEntryBuildInputSupplementImplementationAddedPaths
]);
export const phpWasmEntryBuildInputSupplementIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const phpWasmEntryBuildInputSupplementNormalizationPaths = Object.freeze([
	...phpWasmEntryBuildInputSupplementChangedPaths
	, ...phpWasmEntryBuildInputSupplementIntegrationPaths
]);
export const phpWasmEntryBuildInputSupplementHistoryAddedPaths = Object.freeze([
	"scripts/update-php-wasm-entry-build-input-supplement-source-history.mjs"
	, "tests/helpers/php-wasm-entry-build-input-supplement-source-history-tests.mjs"
	, "tests/helpers/php-wasm-entry-build-input-supplement-source-history.mjs"
	, "docs/evidence/php-wasm-entry-build-input-supplement-acceptance-20261025/hosted-replay.json"
]);
export const phpWasmEntryBuildInputSupplementAddedPaths = Object.freeze([
	...phpWasmEntryBuildInputSupplementImplementationAddedPaths
	, ...phpWasmEntryBuildInputSupplementHistoryAddedPaths
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	phpWasmEntryBuildInputSupplementHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reversePhpWasmEntryBuildInputSupplementUpdate = (
	source, update
) => {
	assert.ok(phpWasmEntryBuildInputSupplementNormalizationPaths
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
 * Remove only the exact PHP-Wasm entry build-input supplement.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforePhpWasmEntryBuildInputSupplementSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !phpWasmEntryBuildInputSupplementNormalizationPaths.includes(path))
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
		current = reversePhpWasmEntryBuildInputSupplementUpdate(current, update);
	}
	return current;
};
