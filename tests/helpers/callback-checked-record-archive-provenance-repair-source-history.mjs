/**
 * Reverse the callback checked-record archive provenance repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const callbackCheckedRecordArchiveProvenanceRepairHistoryPath
	= "docs/evidence/callback-checked-record-archive-provenance-repair-source-history-20261023.json";
export const callbackCheckedRecordArchiveProvenanceRepairPredecessor
	= "ae6337886a156324602f9902c7fccdfabfef472c";
export const callbackCheckedRecordArchiveProvenanceRepairImplementation
	= "c1b0fbb540f70588c63a1163082d0173fd5b0bb6";
export const callbackCheckedRecordArchiveProvenanceRepairChangedPaths
	= Object.freeze([
		"scripts/archive-callback-checked-record-evidence.mjs"
		, "tests/callback-checked-record-hosted-archive.test.mjs"
		, "tests/helpers/callback-checked-record-hosted-evidence-sources.mjs"
	]);
export const callbackCheckedRecordArchiveProvenanceRepairIntegrationPaths
	= Object.freeze([
		"tests/component-array-contract.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const callbackCheckedRecordArchiveProvenanceRepairNormalizationPaths
	= Object.freeze([
		...callbackCheckedRecordArchiveProvenanceRepairChangedPaths
		, ...callbackCheckedRecordArchiveProvenanceRepairIntegrationPaths
	]);
export const callbackCheckedRecordArchiveProvenanceRepairAddedPaths
	= Object.freeze([
		"scripts/update-callback-checked-record-archive-provenance-repair-source-history.mjs"
		, "tests/helpers/callback-checked-record-archive-provenance-repair-source-history-tests.mjs"
		, "tests/helpers/callback-checked-record-archive-provenance-repair-source-history.mjs"
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	callbackCheckedRecordArchiveProvenanceRepairHistoryPath, "utf8"
));

/**
 * Reverse one exact archive-provenance transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseCallbackCheckedRecordArchiveProvenanceRepairUpdate = (
	source, update
) => {
	assert.ok(callbackCheckedRecordArchiveProvenanceRepairNormalizationPaths
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
 * Remove only the exact callback archive provenance repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCallbackCheckedRecordArchiveProvenanceRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !callbackCheckedRecordArchiveProvenanceRepairNormalizationPaths
			.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = [...value.integrationUpdates, ...value.updates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reverseCallbackCheckedRecordArchiveProvenanceRepairUpdate(
			source, update
		)
		: source;
};
