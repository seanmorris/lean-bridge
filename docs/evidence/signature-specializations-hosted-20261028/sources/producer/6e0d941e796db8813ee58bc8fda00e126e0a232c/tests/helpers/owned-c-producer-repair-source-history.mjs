/**
 * Reverse the explicit Owned C producer repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedCProducerRepairHistoryPath
	= "docs/evidence/owned-c-producer-repair-source-history-20261024.json";
export const ownedCProducerRepairPredecessor
	= "18788f75277f468b143346188a93c9bce62cd0fd";
export const ownedCProducerRepairImplementation
	= "14990193fa2d2e211b327f0f730afa85477a769f";
export const ownedCProducerRepairIntegrationBase
	= "4393c5bad5c7bbf195cbf8a8685eb0334810edd3";
export const ownedCProducerRepairChangedPaths = Object.freeze([
	"tests/helpers/owned-aggregate-evidence.mjs"
	, "tests/helpers/owned-borrow-ci-evidence.mjs"
	, "tests/helpers/owned-borrow-evidence.mjs"
	, "tests/helpers/owned-c-evidence.mjs"
	, "tests/helpers/owned-package-evidence.mjs"
	, "tests/helpers/owned-reviewed-evidence.mjs"
	, "tests/owned-borrow-evidence.test.mjs"
	, "tests/owned-package-evidence.test.mjs"
]);
export const ownedCProducerRepairIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const ownedCProducerRepairNormalizationPaths = Object.freeze([
	...ownedCProducerRepairChangedPaths
	, ...ownedCProducerRepairIntegrationPaths
]);
export const ownedCProducerRepairAddedPaths = Object.freeze([
	"scripts/update-owned-c-producer-repair-source-history.mjs"
	, "tests/helpers/owned-c-producer-repair-source-history-tests.mjs"
	, "tests/helpers/owned-c-producer-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedCProducerRepairHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseOwnedCProducerRepairUpdate = (
	source, update
) => {
	assert.ok(ownedCProducerRepairNormalizationPaths
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
 * Remove only the exact Owned C producer repair.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeOwnedCProducerRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedCProducerRepairNormalizationPaths.includes(path))
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
		current = reverseOwnedCProducerRepairUpdate(current, update);
	}
	return current;
};
