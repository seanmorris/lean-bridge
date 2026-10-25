/**
 * Authenticate the PHP-Wasm entry publisher.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const phpWasmEntryPublisherHistoryPath
	= "docs/evidence/php-wasm-entry-publisher-source-history-20261025.json";
export const phpWasmEntryPublisherPredecessor
	= "2c185dd9eeca9caf3b86c3199dd04bf6718ec1ee";
export const phpWasmEntryPublisherImplementation
	= "c56797df8553d3e2ad9635a9837853403f4de968";
export const phpWasmEntryPublisherIntegrationBase
	= "c56797df8553d3e2ad9635a9837853403f4de968";
export const phpWasmEntryPublisherCommits = Object.freeze([
	"c56797df8553d3e2ad9635a9837853403f4de968"
]);
export const phpWasmEntryPublisherChangedPaths = Object.freeze([
	"docs/contributing/testing.md"
	, "docs/type-surface.v1.json"
	, "scripts/generate-type-docs.mjs"
	, "tests/checked-javascript.test.mjs"
	, "tests/helpers/php-wasm-refinement-entry-documentation-tests.mjs"
	, "tests/helpers/type-surface-promotion-io-tests.mjs"
	, "tests/helpers/type-surface-promotion-io.mjs"
]);
export const phpWasmEntryPublisherImplementationAddedPaths = Object.freeze([
	"scripts/publish-php-wasm-refinement-entry-probes.mjs"
	, "tests/helpers/php-wasm-refinement-entry-publisher-tests.mjs"
]);
export const phpWasmEntryPublisherImplementationPaths = Object.freeze([
	...phpWasmEntryPublisherChangedPaths
	, ...phpWasmEntryPublisherImplementationAddedPaths
]);
export const phpWasmEntryPublisherIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const phpWasmEntryPublisherNormalizationPaths = Object.freeze([
	...phpWasmEntryPublisherChangedPaths
	, ...phpWasmEntryPublisherIntegrationPaths
]);
export const phpWasmEntryPublisherHistoryAddedPaths = Object.freeze([
	"scripts/update-php-wasm-entry-publisher-source-history.mjs"
	, "tests/helpers/php-wasm-entry-publisher-source-history-tests.mjs"
	, "tests/helpers/php-wasm-entry-publisher-source-history.mjs"
]);
export const phpWasmEntryPublisherAddedPaths = Object.freeze([
	...phpWasmEntryPublisherImplementationAddedPaths
	, ...phpWasmEntryPublisherHistoryAddedPaths
]);
export const phpWasmEntryPublisherPins = Object.freeze([
	Object.freeze({
		path: "scripts/generate-type-docs.mjs"
		, previous: "762e62a004d2807f6f01ce4c9109f7a0fc5b89e36441de0df3db24c8648b0acf"
		, current: "baefd01b62e6472fb758391fdf768a10b5755b9b3e90283dd99eeaccc9d55759"
		, count: 121
	})
	, Object.freeze({
		path: "docs/contributing/testing.md"
		, previous: "94be66d7e298b22293a773fc641435d008aed29c886f82e428c5cb9dac46c2cb"
		, current: "a0231d42c30f635b9b2a2ed2dd19636adbf307f60d3cc4590ef39b86e2d1a4ac"
		, count: 11
	})
	, Object.freeze({
		path: "tests/helpers/type-surface-promotion-io.mjs"
		, previous: "1ec4c3f0f1038e65310636b322a5c669edeb43585c04fd68209191b7f66520e1"
		, current: "2af32697fb2d47799926eee99ee726f43e78ee80053e89ef8777ebedc1703c98"
		, count: 23
	})
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	phpWasmEntryPublisherHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reversePhpWasmEntryPublisherUpdate = (
	source, update
) => {
	assert.ok(phpWasmEntryPublisherNormalizationPaths
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
 * Remove only the exact PHP-Wasm entry publisher.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforePhpWasmEntryPublisherSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !phpWasmEntryPublisherNormalizationPaths.includes(path))
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
		current = reversePhpWasmEntryPublisherUpdate(current, update);
	}
	return current;
};
