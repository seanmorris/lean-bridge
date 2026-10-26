/**
 * Reverse the authenticated directional callback Subtype foundation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const callbackSubtypeFoundationHistoryPath
	= "docs/evidence/callback-subtype-foundation-source-history-20261020.json";
export const callbackSubtypeFoundationPredecessor
	= "0cf7fb6400602ca4bd985f13767a315002648871";
export const callbackSubtypeFoundationImplementation
	= "096f8196f252c6a8489abac2f0c7414ac7c64f37";
export const callbackSubtypeFoundationChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "schema/compiler-adapter-plan.schema.json"
	, "src/abi/component-structured-callables.mjs"
	, "src/abi/refinements.mjs"
	, "src/analyze/NativeExports.lean"
	, "src/analyze/elaborated-metadata.mjs"
	, "src/analyze/native-types.mjs"
	, "src/analyze/reviewed-refinements.mjs"
	, "src/analyze/reviewed-source.mjs"
	, "tests/component-structured-callable-contract.test.mjs"
	, "tests/helpers/component-nominal-subtype-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/nominal-subtype-entry-measurement-source-history-tests.mjs"
	, "tests/helpers/reviewed-callback-fin-guards.mjs"
	, "tests/reviewed-callback-fin.test.mjs"
]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	callbackSubtypeFoundationHistoryPath, "utf8"
));

/**
 * Restore one complete update after authenticating both endpoints and edits.
 *
 * @param source - Current complete source text.
 * @param update - Recorded exact update.
 */
export const reverseCallbackSubtypeFoundationUpdate = (source, update) => {
	assert.ok(callbackSubtypeFoundationChangedPaths.includes(update.path));
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
 * Remove only this exact callback Subtype foundation transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCallbackSubtypeFoundationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !callbackSubtypeFoundationChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseCallbackSubtypeFoundationUpdate(source, update)
		: source;
};

/**
 * Restore a current-source pointer container advanced by this transition.
 *
 * @param path - Repository-relative pointer-container path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCallbackSubtypeFoundationPointers = (
	path, source, expected
) => {
	if(typeof source !== "string") return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const pin = record().pinContainers.find(item => item.path === path);
	if(pin?.currentSha256 !== digest) return source;
	for(const replacement of [...pin.replacements].reverse())
	{
		assert.equal(source.split(replacement.current).length - 1
			, replacement.count, `${path}: ${replacement.sourcePath}`);
		source = source.replaceAll(replacement.current, replacement.previous);
	}
	assert.equal(sha256(source), pin.previousSha256, path);
	return source;
};
