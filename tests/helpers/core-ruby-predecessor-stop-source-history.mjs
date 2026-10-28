/**
 * Preserve the exact Ruby predecessor-stop repair and its central
 * registration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreRubyPredecessorStopHistoryPath
	= "docs/evidence/core-ruby-predecessor-stop-source-history-20261028.json";
export const coreRubyPredecessorStopPredecessor
	= "60f6c69a5a9de9969715e0333d72d0a73588c876";
export const coreRubyPredecessorStopImplementation
	= "83703de7f3f3e578603cf1b468effd5f00867ce0";
export const coreRubyPredecessorStopImplementationPaths = Object.freeze([
	"tests/owned-ruby-evidence.test.mjs"
]);
export const coreRubyPredecessorStopIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-10.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const coreRubyPredecessorStopNormalizationPaths = Object.freeze([
	...coreRubyPredecessorStopImplementationPaths
	, ...coreRubyPredecessorStopIntegrationPaths
]);
export const coreRubyPredecessorStopAddedPaths = Object.freeze([
	"scripts/update-core-ruby-predecessor-stop-source-history.mjs"
	, "tests/helpers/core-ruby-predecessor-stop-source-history-tests.mjs"
	, "tests/helpers/core-ruby-predecessor-stop-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	coreRubyPredecessorStopHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated source transition.
 *
 * @param source - Complete current source.
 * @param update - Recorded transition.
 */
export const reverseCoreRubyPredecessorStopUpdate = (source, update) => {
	assert.ok(coreRubyPredecessorStopNormalizationPaths.includes(update.path));
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
 * Remove only the recognized Ruby predecessor-stop transition and its
 * registration, stopping at an optional exact digest.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeCoreRubyPredecessorStopSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreRubyPredecessorStopNormalizationPaths.includes(path))
		return source;
	const value = record();
	const updates = [...value.integrationUpdates, ...value.updates];
	let current = source;
	for(let count = 0; count < updates.length; ++count)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseCoreRubyPredecessorStopUpdate(current, update);
	}
	return current;
};
