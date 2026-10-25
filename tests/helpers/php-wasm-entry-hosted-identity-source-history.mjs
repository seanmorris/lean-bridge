/**
 * Authenticate the PHP-Wasm entry hosted identity.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const phpWasmEntryHostedIdentityHistoryPath
	= "docs/evidence/php-wasm-entry-hosted-identity-source-history-20261025.json";
export const phpWasmEntryHostedIdentityPredecessor
	= "00a6ce3631dcfb6f14014a881266e2e7fe3a12f2";
export const phpWasmEntryHostedIdentityImplementation
	= "70d3166981c95ade7f4b773a676581228a0e3901";
export const phpWasmEntryHostedIdentityIntegrationBase
	= "70d3166981c95ade7f4b773a676581228a0e3901";
export const phpWasmEntryHostedIdentityCommits = Object.freeze([
	"70d3166981c95ade7f4b773a676581228a0e3901"
]);
export const phpWasmEntryHostedIdentityChangedPaths = Object.freeze([
	"tests/checked-javascript.test.mjs"
]);
export const phpWasmEntryHostedIdentityImplementationAddedPaths = Object.freeze([
	"tests/helpers/php-wasm-refinement-entry-hosted-identities.mjs"
	, "tests/helpers/php-wasm-refinement-entry-hosted-identities-tests.mjs"
]);
export const phpWasmEntryHostedIdentityImplementationPaths = Object.freeze([
	...phpWasmEntryHostedIdentityChangedPaths
	, ...phpWasmEntryHostedIdentityImplementationAddedPaths
]);
export const phpWasmEntryHostedIdentityIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const phpWasmEntryHostedIdentityNormalizationPaths = Object.freeze([
	...phpWasmEntryHostedIdentityChangedPaths
	, ...phpWasmEntryHostedIdentityIntegrationPaths
]);
export const phpWasmEntryHostedIdentityHistoryAddedPaths = Object.freeze([
	"scripts/update-php-wasm-entry-hosted-identity-source-history.mjs"
	, "tests/helpers/php-wasm-entry-hosted-identity-source-history-tests.mjs"
	, "tests/helpers/php-wasm-entry-hosted-identity-source-history.mjs"
]);
export const phpWasmEntryHostedIdentityAddedPaths = Object.freeze([
	...phpWasmEntryHostedIdentityImplementationAddedPaths
	, ...phpWasmEntryHostedIdentityHistoryAddedPaths
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	phpWasmEntryHostedIdentityHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reversePhpWasmEntryHostedIdentityUpdate = (
	source, update
) => {
	assert.ok(phpWasmEntryHostedIdentityNormalizationPaths
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
 * Remove only the exact PHP-Wasm entry hosted identity.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforePhpWasmEntryHostedIdentitySource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !phpWasmEntryHostedIdentityNormalizationPaths.includes(path))
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
		current = reversePhpWasmEntryHostedIdentityUpdate(current, update);
	}
	return current;
};
