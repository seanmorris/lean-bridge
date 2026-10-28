/**
 * Reverse the callback Fin milestone-read repair: six layer tests read their
 * sources at authenticated milestones and the merged hub-order integration
 * is reversed first.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const callbackFinMilestoneReadHistoryPath
	= "docs/evidence/callback-fin-milestone-read-source-history-20261028.json";
export const callbackFinMilestoneReadPredecessor
	= "50bd783fd9ec4a7a2d3eec4a807e788891d09446";
export const callbackFinMilestoneReadImplementation
	= "7d054389ad98e10e246cbcb32b532b9faf6bc3c1";
export const callbackFinMilestoneReadCommits = Object.freeze([
	"4255167c69146dfeeea473c2d0fa4851b5b55bde"
	, "7d054389ad98e10e246cbcb32b532b9faf6bc3c1"
]);
export const callbackFinMilestoneReadChangedPaths = Object.freeze([
	"tests/helpers/callback-fin-diagnostic-contract-source-history-tests.mjs"
	, "tests/helpers/callback-fin-hosted-workflow-source-history-tests.mjs"
	, "tests/helpers/callback-fin-installed-repair-source-history-tests.mjs"
	, "tests/helpers/callback-fin-native-capability-source-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/reviewed-callback-fin-browser-source-history-tests.mjs"
	, "tests/helpers/reviewed-fin-wasm-field-source-history-tests.mjs"
]);
export const callbackFinMilestoneReadNormalizationPaths
	= callbackFinMilestoneReadChangedPaths;
export const callbackFinMilestoneReadImplementationAddedPaths = Object.freeze([]);
export const callbackFinMilestoneReadHistoryAddedPaths = Object.freeze([
	"scripts/update-callback-fin-milestone-read-source-history.mjs"
	, "tests/helpers/callback-fin-milestone-read-source-history-tests.mjs"
	, "tests/helpers/callback-fin-milestone-read-source-history.mjs"
]);
export const callbackFinMilestoneReadAddedPaths = Object.freeze([
	...callbackFinMilestoneReadImplementationAddedPaths
	, ...callbackFinMilestoneReadHistoryAddedPaths
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	callbackFinMilestoneReadHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated transition.
 *
 * @param {string} source - Complete current source text.
 * @param {object} update - Recorded transition.
 */
export const reverseCallbackFinMilestoneReadUpdate = (source, update) => {
	assert.ok(callbackFinMilestoneReadNormalizationPaths.includes(update.path));
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
 * Remove only this layer's recognized transition. The central hub owns
 * stopping and re-entry.
 *
 * @param {string} path - Repository-relative source path.
 * @param {string} source - Complete current or historical source.
 * @param {string} [expected] - Stop digest, decided by the central hub.
 */
export const beforeCallbackFinMilestoneReadSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !callbackFinMilestoneReadNormalizationPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates
		.find(item => item.path === path && item.currentSha256 === digest);
	return update === undefined ? source
		: reverseCallbackFinMilestoneReadUpdate(source, update);
};
