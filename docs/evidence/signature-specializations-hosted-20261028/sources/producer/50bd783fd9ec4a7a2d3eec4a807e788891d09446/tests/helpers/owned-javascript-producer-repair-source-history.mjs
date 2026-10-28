/**
 * Reverse the explicit Owned JavaScript producer repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedJavaScriptProducerRepairHistoryPath
	= "docs/evidence/owned-javascript-producer-repair-source-history-20261024.json";
export const ownedJavaScriptProducerRepairPredecessor
	= "a2cf82a85c1b36bc6f215022821b09da980a459a";
export const ownedJavaScriptProducerRepairImplementation
	= "c01ab98959c1dca38a9fdcc11080cfe4ad8cc298";
export const ownedJavaScriptProducerRepairFollowup
	= "e9232c4933a8a2216a96fdd4f50b8c59c056aede";
export const ownedJavaScriptProducerRepairIntegrationBase
	= "fdcf5061aaf341e5669376da96419fd5a29da1df";
export const ownedJavaScriptProducerRepairChangedPaths = Object.freeze([
	"tests/helpers/owned-javascript-borrow-evidence.mjs"
	, "tests/owned-javascript-borrow-evidence.test.mjs"
	, "tests/owned-javascript-coexistence-evidence.test.mjs"
]);
export const ownedJavaScriptProducerRepairFollowupPaths = Object.freeze([
	"tests/owned-javascript-coexistence-evidence.test.mjs"
]);
export const ownedJavaScriptProducerRepairIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
	, ...ownedJavaScriptProducerRepairFollowupPaths
]);
export const ownedJavaScriptProducerRepairNormalizationPaths = Object.freeze([
	...ownedJavaScriptProducerRepairChangedPaths
	, ...ownedJavaScriptProducerRepairIntegrationPaths
]);
export const ownedJavaScriptProducerRepairAddedPaths = Object.freeze([
	"scripts/update-owned-javascript-producer-repair-source-history.mjs"
	, "tests/helpers/owned-javascript-producer-repair-source-history-tests.mjs"
	, "tests/helpers/owned-javascript-producer-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedJavaScriptProducerRepairHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseOwnedJavaScriptProducerRepairUpdate = (
	source, update
) => {
	assert.ok(ownedJavaScriptProducerRepairNormalizationPaths
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
 * Remove only the exact Owned JavaScript producer repair.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeOwnedJavaScriptProducerRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedJavaScriptProducerRepairNormalizationPaths.includes(path))
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
		current = reverseOwnedJavaScriptProducerRepairUpdate(current, update);
	}
	return current;
};
