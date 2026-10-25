/**
 * Authenticate the PHP-Wasm checked-record ownership contexts without rewriting original evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedCheckedPhpWasmContextsHistoryPath
	= "docs/evidence/owned-checked-php-wasm-contexts-source-history-20261025.json";
export const ownedCheckedPhpWasmContextsPredecessor
	= "aac4044c0596954713c06d6ffc876a989bfcedbc";
export const ownedCheckedPhpWasmContextsImplementation
	= "41f1d0c34f3115566cf7c289f6a2a5f277ee4142";
export const ownedCheckedPhpWasmContextsIntegrationBase
	= "41f1d0c34f3115566cf7c289f6a2a5f277ee4142";
export const ownedCheckedPhpWasmContextsCommits = Object.freeze([
	"41f1d0c34f3115566cf7c289f6a2a5f277ee4142"
]);
export const ownedCheckedPhpWasmContextsChangedPaths = Object.freeze([
	"docs/contributing/testing.md"
	, "docs/type-surface.v1.json"
	, "tests/helpers/owned-checked-record-hosted-evidence-sources.mjs"
	, "tests/helpers/owned-checked-record-hosted-output.mjs"
	, "tests/helpers/owned-checked-record-php-wasm-hosted-tests.mjs"
	, "tests/helpers/owned-php-wasm-packages.mjs"
]);
export const ownedCheckedPhpWasmContextsImplementationAddedPaths = Object.freeze([
	"docs/evidence/owned-checked-php-wasm-contexts-20261025.json"
	, "tests/fixtures/structured-types/owned-checked-record-php-wasm-contexts.php"
	, "tests/helpers/owned-checked-record-php-wasm-context-evidence.mjs"
	, "tests/helpers/owned-checked-record-php-wasm-context-fixture.mjs"
	, "tests/helpers/owned-checked-record-php-wasm-context-tests.mjs"
	, "tests/helpers/owned-checked-record-php-wasm-contexts.mjs"
	, "tests/helpers/owned-checked-record-php-wasm-peer.mjs"
]);
export const ownedCheckedPhpWasmContextsImplementationPaths = Object.freeze([
	...ownedCheckedPhpWasmContextsChangedPaths
	, ...ownedCheckedPhpWasmContextsImplementationAddedPaths
]);
export const ownedCheckedPhpWasmContextsIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const ownedCheckedPhpWasmContextsNormalizationPaths = Object.freeze([
	...ownedCheckedPhpWasmContextsChangedPaths
	, ...ownedCheckedPhpWasmContextsIntegrationPaths
]);
export const ownedCheckedPhpWasmContextsHistoryAddedPaths = Object.freeze([
	"scripts/update-owned-checked-php-wasm-contexts-source-history.mjs"
	, "tests/helpers/owned-checked-php-wasm-contexts-source-history-tests.mjs"
	, "tests/helpers/owned-checked-php-wasm-contexts-source-history.mjs"
]);
export const ownedCheckedPhpWasmContextsAddedPaths = Object.freeze([
	...ownedCheckedPhpWasmContextsImplementationAddedPaths
	, ...ownedCheckedPhpWasmContextsHistoryAddedPaths
]);
export const ownedCheckedPhpWasmContextsPins = Object.freeze([
	Object.freeze({
		path: "docs/contributing/testing.md"
		, count: 11
		, previousSha256: "09ca6df5f173172191d89cd852be4345620a9409c05108bd52e696d62926fdbf"
		, currentSha256: "e4ddf05a33b6be9203ab5f189583e71c0ed5f48997aba1599e67b39d7e7ce2fb"
	})
	, Object.freeze({
		path: "tests/helpers/owned-checked-record-hosted-output.mjs"
		, count: 11
		, previousSha256: "06e71de8da8c60c07ea561806c53b64770b038f61e8a001b097400b2eb6d078c"
		, currentSha256: "19f2beca3e34dbb527e1a693b51d10209afe16016bea8ee9e0991023c5c13318"
	})
	, Object.freeze({
		path: "tests/helpers/owned-php-wasm-packages.mjs"
		, count: 7
		, previousSha256: "264d6d33b27fd5b508f2e89c7dcdcf0801a19906fe6d179b8ad3c247a707c3b0"
		, currentSha256: "0f0b3c35e6e32dd44063f1527fc981d66479623824d663e7b9870c5ab402e6e9"
	})
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedCheckedPhpWasmContextsHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseOwnedCheckedPhpWasmContextsUpdate = (
	source, update
) => {
	assert.ok(ownedCheckedPhpWasmContextsNormalizationPaths
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
 * Remove only the exact Owned checked PHP-Wasm contexts.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeOwnedCheckedPhpWasmContextsSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedCheckedPhpWasmContextsNormalizationPaths.includes(path))
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
		current = reverseOwnedCheckedPhpWasmContextsUpdate(current, update);
	}
	return current;
};
