/**
 * Reverse the explicit JavaScript transfer and Nix producer repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedJavaScriptTransferNixProducerRepairHistoryPath
	= "docs/evidence/owned-javascript-transfer-nix-producer-repair-source-history-20261024.json";
export const ownedJavaScriptTransferNixProducerRepairPredecessor
	= "aaa70f358563117cae3f57ac5477d78dcfb8547d";
export const ownedJavaScriptTransferNixProducerRepairImplementation
	= "b9dc0a5f8354509e5d3acd81cc03249f4b08a38d";
export const ownedJavaScriptTransferNixProducerRepairIntegrationBase
	= "b9dc0a5f8354509e5d3acd81cc03249f4b08a38d";
export const ownedJavaScriptTransferNixProducerRepairChangedPaths = Object.freeze([
	"tests/helpers/owned-javascript-nix-evidence.mjs"
	, "tests/helpers/owned-javascript-transfer-evidence.mjs"
	, "tests/owned-javascript-nix-evidence.test.mjs"
	, "tests/owned-javascript-transfer-evidence.test.mjs"
]);
export const ownedJavaScriptTransferNixProducerRepairIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
	, "tests/owned-javascript-nix-evidence.test.mjs"
	, "tests/owned-javascript-transfer-evidence.test.mjs"
]);
export const ownedJavaScriptTransferNixProducerRepairNormalizationPaths = Object.freeze([
	...ownedJavaScriptTransferNixProducerRepairChangedPaths
	, ...ownedJavaScriptTransferNixProducerRepairIntegrationPaths
]);
export const ownedJavaScriptTransferNixProducerRepairAddedPaths = Object.freeze([
	"scripts/update-owned-javascript-transfer-nix-producer-repair-source-history.mjs"
	, "tests/helpers/owned-javascript-transfer-nix-producer-repair-source-history-tests.mjs"
	, "tests/helpers/owned-javascript-transfer-nix-producer-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedJavaScriptTransferNixProducerRepairHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseOwnedJavaScriptTransferNixProducerRepairUpdate = (
	source, update
) => {
	assert.ok(ownedJavaScriptTransferNixProducerRepairNormalizationPaths
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
 * Remove only the exact JavaScript transfer and Nix producer repair.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeOwnedJavaScriptTransferNixProducerRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedJavaScriptTransferNixProducerRepairNormalizationPaths.includes(path))
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
		current = reverseOwnedJavaScriptTransferNixProducerRepairUpdate(current, update);
	}
	return current;
};
