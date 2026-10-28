/**
 * Authenticate the PHP-Wasm callback producer replay.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const phpWasmCallbackProducerReplayHistoryPath
	= "docs/evidence/php-wasm-callback-producer-replay-source-history-20261024.json";
export const phpWasmCallbackProducerReplayPredecessor
	= "3ce92c5e0c225b3025704493bc5bf3cd5be2010e";
export const phpWasmCallbackProducerReplayImplementation
	= "e953e4106b0ebacc47ddf95610a0ddcb7336cf65";
export const phpWasmCallbackProducerReplayIntegrationBase
	= "e953e4106b0ebacc47ddf95610a0ddcb7336cf65";
export const phpWasmCallbackProducerReplayCommits = Object.freeze([
	"e953e4106b0ebacc47ddf95610a0ddcb7336cf65"
]);
export const phpWasmCallbackProducerReplayChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/helpers/owned-php-wasm-callback-result-evidence.mjs"
	, "tests/helpers/php-wasm-callback-result-acceptance-history-tests.mjs"
	, "tests/owned-php-wasm-callback-result-evidence.test.mjs"
]);
export const phpWasmCallbackProducerReplayImplementationAddedPaths = Object.freeze([
	"tests/helpers/owned-php-wasm-callback-result-replay-tests.mjs"
	, "tests/helpers/owned-php-wasm-callback-result-replay.mjs"
]);
export const phpWasmCallbackProducerReplayImplementationPaths = Object.freeze([
	...phpWasmCallbackProducerReplayChangedPaths
	, ...phpWasmCallbackProducerReplayImplementationAddedPaths
]);
export const phpWasmCallbackProducerReplayIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const phpWasmCallbackProducerReplayNormalizationPaths = Object.freeze([
	...phpWasmCallbackProducerReplayChangedPaths
	, ...phpWasmCallbackProducerReplayIntegrationPaths
]);
export const phpWasmCallbackProducerReplayHistoryAddedPaths = Object.freeze([
	"scripts/update-php-wasm-callback-producer-replay-source-history.mjs"
	, "tests/helpers/php-wasm-callback-producer-replay-source-history-tests.mjs"
	, "tests/helpers/php-wasm-callback-producer-replay-source-history.mjs"
]);
export const phpWasmCallbackProducerReplayAddedPaths = Object.freeze([
	...phpWasmCallbackProducerReplayImplementationAddedPaths
	, ...phpWasmCallbackProducerReplayHistoryAddedPaths
]);
export const phpWasmCallbackProducerReplayPins = Object.freeze([
	Object.freeze({
		path: "tests/helpers/owned-php-wasm-callback-result-evidence.mjs"
		, count: 1
		, previousSha256: "19e32a4062d486b6dbd644a8a633b8e215b0ab247355e180a008bee999f12949"
		, currentSha256: "3015baca69eb962e199e7cd420b4b2956046ad45082d7b62b0230b324a3e4d45"
	})
	, Object.freeze({
		path: "tests/owned-php-wasm-callback-result-evidence.test.mjs"
		, count: 1
		, previousSha256: "4888e5c9d9d94701054e0448445ebe265704a23850aa924228bcce020fb4879f"
		, currentSha256: "11646b36650deac4026cd05f9ff4edd0585ad2fece5a55d88b2874ac300238c9"
	})
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	phpWasmCallbackProducerReplayHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reversePhpWasmCallbackProducerReplayUpdate = (
	source, update
) => {
	assert.ok(phpWasmCallbackProducerReplayNormalizationPaths
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
 * Remove only the exact PHP-Wasm callback replay.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforePhpWasmCallbackProducerReplaySource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !phpWasmCallbackProducerReplayNormalizationPaths.includes(path))
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
		current = reversePhpWasmCallbackProducerReplayUpdate(current, update);
	}
	return current;
};
