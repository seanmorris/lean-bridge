/**
 * Reverse the explicit Owned C receiver producer repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedCReceiverProducerRepairHistoryPath
	= "docs/evidence/owned-c-receiver-producer-repair-source-history-20261024.json";
export const ownedCReceiverProducerRepairPredecessor
	= "ea29b1dc91b182f4a07885806e32f95e6300cb41";
export const ownedCReceiverProducerRepairImplementation
	= "2fc39d72aaa0983753943cec19158d3a7336c51b";
export const ownedCReceiverProducerRepairIntegrationBase
	= "2fc39d72aaa0983753943cec19158d3a7336c51b";
export const ownedCReceiverProducerRepairChangedPaths = Object.freeze([
	"tests/helpers/owned-receiver-evidence.mjs"
	, "tests/owned-receiver-evidence.test.mjs"
]);
export const ownedCReceiverProducerRepairIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const ownedCReceiverProducerRepairNormalizationPaths = Object.freeze([
	...ownedCReceiverProducerRepairChangedPaths
	, ...ownedCReceiverProducerRepairIntegrationPaths
]);
export const ownedCReceiverProducerRepairAddedPaths = Object.freeze([
	"scripts/update-owned-c-receiver-producer-repair-source-history.mjs"
	, "tests/helpers/owned-c-receiver-producer-repair-source-history-tests.mjs"
	, "tests/helpers/owned-c-receiver-producer-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedCReceiverProducerRepairHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseOwnedCReceiverProducerRepairUpdate = (
	source, update
) => {
	assert.ok(ownedCReceiverProducerRepairNormalizationPaths
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
 * Remove only the exact Owned C receiver producer repair.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeOwnedCReceiverProducerRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedCReceiverProducerRepairNormalizationPaths.includes(path))
		return source;
	const value = record();
	const updates = [...value.integrationUpdates, ...value.updates];
	let current = source;
	for(let count = 0; count < updates.length; count++)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseOwnedCReceiverProducerRepairUpdate(current, update);
	}
	return current;
};
