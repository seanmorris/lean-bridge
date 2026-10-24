/**
 * Reverse the explicit Owned JVM transfer producer repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedJvmTransferProducerRepairHistoryPath
	= "docs/evidence/owned-jvm-transfer-producer-repair-source-history-20261024.json";
export const ownedJvmTransferProducerRepairPredecessor
	= "0074a334129841c4a287312a9f3353cc4332b4bb";
export const ownedJvmTransferProducerRepairImplementation
	= "3c296f8780786e958a36facc0c70ae6522605069";
export const ownedJvmTransferProducerRepairIntegrationBase
	= "960dd7ad7e101f596f768efd22cede5f9933be39";
export const ownedJvmTransferProducerRepairChangedPaths = Object.freeze([
	"tests/helpers/owned-jvm-transfer-evidence.mjs"
	, "tests/owned-jvm-transfer-evidence.test.mjs"
]);
export const ownedJvmTransferProducerRepairIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const ownedJvmTransferProducerRepairNormalizationPaths = Object.freeze([
	...ownedJvmTransferProducerRepairChangedPaths
	, ...ownedJvmTransferProducerRepairIntegrationPaths
]);
export const ownedJvmTransferProducerRepairAddedPaths = Object.freeze([
	"scripts/update-owned-jvm-transfer-producer-repair-source-history.mjs"
	, "tests/helpers/owned-jvm-transfer-producer-repair-source-history-tests.mjs"
	, "tests/helpers/owned-jvm-transfer-producer-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedJvmTransferProducerRepairHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseOwnedJvmTransferProducerRepairUpdate = (
	source, update
) => {
	assert.ok(ownedJvmTransferProducerRepairNormalizationPaths
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
 * Remove only the exact Owned JVM transfer producer repair.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeOwnedJvmTransferProducerRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedJvmTransferProducerRepairNormalizationPaths.includes(path))
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
		current = reverseOwnedJvmTransferProducerRepairUpdate(current, update);
	}
	return current;
};
