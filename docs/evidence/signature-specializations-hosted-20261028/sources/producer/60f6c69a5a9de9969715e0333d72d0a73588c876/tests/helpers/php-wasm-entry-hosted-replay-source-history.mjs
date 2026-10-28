/**
 * Authenticate the PHP-Wasm entry hosted replay.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const phpWasmEntryHostedReplayHistoryPath
	= "docs/evidence/php-wasm-entry-hosted-replay-source-history-20261025.json";
export const phpWasmEntryHostedReplayPredecessor
	= "9600df719bd008e64bf89ee79b0247bd38477b9b";
export const phpWasmEntryHostedReplayImplementation
	= "760c17a7e5cecb0b62008ccbfc5e532b3ab5cfa1";
export const phpWasmEntryHostedReplayIntegrationBase
	= "760c17a7e5cecb0b62008ccbfc5e532b3ab5cfa1";
export const phpWasmEntryHostedReplayCommits = Object.freeze([
	"760c17a7e5cecb0b62008ccbfc5e532b3ab5cfa1"
]);
export const phpWasmEntryHostedReplayChangedPaths = Object.freeze([
	"tests/checked-javascript.test.mjs"
]);
export const phpWasmEntryHostedReplayImplementationAddedPaths = Object.freeze([
	"tests/helpers/php-wasm-refinement-entry-hosted-replay.mjs"
	, "tests/helpers/php-wasm-refinement-entry-hosted-replay-tests.mjs"
]);
export const phpWasmEntryHostedReplayImplementationPaths = Object.freeze([
	...phpWasmEntryHostedReplayChangedPaths
	, ...phpWasmEntryHostedReplayImplementationAddedPaths
]);
export const phpWasmEntryHostedReplayIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const phpWasmEntryHostedReplayNormalizationPaths = Object.freeze([
	...phpWasmEntryHostedReplayChangedPaths
	, ...phpWasmEntryHostedReplayIntegrationPaths
]);
export const phpWasmEntryHostedReplayHistoryAddedPaths = Object.freeze([
	"scripts/update-php-wasm-entry-hosted-replay-source-history.mjs"
	, "tests/helpers/php-wasm-entry-hosted-replay-source-history-tests.mjs"
	, "tests/helpers/php-wasm-entry-hosted-replay-source-history.mjs"
]);
export const phpWasmEntryHostedReplayAddedPaths = Object.freeze([
	...phpWasmEntryHostedReplayImplementationAddedPaths
	, ...phpWasmEntryHostedReplayHistoryAddedPaths
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	phpWasmEntryHostedReplayHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reversePhpWasmEntryHostedReplayUpdate = (
	source, update
) => {
	assert.ok(phpWasmEntryHostedReplayNormalizationPaths
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
 * Remove only the exact PHP-Wasm entry hosted replay.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforePhpWasmEntryHostedReplaySource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !phpWasmEntryHostedReplayNormalizationPaths.includes(path))
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
		current = reversePhpWasmEntryHostedReplayUpdate(current, update);
	}
	return current;
};
