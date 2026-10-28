/**
 * Reverse central registration of the authenticated callback Fin milestone-read history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const callbackFinMilestoneReadIntegrationHistoryPath
	= "docs/evidence/callback-fin-milestone-read-integration-source-history-20261028.json";
export const callbackFinMilestoneReadIntegrationBase
	= "4628fbc711dcb8db8ed2e030a8b1e7c270ea0c64";
export const callbackFinMilestoneReadIntegrationImplementation
	= "dc6e4a1287b8e23a7b69829462bab92759f6109e";
export const callbackFinMilestoneReadIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript-partition-10.test.mjs"
]);
export const callbackFinMilestoneReadIntegrationNormalizationPaths
	= callbackFinMilestoneReadIntegrationPaths;
export const callbackFinMilestoneReadIntegrationAddedPaths = Object.freeze([
	"scripts/update-callback-fin-milestone-read-integration-source-history.mjs"
	, "tests/helpers/callback-fin-milestone-read-integration-source-history-tests.mjs"
	, "tests/helpers/callback-fin-milestone-read-integration-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	callbackFinMilestoneReadIntegrationHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated integration transition.
 *
 * @param source - Complete current source text.
 * @param update - Recorded transition.
 */
export const reverseCallbackFinMilestoneReadIntegrationUpdate = (
	source, update
) => {
	assert.ok(callbackFinMilestoneReadIntegrationPaths.includes(update.path));
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
 * Remove only this integration layer, stopping at an optional exact digest.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeCallbackFinMilestoneReadIntegrationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !callbackFinMilestoneReadIntegrationPaths.includes(path)) return source;
	if(sha256(source) === expected) return source;
	const update = record().updates.find(item =>
		item.path === path && item.currentSha256 === sha256(source));
	return update === undefined ? source
		: reverseCallbackFinMilestoneReadIntegrationUpdate(source, update);
};
