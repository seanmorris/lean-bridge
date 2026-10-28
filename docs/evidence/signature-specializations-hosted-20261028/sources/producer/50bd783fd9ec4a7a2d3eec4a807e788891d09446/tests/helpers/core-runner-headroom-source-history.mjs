/**
 * Reverse the authenticated hosted Core runner-headroom transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreRunnerHeadroomHistoryPath
	= "docs/evidence/core-runner-headroom-source-history-20261021.json";
export const coreRunnerHeadroomPredecessor
	= "fce86f9eb299073eca8dc0ab4ebeafabdb01381f";
export const coreRunnerHeadroomImplementation
	= "17716f7162e8607cffb484699cfbec7121d06194";
export const coreRunnerHeadroomChangedPaths = Object.freeze([
	".github/workflows/quality.yml"
	, "tests/helpers/core-quality-budget-tests.mjs"
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	coreRunnerHeadroomHistoryPath, "utf8"
));

/**
 * Restore one complete update after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition for the same path.
 */
export const reverseCoreRunnerHeadroomUpdate = (source, update) => {
	assert.ok(coreRunnerHeadroomChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0; const parts = [];
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
 * Remove only this exact runner-headroom transition.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCoreRunnerHeadroomSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !coreRunnerHeadroomChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseCoreRunnerHeadroomUpdate(source, update) : source;
};
