/**
 * Authenticate the contract-suite repair that routes historical checks through
 * the complete source lineage and refreshes the affected current-source pins.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ciContractRepairHistoryPath
	= "docs/evidence/ci-contract-repair-source-history-20261017.json";
export const ciContractRepairPredecessor
	= "cfb5534b43e62a6459f65638edd55af415b27263";
export const ciContractRepairPathSetSha256
	= "a95c2f83cce0563bc71df0c3bcb6b042536edca9c528f6286f72e7c0dc002fdf";

const history = JSON.parse(readFileSync(ciContractRepairHistoryPath, "utf8"));
export const ciContractRepairChangedPaths = Object.freeze(
	history.updates.map(update => update.path)
);
assert.equal(history.schemaVersion, 1);
assert.equal(history.milestone, "ci-contract-repair-source-v1");
assert.equal(history.predecessorCommit, ciContractRepairPredecessor);
assert.equal(new Set(ciContractRepairChangedPaths).size
	, ciContractRepairChangedPaths.length);
assert.deepEqual(ciContractRepairChangedPaths
	, [...ciContractRepairChangedPaths].sort());
assert.equal(sha256(JSON.stringify(ciContractRepairChangedPaths))
	, ciContractRepairPathSetSha256);

/**
 * Reverse one complete, exact repair transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated source transition.
 */
export const reverseCiContractRepairUpdate = (source, update) => {
	assert.ok(ciContractRepairChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.ok(Number.isSafeInteger(edit.start) && edit.start >= cursor
			&& edit.start <= source.length);
		assert.equal(typeof edit.previous, "string");
		assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start, edit.start + edit.current.length)
			, edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only this repair at its exact recorded source identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeCiContractRepairSource = (path, source, expected) => {
	if(typeof source !== "string"
		|| !ciContractRepairChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = history.updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseCiContractRepairUpdate(source, update) : source;
};

/**
 * Restore only source pins refreshed by this exact repair transition.
 *
 * @param inventory - Earlier inventory recomputed with current source hashes.
 */
export const beforeCiContractRepairPins = inventory => {
	const previous = structuredClone(inventory);
	for(const entry of previous.evidence) for(const file of entry.files)
	{
		const update = history.pinUpdates.find(item => item.path === file.path);
		if(update?.currentSha256 === file.sha256)
			file.sha256 = update.previousSha256;
	}
	return previous;
};
