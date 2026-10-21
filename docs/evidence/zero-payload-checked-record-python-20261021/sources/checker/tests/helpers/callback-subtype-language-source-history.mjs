/**
 * Reverse the authenticated Python, Ruby and Rust callback Subtype transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const callbackSubtypeLanguageHistoryPath
	= "docs/evidence/callback-subtype-languages-source-history-20261020.json";
export const callbackSubtypeLanguagePredecessor
	= "8430f5c82ca80caf73420da29fd8fb536c8fcbe8";
export const callbackSubtypeLanguageImplementation
	= "c11b7c6dbd0842eb4adac520c98f0faba4fd62c3";
export const callbackSubtypeLanguageChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "docs/consume/python.md"
	, "docs/consume/ruby.md"
	, "docs/consume/rust.md"
	, "docs/contributing/testing.md"
	, "docs/lean/existing-package.md"
	, "src/backends/python/callable-graph-conversions.mjs"
	, "src/backends/python/callable-graph-model.mjs"
	, "src/backends/python/callable-graph-package.mjs"
	, "src/backends/ruby/callable-graph-conversions.mjs"
	, "src/backends/ruby/callable-graph-model.mjs"
	, "src/backends/ruby/callable-graph-package.mjs"
	, "src/backends/rust/callable-graph-conversions.mjs"
	, "src/backends/rust/callable-graph-model.mjs"
	, "src/backends/rust/callable-graph-package.mjs"
	, "src/build/native-graph-projection.mjs"
	, "tests/callback-subtype-native-ci.test.mjs"
	, "tests/helpers/callback-subtype-native-ci.mjs"
	, "tests/helpers/copied-fixture-install.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/native-recursive-callable-model.test.mjs"
	, "tests/type-surface.test.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	callbackSubtypeLanguageHistoryPath, "utf8"
));

/**
 * Restore one complete update after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseCallbackSubtypeLanguageUpdate = (source, update) => {
	assert.ok(callbackSubtypeLanguageChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0; const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), ["current", "previous", "start"]);
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
 * Remove only this exact language callback Subtype transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCallbackSubtypeLanguageSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !callbackSubtypeLanguageChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseCallbackSubtypeLanguageUpdate(source, update) : source;
};
