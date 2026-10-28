/**
 * Preserve the local join between the Ruby exact-stop layer and Claude's
 * callback Fin Perl milestone-read integration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const callbackFinPerlLocalJoinHistoryPath
	= "docs/evidence/callback-fin-perl-local-join-source-history-20261028.json";
export const callbackFinPerlLocalJoinPredecessor
	= "a6b1a5396af320def336f3106eb22a94720cc713";
export const callbackFinPerlLocalJoinImplementation
	= "19d745de0aea41fe832f34608ef196f8d97cdadf";
export const callbackFinPerlLocalJoinCommits = Object.freeze([
	"2bf1e3187a62aa7d1356fc9560acda761ea95990"
	, "19d745de0aea41fe832f34608ef196f8d97cdadf"
]);
export const callbackFinPerlLocalJoinChangedPaths = Object.freeze([
	"tests/checked-javascript-partition-10.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const callbackFinPerlLocalJoinNormalizationPaths
	= callbackFinPerlLocalJoinChangedPaths;
export const callbackFinPerlLocalJoinImplementationAddedPaths = Object.freeze([
	"docs/evidence/callback-fin-perl-milestone-read-integration-source-history-20261028.json"
	, "scripts/update-callback-fin-perl-milestone-read-integration-source-history.mjs"
	, "tests/helpers/callback-fin-perl-milestone-read-integration-source-history-tests.mjs"
	, "tests/helpers/callback-fin-perl-milestone-read-integration-source-history.mjs"
]);
export const callbackFinPerlLocalJoinHistoryAddedPaths = Object.freeze([
	"scripts/update-callback-fin-perl-local-join-source-history.mjs"
	, "tests/helpers/callback-fin-perl-local-join-source-history-tests.mjs"
	, "tests/helpers/callback-fin-perl-local-join-source-history.mjs"
]);
export const callbackFinPerlLocalJoinAddedPaths = Object.freeze([
	...callbackFinPerlLocalJoinImplementationAddedPaths
	, ...callbackFinPerlLocalJoinHistoryAddedPaths
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	callbackFinPerlLocalJoinHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated source transition.
 *
 * @param source - Complete current source.
 * @param update - Recorded transition.
 */
export const reverseCallbackFinPerlLocalJoinUpdate = (source, update) => {
	assert.ok(callbackFinPerlLocalJoinNormalizationPaths.includes(update.path));
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
 * Remove the local join and then the merged Perl integration, stopping at an
 * optional exact digest.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeCallbackFinPerlLocalJoinSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !callbackFinPerlLocalJoinNormalizationPaths.includes(path))
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
		current = reverseCallbackFinPerlLocalJoinUpdate(current, update);
	}
	return current;
};
