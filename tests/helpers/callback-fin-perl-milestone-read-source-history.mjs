/**
 * Reverse the Perl callback Fin milestone-read repair: the Perl direction and
 * host repair layer tests read their sources at authenticated milestones.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const callbackFinPerlMilestoneReadHistoryPath
	= "docs/evidence/callback-fin-perl-milestone-read-source-history-20261028.json";
export const callbackFinPerlMilestoneReadPredecessor
	= "60f6c69a5a9de9969715e0333d72d0a73588c876";
export const callbackFinPerlMilestoneReadImplementation
	= "f1cc273ecf4cefa7d9ab28c68d652321dbfdfc2b";
export const callbackFinPerlMilestoneReadCommits = Object.freeze([
	"f1cc273ecf4cefa7d9ab28c68d652321dbfdfc2b"
]);
export const callbackFinPerlMilestoneReadChangedPaths = Object.freeze([
	"tests/helpers/callback-fin-host-repair-source-history-tests.mjs"
	, "tests/helpers/callback-fin-perl-direction-source-history-tests.mjs"
]);
export const callbackFinPerlMilestoneReadNormalizationPaths
	= callbackFinPerlMilestoneReadChangedPaths;
export const callbackFinPerlMilestoneReadImplementationAddedPaths = Object.freeze([]);
export const callbackFinPerlMilestoneReadHistoryAddedPaths = Object.freeze([
	"scripts/update-callback-fin-perl-milestone-read-source-history.mjs"
	, "tests/helpers/callback-fin-perl-milestone-read-source-history-tests.mjs"
	, "tests/helpers/callback-fin-perl-milestone-read-source-history.mjs"
]);
export const callbackFinPerlMilestoneReadAddedPaths = Object.freeze([
	...callbackFinPerlMilestoneReadImplementationAddedPaths
	, ...callbackFinPerlMilestoneReadHistoryAddedPaths
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	callbackFinPerlMilestoneReadHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated transition.
 *
 * @param {string} source - Complete current source text.
 * @param {object} update - Recorded transition.
 */
export const reverseCallbackFinPerlMilestoneReadUpdate = (source, update) => {
	assert.ok(callbackFinPerlMilestoneReadNormalizationPaths.includes(update.path));
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
export const beforeCallbackFinPerlMilestoneReadSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !callbackFinPerlMilestoneReadNormalizationPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates
		.find(item => item.path === path && item.currentSha256 === digest);
	return update === undefined ? source
		: reverseCallbackFinPerlMilestoneReadUpdate(source, update);
};
