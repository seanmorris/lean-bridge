/**
 * Reverse the WIT callback verifier's frozen-source closure repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const witCallbackFrozenClosureHistoryPath
	= "docs/evidence/wit-callback-frozen-closure-source-history-20261028.json";
export const witCallbackFrozenClosurePredecessor
	= "68e4d21963da27b4a031ff5894ce2c76b381d864";
export const witCallbackFrozenClosureImplementation
	= "3e4df85197bafcb09bd9942ed93107189e59bc32";
export const witCallbackFrozenClosureCommits = Object.freeze([
	witCallbackFrozenClosureImplementation
]);
export const witCallbackFrozenClosureChangedPaths = Object.freeze([
	"tests/helpers/owned-wit-callback-result-acceptance-tests.mjs"
	, "tests/helpers/owned-wit-callback-result-acceptance.mjs"
]);
export const witCallbackFrozenClosureImplementationAddedPaths
	= Object.freeze([]);
export const witCallbackFrozenClosureHistoryAddedPaths = Object.freeze([
	"scripts/update-wit-callback-frozen-closure-source-history.mjs"
	, "tests/helpers/wit-callback-frozen-closure-source-history-tests.mjs"
	, "tests/helpers/wit-callback-frozen-closure-source-history.mjs"
]);
export const witCallbackFrozenClosureAddedPaths = Object.freeze([
	...witCallbackFrozenClosureImplementationAddedPaths
	, ...witCallbackFrozenClosureHistoryAddedPaths
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	witCallbackFrozenClosureHistoryPath, "utf8"
));

/**
 * Reverse one authenticated source transition.
 *
 * @param {string} source Complete current source text.
 * @param {object} update Recorded transition.
 * @returns {string} Exact predecessor source.
 */
export const reverseWitCallbackFrozenClosureUpdate = (source, update) => {
	assert.ok(witCallbackFrozenClosureChangedPaths.includes(update.path));
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
			, edit.start + edit.current.length), edit.current, update.path);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only this layer's recognized transition.
 *
 * @param {string} path Repository-relative source path.
 * @param {string} source Complete current or historical source.
 * @param {string} [expected] Stop digest selected by the central hub.
 * @returns {string} Reversed or unchanged source.
 */
export const beforeWitCallbackFrozenClosureSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !witCallbackFrozenClosureChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item =>
		item.path === path && item.currentSha256 === digest);
	return update === undefined ? source
		: reverseWitCallbackFrozenClosureUpdate(source, update);
};
