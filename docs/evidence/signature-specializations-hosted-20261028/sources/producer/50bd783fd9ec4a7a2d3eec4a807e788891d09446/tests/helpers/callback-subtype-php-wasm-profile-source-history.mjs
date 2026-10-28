/**
 * Reverse the callback-Subtype PHP-Wasm Core profile registration repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const callbackSubtypePhpWasmProfileHistoryPath
	= "docs/evidence/callback-subtype-php-wasm-profile-source-history-20261022.json";
export const callbackSubtypePhpWasmProfilePredecessor
	= "85b48b5a804a294517ca649405f108a74c994458";
export const callbackSubtypePhpWasmProfileImplementation
	= "b38cbf5b44de3a35ace44f3652d0252d1b82d502";
export const callbackSubtypePhpWasmProfileImplementationPaths = Object.freeze([
	"src/adoption/test-profiles.mjs"
	, "tests/test-profiles.test.mjs"
]);
export const callbackSubtypePhpWasmProfileIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/native-subtype.test.mjs"
]);
export const callbackSubtypePhpWasmProfileChangedPaths = Object.freeze([
	...callbackSubtypePhpWasmProfileImplementationPaths
	, ...callbackSubtypePhpWasmProfileIntegrationPaths
]);
export const callbackSubtypePhpWasmProfileAddedPaths = Object.freeze([
	"scripts/update-callback-subtype-php-wasm-profile-source-history.mjs"
	, "tests/helpers/callback-subtype-php-wasm-profile-source-history-tests.mjs"
	, "tests/helpers/callback-subtype-php-wasm-profile-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	callbackSubtypePhpWasmProfileHistoryPath, "utf8"));

/**
 * Reverse one exact authenticated source transition.
 *
 * @param source - Complete current source.
 * @param update - Authenticated transition to reverse.
 */
export const reverseCallbackSubtypePhpWasmProfileUpdate = (source, update) => {
	assert.ok(callbackSubtypePhpWasmProfileChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
		assert.equal(typeof edit.previous, "string");
		assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start, edit.start + edit.current.length), edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only the exact callback-Subtype PHP-Wasm profile repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCallbackSubtypePhpWasmProfileSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !callbackSubtypePhpWasmProfileChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path
		&& item.currentSha256 === digest);
	return update
		? reverseCallbackSubtypePhpWasmProfileUpdate(source, update)
		: source;
};
