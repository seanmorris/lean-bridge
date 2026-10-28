/**
 * Reverse the authenticated Python, Ruby and Rust callback checked-record transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const callbackCheckedRecordLanguageHistoryPath
	= "docs/evidence/callback-checked-record-languages-source-history-20261022.json";
export const callbackCheckedRecordLanguagePredecessor
	= "d34148314a2142811c0ebe632290dffe450a7d39";
export const callbackCheckedRecordLanguageImplementation
	= "3f80a5db3efea7f1bee53f358429c97776b25305";
export const callbackCheckedRecordLanguageChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "docs/consume/python.md"
	, "docs/consume/ruby.md"
	, "docs/consume/rust.md"
	, "docs/contributing/testing.md"
	, "src/adoption/test-profiles.mjs"
	, "src/backends/python/callable-graph-package.mjs"
	, "src/backends/ruby/callable-graph-package.mjs"
	, "src/backends/rust/callable-graph-package.mjs"
	, "src/build/native-artifacts.mjs"
	, "src/build/native-graph-projection.mjs"
	, "tests/callback-checked-record-native-ci.test.mjs"
	, "tests/callback-checked-record-native.test.mjs"
	, "tests/helpers/callback-checked-record-native-ci.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/type-surface.test.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	callbackCheckedRecordLanguageHistoryPath, "utf8"
));

/**
 * Restore one complete update after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseCallbackCheckedRecordLanguageUpdate = (source, update) => {
	assert.ok(callbackCheckedRecordLanguageChangedPaths.includes(update.path));
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
 * Remove only this exact language callback checked-record transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCallbackCheckedRecordLanguageSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !callbackCheckedRecordLanguageChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseCallbackCheckedRecordLanguageUpdate(source, update) : source;
};
