/**
 * Reverse the callback checked-record archive commit-provenance repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const callbackCheckedRecordArchiveCommitProvenanceHistoryPath
	= "docs/evidence/callback-checked-record-archive-commit-provenance-source-history-20261023.json";
export const callbackCheckedRecordArchiveCommitProvenancePredecessor
	= "154de928fb1a23f9920767a3f77a6132fccd7878";
export const callbackCheckedRecordArchiveCommitProvenanceImplementation
	= "2c3727842468db1f5720aabd7512aff1f88f759e";
export const callbackCheckedRecordArchiveCommitProvenanceChangedPaths
	= Object.freeze([
		"scripts/archive-callback-checked-record-evidence.mjs"
		, "tests/callback-checked-record-hosted-archive.test.mjs"
		, "tests/helpers/callback-checked-record-hosted-evidence-sources.mjs"
		, "tests/helpers/callback-checked-record-hosted-evidence.mjs"
	]);
export const callbackCheckedRecordArchiveCommitProvenanceIntegrationPaths
	= Object.freeze([
		"tests/component-array-contract.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const callbackCheckedRecordArchiveCommitProvenanceNormalizationPaths
	= Object.freeze([
		...callbackCheckedRecordArchiveCommitProvenanceChangedPaths
		, ...callbackCheckedRecordArchiveCommitProvenanceIntegrationPaths
	]);
export const callbackCheckedRecordArchiveCommitProvenanceAddedPaths
	= Object.freeze([
		"scripts/update-callback-checked-record-archive-commit-provenance-source-history.mjs"
		, "tests/helpers/callback-checked-record-archive-commit-provenance-source-history-tests.mjs"
		, "tests/helpers/callback-checked-record-archive-commit-provenance-source-history.mjs"
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	callbackCheckedRecordArchiveCommitProvenanceHistoryPath, "utf8"
));

/**
 * Reverse one exact archive commit-provenance transition.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseCallbackCheckedRecordArchiveCommitProvenanceUpdate = (
	source, update
) => {
	assert.ok(callbackCheckedRecordArchiveCommitProvenanceNormalizationPaths
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
 * Remove only the exact archive commit-provenance repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeCallbackCheckedRecordArchiveCommitProvenanceSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !callbackCheckedRecordArchiveCommitProvenanceNormalizationPaths
			.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = [...value.integrationUpdates, ...value.updates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reverseCallbackCheckedRecordArchiveCommitProvenanceUpdate(
			source, update)
		: source;
};
