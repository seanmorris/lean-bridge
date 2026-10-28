/**
 * Reverse the explicit Owned .NET producer repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedDotnetProducerRepairHistoryPath
	= "docs/evidence/owned-dotnet-producer-repair-source-history-20261024.json";
export const ownedDotnetProducerRepairPredecessor
	= "4393c5bad5c7bbf195cbf8a8685eb0334810edd3";
export const ownedDotnetProducerRepairImplementation
	= "103717bac784d79b6a05ef87b3d448375f321314";
export const ownedDotnetProducerRepairFollowup
	= "7707d0980bbbeba18c0dcebd6f0e7977e92ad9e5";
export const ownedDotnetProducerRepairIntegrationBase
	= "62512ba20176d6186c34df896003972aa3b55706";
export const ownedDotnetProducerRepairChangedPaths = Object.freeze([
	"tests/helpers/owned-dotnet-borrow-evidence.mjs"
	, "tests/owned-dotnet-borrow-evidence.test.mjs"
	, "tests/owned-dotnet-callback-result-history.test.mjs"
	, "tests/owned-dotnet-lifetime-evidence.test.mjs"
]);
export const ownedDotnetProducerRepairFollowupPaths = Object.freeze([
	"tests/owned-borrow-evidence.test.mjs"
	, "tests/owned-dotnet-borrow-evidence.test.mjs"
	, "tests/owned-dotnet-callback-result-history.test.mjs"
	, "tests/owned-dotnet-lifetime-evidence.test.mjs"
]);
export const ownedDotnetProducerRepairIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
	, ...ownedDotnetProducerRepairFollowupPaths
]);
export const ownedDotnetProducerRepairNormalizationPaths = Object.freeze([
	...ownedDotnetProducerRepairChangedPaths
	, ...ownedDotnetProducerRepairIntegrationPaths
]);
export const ownedDotnetProducerRepairAddedPaths = Object.freeze([
	"scripts/update-owned-dotnet-producer-repair-source-history.mjs"
	, "tests/helpers/owned-dotnet-producer-repair-source-history-tests.mjs"
	, "tests/helpers/owned-dotnet-producer-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedDotnetProducerRepairHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseOwnedDotnetProducerRepairUpdate = (
	source, update
) => {
	assert.ok(ownedDotnetProducerRepairNormalizationPaths
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
 * Remove only the exact Owned .NET producer repair.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeOwnedDotnetProducerRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedDotnetProducerRepairNormalizationPaths.includes(path))
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
		current = reverseOwnedDotnetProducerRepairUpdate(current, update);
	}
	return current;
};
