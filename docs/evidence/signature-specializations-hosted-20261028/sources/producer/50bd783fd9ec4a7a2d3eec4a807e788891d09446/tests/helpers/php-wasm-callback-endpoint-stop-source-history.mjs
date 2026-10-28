/**
 * Reverse the PHP-Wasm callback-result bridge's own-endpoint stop. The bridge
 * now defaults the hub stop to its recorded current digest when the caller
 * supplies none, so older readers no longer overshoot to an arbitrary
 * type-surface ancestor.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const phpWasmCallbackEndpointStopHistoryPath
	= "docs/evidence/php-wasm-callback-endpoint-stop-source-history-20261024.json";
export const phpWasmCallbackEndpointStopPredecessor
	= "473327396bae25615f116e6fa015cbbe73666ed5";
export const phpWasmCallbackEndpointStopImplementation
	= "c49330cc8790a0c22a5b11cdf68da64a8933fd14";
export const phpWasmCallbackEndpointStopChangedPaths = Object.freeze([
	"tests/helpers/php-wasm-callback-result-acceptance-history.mjs"
]);
export const phpWasmCallbackEndpointStopNormalizationPaths
	= phpWasmCallbackEndpointStopChangedPaths;
export const phpWasmCallbackEndpointStopAddedPaths = Object.freeze([
	"scripts/update-php-wasm-callback-endpoint-stop-source-history.mjs"
	, "tests/helpers/php-wasm-callback-endpoint-stop-source-history-tests.mjs"
	, "tests/helpers/php-wasm-callback-endpoint-stop-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	phpWasmCallbackEndpointStopHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated transition.
 *
 * @param {string} source - Complete current source text.
 * @param {object} update - Recorded transition.
 */
export const reversePhpWasmCallbackEndpointStopUpdate = (source, update) => {
	assert.ok(phpWasmCallbackEndpointStopNormalizationPaths.includes(update.path));
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
 * Remove only this layer's recognized transition. The central hub owns
 * stopping and re-entry.
 *
 * @param {string} path - Repository-relative source path.
 * @param {string} source - Complete current or historical source.
 * @param {string} [expected] - Stop digest, decided by the central hub.
 */
export const beforePhpWasmCallbackEndpointStopSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !phpWasmCallbackEndpointStopNormalizationPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates
		.find(item => item.path === path && item.currentSha256 === digest);
	return update === undefined ? source
		: reversePhpWasmCallbackEndpointStopUpdate(source, update);
};
