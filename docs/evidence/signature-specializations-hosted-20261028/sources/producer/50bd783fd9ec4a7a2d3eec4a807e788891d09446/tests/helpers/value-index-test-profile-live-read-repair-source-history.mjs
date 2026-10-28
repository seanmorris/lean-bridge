/**
 * Reverse the value-index test-profile milestone-read repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const valueIndexTestProfileLiveReadRepairHistoryPath
	= "docs/evidence/value-index-test-profile-live-read-repair-source-history-20261023.json";
export const valueIndexTestProfileLiveReadRepairPredecessor
	= "bab45780d536bad09368e76f9a594eb91756aec0";
export const valueIndexTestProfileLiveReadRepairImplementation
	= "dabfaef19a73c27ce1d391a06648b7e38f007aff";
export const valueIndexTestProfileLiveReadRepairChangedPaths = Object.freeze([
	"tests/helpers/value-index-test-profile-gap-source-history-tests.mjs"
]);
export const valueIndexTestProfileLiveReadRepairIntegrationPaths
	= Object.freeze([
		"tests/component-array-contract.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const valueIndexTestProfileLiveReadRepairNormalizationPaths
	= Object.freeze([
		...valueIndexTestProfileLiveReadRepairChangedPaths
		, ...valueIndexTestProfileLiveReadRepairIntegrationPaths
	]);
export const valueIndexTestProfileLiveReadRepairAddedPaths = Object.freeze([
	"scripts/update-value-index-test-profile-live-read-repair-source-history.mjs"
	, "tests/helpers/value-index-test-profile-live-read-repair-source-history-tests.mjs"
	, "tests/helpers/value-index-test-profile-live-read-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	valueIndexTestProfileLiveReadRepairHistoryPath, "utf8"
));

/**
 * Reverse one exact value-index test-profile repair transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseValueIndexTestProfileLiveReadRepairUpdate = (
	source, update
) => {
	assert.ok(valueIndexTestProfileLiveReadRepairNormalizationPaths
		.includes(update.path));
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
 * Remove only the exact value-index test-profile milestone-read repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeValueIndexTestProfileLiveReadRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !valueIndexTestProfileLiveReadRepairNormalizationPaths
			.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = [...value.integrationUpdates, ...value.updates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reverseValueIndexTestProfileLiveReadRepairUpdate(source, update)
		: source;
};
