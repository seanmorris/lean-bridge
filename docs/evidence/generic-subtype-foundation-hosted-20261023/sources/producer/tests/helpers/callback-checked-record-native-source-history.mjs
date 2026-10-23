/**
 * Reverse the authenticated callback checked-record native C, C++ and Perl adapters.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const callbackCheckedRecordNativeHistoryPath
	= "docs/evidence/callback-checked-record-native-source-history-20261021.json";
export const callbackCheckedRecordNativePredecessor
	= "b55c66a17fa33d70817aeea61b47b3a6da2abcf2";
export const callbackCheckedRecordNativeImplementation
	= "3e361d92bac1218179a8c7ac7f1472803597bb18";
export const callbackCheckedRecordNativeChangedPaths = Object.freeze([
	"docs/consume/c.md"
	, "docs/consume/cpp.md"
	, "docs/consume/perl.md"
	, "docs/contributing/testing.md"
	, "docs/type-surface.v1.json"
	, "src/adoption/test-profiles.mjs"
	, "src/backends/perl/callable-graph-package.mjs"
	, "src/build/native-graph-model.mjs"
	, "src/build/native-graph-projection.mjs"
	, "src/release/native-c-family.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/structured-callable-fixture.mjs"
]);
/** The hub transition above spans the implementation and its history commit. */
export const callbackCheckedRecordNativeIntegrationPaths = Object.freeze([]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	callbackCheckedRecordNativeHistoryPath, "utf8"
));

/**
 * Restore one complete update after authenticating both endpoints and edits.
 *
 * @param source - Current complete source text.
 * @param update - Recorded exact update.
 */
export const reverseCallbackCheckedRecordNativeUpdate = (source, update) => {
	assert.ok(callbackCheckedRecordNativeChangedPaths.includes(update.path));
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
 * Remove only this exact callback checked-record native lane milestone.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCallbackCheckedRecordNativeSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !callbackCheckedRecordNativeChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseCallbackCheckedRecordNativeUpdate(source, update) : source;
};
