/**
 * Authenticate the PHP-Wasm entry tag dispatch.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const phpWasmEntryTagDispatchHistoryPath
	= "docs/evidence/php-wasm-entry-tag-dispatch-source-history-20261024.json";
export const phpWasmEntryTagDispatchPredecessor
	= "f0c4365bbab1a5bcf7313a9126c4491b385419d1";
export const phpWasmEntryTagDispatchImplementation
	= "5075ca5c680a55a5f5e20fe4c3fa59a912cb5286";
export const phpWasmEntryTagDispatchIntegrationBase
	= "5075ca5c680a55a5f5e20fe4c3fa59a912cb5286";
export const phpWasmEntryTagDispatchCommits = Object.freeze([
	"5075ca5c680a55a5f5e20fe4c3fa59a912cb5286"
]);
export const phpWasmEntryTagDispatchChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, ".github/workflows/php-wasm-refinement-entry-promotion.yml"
	, "docs/contributing/testing.md"
	, "tests/helpers/php-wasm-refinement-entry-promotion-ci.mjs"
	, "tests/helpers/php-wasm-refinement-entry-promotion-ci-tests.mjs"
]);
export const phpWasmEntryTagDispatchImplementationAddedPaths = Object.freeze([]);
export const phpWasmEntryTagDispatchImplementationPaths = Object.freeze([
	...phpWasmEntryTagDispatchChangedPaths
	, ...phpWasmEntryTagDispatchImplementationAddedPaths
]);
export const phpWasmEntryTagDispatchIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const phpWasmEntryTagDispatchNormalizationPaths = Object.freeze([
	...phpWasmEntryTagDispatchChangedPaths
	, ...phpWasmEntryTagDispatchIntegrationPaths
]);
export const phpWasmEntryTagDispatchHistoryAddedPaths = Object.freeze([
	"scripts/update-php-wasm-entry-tag-dispatch-source-history.mjs"
	, "tests/helpers/php-wasm-entry-tag-dispatch-source-history-tests.mjs"
	, "tests/helpers/php-wasm-entry-tag-dispatch-source-history.mjs"
]);
export const phpWasmEntryTagDispatchAddedPaths = Object.freeze([
	...phpWasmEntryTagDispatchImplementationAddedPaths
	, ...phpWasmEntryTagDispatchHistoryAddedPaths
]);
export const phpWasmEntryTagDispatchPins = Object.freeze([
	Object.freeze({
		path: ".github/workflows/php-wasm-refinement-entry-promotion.yml"
		, count: 1
		, previousSha256: "6ed959da50824a3c2d8465a255710bf52ae267fde2487df025d11a6dd43a0167"
		, currentSha256: "0a480f5a9829f95902fcdee35f122cce3e3bfe82a13e71d24762ff31847817d5"
	})
	, Object.freeze({
		path: "docs/contributing/testing.md"
		, count: 11
		, previousSha256: "71578018e88495492407855414618749a2f1600dd57c4da6abcd562b2675ef5c"
		, currentSha256: "000a883b22e63a4a46b7c88929d424bff8a3dce4e14a4d16141f3f19d5cc5a78"
	})
	, Object.freeze({
		path: "tests/helpers/php-wasm-refinement-entry-promotion-ci.mjs"
		, count: 1
		, previousSha256: "68d01f9fb2aad641fe92b426b7f86f2c1183dd0199ce6d75e0150afc8f91de3c"
		, currentSha256: "a67313f82b83a07932efa51b4307d89634cc7588ea9344ea6016b6050f34dfa9"
	})
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	phpWasmEntryTagDispatchHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reversePhpWasmEntryTagDispatchUpdate = (
	source, update
) => {
	assert.ok(phpWasmEntryTagDispatchNormalizationPaths
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
 * Remove only the exact PHP-Wasm entry tag dispatch.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforePhpWasmEntryTagDispatchSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !phpWasmEntryTagDispatchNormalizationPaths.includes(path))
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
		current = reversePhpWasmEntryTagDispatchUpdate(current, update);
	}
	return current;
};
