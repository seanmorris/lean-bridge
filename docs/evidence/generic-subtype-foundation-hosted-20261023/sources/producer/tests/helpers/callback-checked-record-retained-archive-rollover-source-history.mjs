/**
 * Reverse the retained callback checked-record archive rollover.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const callbackCheckedRecordRetainedArchiveRolloverHistoryPath
	= "docs/evidence/callback-checked-record-retained-archive-rollover-source-history-20261023.json";
export const callbackCheckedRecordRetainedArchiveRolloverPredecessor
	= "3de06613ef656fe2e3d7d1ac168850f3b047fc93";
export const callbackCheckedRecordRetainedArchiveRolloverImplementation
	= "a7ab0e6090f183009bd62bd9294b6ddc047c38ed";
export const callbackCheckedRecordRetainedArchiveRolloverChangedPaths
	= Object.freeze([
		"scripts/archive-callback-checked-record-evidence.mjs"
		, "tests/callback-checked-record-hosted-archive.test.mjs"
		, "tests/callback-checked-record-hosted-evidence.test.mjs"
		, "tests/helpers/callback-checked-record-hosted-evidence-sources.mjs"
	]);
export const callbackCheckedRecordRetainedArchiveRolloverIntegrationPaths
	= Object.freeze([
		"tests/component-array-contract.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const callbackCheckedRecordRetainedArchiveRolloverNormalizationPaths
	= Object.freeze([
		...callbackCheckedRecordRetainedArchiveRolloverChangedPaths
		, ...callbackCheckedRecordRetainedArchiveRolloverIntegrationPaths
	]);
export const callbackCheckedRecordRetainedArchiveRolloverAddedPaths
	= Object.freeze([
		"scripts/update-callback-checked-record-retained-archive-rollover-source-history.mjs"
		, "tests/helpers/callback-checked-record-retained-archive-rollover-source-history-tests.mjs"
		, "tests/helpers/callback-checked-record-retained-archive-rollover-source-history.mjs"
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	callbackCheckedRecordRetainedArchiveRolloverHistoryPath, "utf8"
));

/**
 * Reverse one exact retained-archive rollover transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseCallbackCheckedRecordRetainedArchiveRolloverUpdate = (
	source, update
) => {
	assert.ok(callbackCheckedRecordRetainedArchiveRolloverNormalizationPaths
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
 * Remove only the exact retained callback archive rollover.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCallbackCheckedRecordRetainedArchiveRolloverSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !callbackCheckedRecordRetainedArchiveRolloverNormalizationPaths
			.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = [...value.integrationUpdates, ...value.updates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reverseCallbackCheckedRecordRetainedArchiveRolloverUpdate(
			source, update
		)
		: source;
};
