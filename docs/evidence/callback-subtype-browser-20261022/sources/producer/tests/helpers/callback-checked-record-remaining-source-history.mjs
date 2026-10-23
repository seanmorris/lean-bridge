/**
 * Reverse the authenticated remaining-host callback checked-record transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const callbackCheckedRecordRemainingHistoryPath
	= "docs/evidence/callback-checked-record-remaining-source-history-20261022.json";
export const callbackCheckedRecordRemainingPredecessor
	= "c0d4c8a608e4273c25b42a13bf9dafc960a8f16b";
export const callbackCheckedRecordRemainingImplementation
	= "6a94d28ab1293387e367a35d1dd24962230209f1";
export const callbackCheckedRecordRemainingChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "docs/consume/dotnet.md"
	, "docs/consume/java.md"
	, "docs/consume/kotlin.md"
	, "docs/consume/wit-wasi.md"
	, "docs/php.md"
	, "src/backends/dotnet/callable-graph-package.mjs"
	, "src/backends/jvm/callable-graph-package.mjs"
	, "src/backends/php/callable-graph-package.mjs"
	, "src/backends/wit/callable-graph-package.mjs"
	, "src/build/native-graph-projection.mjs"
	, "tests/callback-checked-record-native-ci.test.mjs"
	, "tests/callback-checked-record-native.test.mjs"
	, "tests/helpers/callback-subtype-wit-install.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/type-surface.test.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	callbackCheckedRecordRemainingHistoryPath, "utf8"
));

/**
 * Restore one complete update after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseCallbackCheckedRecordRemainingUpdate = (source, update) => {
	assert.ok(callbackCheckedRecordRemainingChangedPaths.includes(update.path));
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
 * Remove only this exact remaining-host callback checked-record transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCallbackCheckedRecordRemainingSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !callbackCheckedRecordRemainingChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseCallbackCheckedRecordRemainingUpdate(source, update) : source;
};
