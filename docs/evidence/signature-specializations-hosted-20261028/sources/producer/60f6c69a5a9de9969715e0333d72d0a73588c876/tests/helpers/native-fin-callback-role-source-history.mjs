/**
 * Reverse the native Fin callback-role enablement (54426dd), whose 22 source
 * transitions were never recorded. Every transition comes from exact Git
 * blobs of that commit and its parent; no evidence is rewritten.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const nativeFinCallbackRoleHistoryPath
	= "docs/evidence/native-fin-callback-role-source-history-20261028.json";
export const nativeFinCallbackRolePredecessor
	= "9001c1b2a3cdc6aa6f900d9bff8540cc6fd14e29";
export const nativeFinCallbackRoleImplementation
	= "54426ddd2279def91639a32c8ad74826ba6fbf94";
export const nativeFinCallbackRoleChangedPaths = Object.freeze([
	"src/backends/c/callable-graph-model.mjs"
	, "src/backends/dotnet/callable-graph-model.mjs"
	, "src/backends/dotnet/callable-graph-package.mjs"
	, "src/backends/jvm/callable-graph-model.mjs"
	, "src/backends/jvm/callable-graph-package.mjs"
	, "src/backends/perl/callable-graph-model.mjs"
	, "src/backends/perl/callable-graph-package.mjs"
	, "src/backends/php/callable-graph-model.mjs"
	, "src/backends/php/callable-graph-package.mjs"
	, "src/backends/python/callable-graph-model.mjs"
	, "src/backends/python/callable-graph-package.mjs"
	, "src/backends/ruby/callable-graph-model.mjs"
	, "src/backends/ruby/callable-graph-package.mjs"
	, "src/backends/rust/callable-graph-model.mjs"
	, "src/backends/rust/callable-graph-package.mjs"
	, "src/backends/wit/callable-graph-package.mjs"
	, "src/build/native-component.mjs"
	, "src/build/native-graph-model.mjs"
	, "src/build/native-graph-sources.mjs"
	, "src/release/native-c-family.mjs"
	, "tests/callback-checked-record-native.test.mjs"
	, "tests/native-recursive-callable-model.test.mjs"
]);
export const nativeFinCallbackRoleNormalizationPaths
	= nativeFinCallbackRoleChangedPaths;
export const nativeFinCallbackRoleAddedPaths = Object.freeze([
	"scripts/update-native-fin-callback-role-source-history.mjs"
	, "tests/helpers/native-fin-callback-role-source-history-tests.mjs"
	, "tests/helpers/native-fin-callback-role-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	nativeFinCallbackRoleHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated transition.
 *
 * @param {string} source - Complete current source text.
 * @param {object} update - Recorded transition.
 */
export const reverseNativeFinCallbackRoleUpdate = (source, update) => {
	assert.ok(nativeFinCallbackRoleNormalizationPaths.includes(update.path));
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
 * Remove only this layer's recognized transition. The central hub owns
 * stopping and re-entry.
 *
 * @param {string} path - Repository-relative source path.
 * @param {string} source - Complete current or historical source.
 * @param {string} [expected] - Stop digest, decided by the central hub.
 */
export const beforeNativeFinCallbackRoleSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !nativeFinCallbackRoleNormalizationPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates
		.find(item => item.path === path && item.currentSha256 === digest);
	return update === undefined ? source
		: reverseNativeFinCallbackRoleUpdate(source, update);
};
