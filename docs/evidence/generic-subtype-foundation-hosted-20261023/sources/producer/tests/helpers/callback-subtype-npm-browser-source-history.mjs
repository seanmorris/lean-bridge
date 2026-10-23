/**
 * Reverse the authenticated npm/browser callback Subtype runtime transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const callbackSubtypeNpmBrowserHistoryPath
	= "docs/evidence/callback-subtype-npm-browser-source-history-20261020.json";
export const callbackSubtypeNpmBrowserPredecessor
	= "fc33ecfa77efb31185b2fe58f32c9d89c6cb38c3";
export const callbackSubtypeNpmBrowserImplementation
	= "4e69f6225c1c5517758fae018806c100e220cd13";
export const callbackSubtypeNpmBrowserChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "src/abi/component-structured-callables.mjs"
	, "src/backends/javascript/generate.mjs"
	, "src/backends/javascript/package-audit.mjs"
	, "src/build/component-refinements.mjs"
	, "src/build/component-structured-callable-adapters.mjs"
	, "src/build/component-structured-callable-lean.mjs"
	, "src/release/component-callable-runtime.mjs"
	, "src/release/component-structured-callable-runtime.mjs"
	, "tests/callback-subtype-extractor.test.mjs"
	, "tests/component-structured-callable-contract.test.mjs"
	, "tests/helpers/callback-subtype-foundation-source-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	callbackSubtypeNpmBrowserHistoryPath, "utf8"
));

/**
 * Restore one complete update after authenticating both endpoints and edits.
 *
 * @param source - Current complete source text.
 * @param update - Recorded exact update.
 */
export const reverseCallbackSubtypeNpmBrowserUpdate = (source, update) => {
	assert.ok(callbackSubtypeNpmBrowserChangedPaths.includes(update.path));
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
 * Remove only this exact npm/browser callback Subtype transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCallbackSubtypeNpmBrowserSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !callbackSubtypeNpmBrowserChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseCallbackSubtypeNpmBrowserUpdate(source, update)
		: source;
};

/**
 * Restore a current-source pointer container advanced by this transition.
 *
 * @param path - Repository-relative pointer-container path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCallbackSubtypeNpmBrowserPointers = (
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
