/**
 * Close the two omitted tests/test-profiles.test.mjs transitions of
 * 2026-10-19 (b51d6f6 -> c8f51db -> 656a415) without rewriting their
 * historical commits, so the 2026-10-06 test-profile registration
 * milestone is reachable again.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const testProfilesRegistrationGapHistoryPath
	= "docs/evidence/test-profiles-registration-gap-source-history-20261022.json";
export const testProfilesRegistrationGapPredecessor
	= "7e86a3542847eafca7389032dbb977cc0eeb7682";
export const testProfilesRegistrationGapIntegrationPaths = Object.freeze([
	"tests/component-array-contract.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const testProfilesRegistrationGapHistoricalPaths = Object.freeze([
	"tests/test-profiles.test.mjs"
]);
export const testProfilesRegistrationGapTransitions = Object.freeze([
	Object.freeze({ path: "tests/test-profiles.test.mjs"
		, previousCommit: "c8f51dbbe2cfd679087372aeb24f0b9b8f762a19"
		, currentCommit: "656a41590a2cb583cf1207483c19bfa5051040bd" })
	, Object.freeze({ path: "tests/test-profiles.test.mjs"
		, previousCommit: "b51d6f6378ca9df40f528f2b2fe5bd0d8e97cc5f"
		, currentCommit: "c8f51dbbe2cfd679087372aeb24f0b9b8f762a19" })
]);
export const testProfilesRegistrationGapAddedPaths = Object.freeze([
	"scripts/update-test-profiles-registration-gap-source-history.mjs"
	, "tests/helpers/test-profiles-registration-gap-source-history-tests.mjs"
	, "tests/helpers/test-profiles-registration-gap-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	testProfilesRegistrationGapHistoryPath, "utf8"));

const reverse = (source, update, paths) => {
	assert.ok(paths.includes(update.path), update.path);
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
		assert.equal(typeof edit.previous, "string");
		assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start, edit.start + edit.current.length)
			, edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Reverse this repair's own registration and hub integration.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated integration transition.
 */
export const reverseTestProfilesRegistrationGapUpdate = (source, update) =>
	reverse(source, update, testProfilesRegistrationGapIntegrationPaths);

/**
 * Reverse one omitted historical test-profile transition.
 *
 * @param source - Complete later source text.
 * @param update - Authenticated historical transition.
 */
export const reverseTestProfilesRegistrationGapHistoricalUpdate = (source, update) =>
	reverse(source, update, testProfilesRegistrationGapHistoricalPaths);

/**
 * Remove only this repair's integration. The hub runs it newest-first.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeTestProfilesRegistrationGapSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !testProfilesRegistrationGapIntegrationPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().integrationUpdates.find(item =>
		item.path === path && item.currentSha256 === digest);
	return update ? reverseTestProfilesRegistrationGapUpdate(source, update) : source;
};

/**
 * Walk the two omitted 2026-10-19 states. The hub runs this beside the
 * value-index profile gap, after the 2026-10-20 matrix registration layer
 * has produced the 656a415 source.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeTestProfilesRegistrationGapHistoricalSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !testProfilesRegistrationGapHistoricalPaths.includes(path)) return source;
	let digest = sha256(source);
	while(digest !== expected)
	{
		const update = record().historicalTransitions.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(!update) return source;
		source = reverseTestProfilesRegistrationGapHistoricalUpdate(source, update);
		digest = sha256(source);
	}
	return source;
};
