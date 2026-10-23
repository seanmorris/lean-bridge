/**
 * Reverse the PHP-Wasm callback-entry suite split.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const phpWasmCallbackEntrySuiteSplitHistoryPath
	= "docs/evidence/php-wasm-callback-entry-suite-split-source-history-20261022.json";
export const phpWasmCallbackEntrySuiteSplitPredecessor
	= "1689f928f7c4d734176d95252b8de159d6c6a078";
export const phpWasmCallbackEntrySuiteSplitImplementation
	= "672598c391d7224eeb09851f38bc8495227fbd32";
export const phpWasmCallbackEntrySuiteSplitImplementationPaths
	= Object.freeze([
		"scripts/run-php-wasm-callback-entry-ci.sh"
		, "src/adoption/test-profiles.mjs"
		, "tests/callback-refinements-php-wasm.test.mjs"
		, "tests/helpers/php-wasm-callback-entry-ci-tests.mjs"
		, "tests/php-wasm-callback-entry-installed.test.mjs"
	]);
export const phpWasmCallbackEntrySuiteSplitModifiedPaths
	= Object.freeze(phpWasmCallbackEntrySuiteSplitImplementationPaths.slice(0, 4));
export const phpWasmCallbackEntrySuiteSplitImplementationAdditions
	= Object.freeze(["tests/php-wasm-callback-entry-installed.test.mjs"]);
export const phpWasmCallbackEntrySuiteSplitIntegrationPaths
	= Object.freeze([
		"tests/component-array-contract.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const phpWasmCallbackEntrySuiteSplitChangedPaths
	= Object.freeze([
		...phpWasmCallbackEntrySuiteSplitModifiedPaths
		, ...phpWasmCallbackEntrySuiteSplitIntegrationPaths
	]);
export const phpWasmCallbackEntrySuiteSplitAddedPaths
	= Object.freeze([
		...phpWasmCallbackEntrySuiteSplitImplementationAdditions
		, "scripts/update-php-wasm-callback-entry-suite-split-source-history.mjs"
		, "tests/helpers/php-wasm-callback-entry-suite-split-source-history-tests.mjs"
		, "tests/helpers/php-wasm-callback-entry-suite-split-source-history.mjs"
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	phpWasmCallbackEntrySuiteSplitHistoryPath, "utf8"));

/**
 * Reverse one exact callback-entry suite-split transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reversePhpWasmCallbackEntrySuiteSplitUpdate = (source, update) => {
	assert.ok(phpWasmCallbackEntrySuiteSplitChangedPaths.includes(update.path));
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
 * Remove only the exact callback-entry suite split and its integration.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforePhpWasmCallbackEntrySuiteSplitSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !phpWasmCallbackEntrySuiteSplitChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = [...value.integrationUpdates, ...value.updates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reversePhpWasmCallbackEntrySuiteSplitUpdate(source, update)
		: source;
};
