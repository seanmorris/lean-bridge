/**
 * Preserve the remaining historical pin-snapshot isolation repairs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const historicalPinSnapshotFollowupHistoryPath
	= "docs/evidence/historical-pin-snapshot-followup-source-history-20261106.json";
export const historicalPinSnapshotFollowupPredecessor
	= "885ed29d2b95fc33c28121c9a569faa4e47ddfe6";
export const historicalPinSnapshotFollowupImplementation
	= "b04d62a5d68daf66d49ad376d38700b45c31a96f";
export const historicalPinSnapshotFollowupImplementationPaths = Object.freeze([
	"tests/helpers/checked-record-value-index-matrix-evidence-pin-repair-source-history-tests.mjs"
	, "tests/helpers/python-dependent-fin-nat-rejection-source-history-tests.mjs"
]);
export const historicalPinSnapshotFollowupIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const historicalPinSnapshotFollowupHistoryAdditions = Object.freeze([
	"scripts/update-historical-pin-snapshot-followup-source-history.mjs"
	, "tests/helpers/historical-pin-snapshot-followup-source-history-tests.mjs"
	, "tests/helpers/historical-pin-snapshot-followup-source-history.mjs"
]);
export const historicalPinSnapshotFollowupNormalizationPaths = Object.freeze([
	...new Set([
		...historicalPinSnapshotFollowupImplementationPaths
		, ...historicalPinSnapshotFollowupIntegrationPaths
	])
].sort());

let history;
const record = () => history ??= JSON.parse(readFileSync(
	historicalPinSnapshotFollowupHistoryPath, "utf8"));

/**
 * Reverse one exact authenticated transition.
 *
 * @param source - Complete later source.
 * @param update - Authenticated reversible transition.
 */
export const reverseHistoricalPinSnapshotFollowupUpdate = (source, update) => {
	assert.ok(historicalPinSnapshotFollowupNormalizationPaths
		.includes(update.path), update.path);
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
 * Remove integration and implementation transitions in order.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping SHA-256.
 */
export const beforeHistoricalPinSnapshotFollowupSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !historicalPinSnapshotFollowupNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseHistoricalPinSnapshotFollowupUpdate(current, update);
	}
	return current;
};
