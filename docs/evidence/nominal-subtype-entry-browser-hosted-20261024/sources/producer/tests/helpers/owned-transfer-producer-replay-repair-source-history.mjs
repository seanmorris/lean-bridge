/**
 * Reverse the exact owned transfer producer-replay repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedTransferProducerReplayRepairHistoryPath
	= "docs/evidence/owned-transfer-producer-replay-repair-source-history-20261023.json";
export const ownedTransferProducerReplayRepairPredecessor
	= "f92a60c2f7b863bc79d64afb2256b63f6d016b0d";
export const ownedTransferProducerReplayRepairImplementation
	= "c65cc19e1209a6e879928d68836e3239e111809f";
export const ownedTransferProducerReplayRepairModifiedPaths = Object.freeze([
	"tests/helpers/owned-python-transfer-evidence.mjs"
	, "tests/helpers/wit-owned-transfer-evidence.mjs"
]);
export const ownedTransferProducerReplayRepairImplementationPaths
	= ownedTransferProducerReplayRepairModifiedPaths;
export const ownedTransferProducerReplayRepairIntegrationPaths
	= Object.freeze([
		"tests/helpers/fin-refinement-source-history.mjs"
		, "tests/owned-python-transfer-evidence.test.mjs"
	]);
export const ownedTransferProducerReplayRepairNormalizationPaths
	= Object.freeze([
		...ownedTransferProducerReplayRepairModifiedPaths
		, ...ownedTransferProducerReplayRepairIntegrationPaths
	]);
export const ownedTransferProducerReplayRepairAddedPaths = Object.freeze([
	"scripts/update-owned-transfer-producer-replay-repair-source-history.mjs"
	, "tests/helpers/owned-transfer-producer-replay-repair-source-history-tests.mjs"
	, "tests/helpers/owned-transfer-producer-replay-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedTransferProducerReplayRepairHistoryPath, "utf8"
));

/**
 * Restore one exact source transition after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseOwnedTransferProducerReplayRepairUpdate = (
	source, update
) => {
	assert.ok(ownedTransferProducerReplayRepairNormalizationPaths
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
 * Remove only the exact owned transfer producer-replay repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeOwnedTransferProducerReplayRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedTransferProducerReplayRepairNormalizationPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = [...value.integrationUpdates, ...value.updates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reverseOwnedTransferProducerReplayRepairUpdate(source, update)
		: source;
};
