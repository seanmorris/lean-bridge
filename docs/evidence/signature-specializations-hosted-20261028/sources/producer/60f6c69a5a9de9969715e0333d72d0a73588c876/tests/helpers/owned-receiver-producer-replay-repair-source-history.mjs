/**
 * Reverse the exact owned receiver producer-replay repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedReceiverProducerReplayRepairHistoryPath
	= "docs/evidence/owned-receiver-producer-replay-repair-source-history-20261023.json";
export const ownedReceiverProducerReplayRepairPredecessor
	= "065fa4db04b295892ab15b755eddbb71377967c7";
export const ownedReceiverProducerReplayRepairImplementation
	= "0e8e2bd4806d2b09e5c8bc88ce765da885e2a6cd";
export const ownedReceiverProducerReplayRepairModifiedPaths = Object.freeze([
	"tests/helpers/owned-python-receiver-evidence.mjs"
	, "tests/helpers/owned-ruby-receiver-evidence.mjs"
]);
export const ownedReceiverProducerReplayRepairImplementationPaths
	= ownedReceiverProducerReplayRepairModifiedPaths;
export const ownedReceiverProducerReplayRepairIntegrationPaths
	= Object.freeze([
		"tests/helpers/fin-refinement-source-history.mjs"
		, "tests/owned-python-receiver-evidence.test.mjs"
	]);
export const ownedReceiverProducerReplayRepairNormalizationPaths
	= Object.freeze([
		...ownedReceiverProducerReplayRepairModifiedPaths
		, ...ownedReceiverProducerReplayRepairIntegrationPaths
	]);
export const ownedReceiverProducerReplayRepairAddedPaths = Object.freeze([
	"scripts/update-owned-receiver-producer-replay-repair-source-history.mjs"
	, "tests/helpers/owned-receiver-producer-replay-repair-source-history-tests.mjs"
	, "tests/helpers/owned-receiver-producer-replay-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedReceiverProducerReplayRepairHistoryPath, "utf8"
));

/**
 * Restore one exact source transition after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseOwnedReceiverProducerReplayRepairUpdate = (
	source, update
) => {
	assert.ok(ownedReceiverProducerReplayRepairNormalizationPaths
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
 * Remove only the exact owned receiver producer-replay repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeOwnedReceiverProducerReplayRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedReceiverProducerReplayRepairNormalizationPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = [...value.integrationUpdates, ...value.updates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update
		? reverseOwnedReceiverProducerReplayRepairUpdate(source, update)
		: source;
};
