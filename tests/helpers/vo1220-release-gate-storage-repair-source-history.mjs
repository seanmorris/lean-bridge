/**
 * Preserve the bounded release-gate checkout and stale site-contract repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const vo1220ReleaseGateStorageRepairHistoryPath
	= "docs/evidence/vo1220-release-gate-storage-repair-source-history-20261112.json";
export const vo1220ReleaseGateStorageRepairPredecessor
	= "b98cc4893e857a32d2b087b0b3acea9aa838bde5";
export const vo1220ReleaseGateStorageRepairImplementation
	= "880fce13d74ce0e804edb80b6ae21b8671acd9b5";
export const vo1220ReleaseGateStorageRepairImplementationPaths
	= Object.freeze([
		"site/workflows.test.mjs"
		, "src/release/component-reproducibility-gate.mjs"
		, "src/release/reproducibility-gate.mjs"
		, "tests/reproducibility-gate.test.mjs"
	]);
export const vo1220ReleaseGateStorageRepairIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const vo1220ReleaseGateStorageRepairAddedPaths
	= Object.freeze([
		"scripts/update-vo1220-release-gate-storage-repair-source-history.mjs"
		, "tests/helpers/vo1220-release-gate-storage-repair-source-history-tests.mjs"
		, "tests/helpers/vo1220-release-gate-storage-repair-source-history.mjs"
	]);
export const vo1220ReleaseGateStorageRepairNormalizationPaths
	= Object.freeze([
		...vo1220ReleaseGateStorageRepairImplementationPaths
		, ...vo1220ReleaseGateStorageRepairIntegrationPaths
	]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	vo1220ReleaseGateStorageRepairHistoryPath, "utf8"));

/**
 * Reverse one authenticated release-gate repair transition.
 *
 * @param source - Complete later source.
 * @param update - Authenticated transition.
 */
export const reverseVo1220ReleaseGateStorageRepairUpdate = (source, update) => {
	assert.ok(vo1220ReleaseGateStorageRepairNormalizationPaths
		.includes(update.path), update.path);
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start, edit.start + edit.current.length)
			, edit.current, update.path);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove only the authenticated release-gate storage repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeVo1220ReleaseGateStorageRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !vo1220ReleaseGateStorageRepairNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseVo1220ReleaseGateStorageRepairUpdate(current, update);
	}
	return current;
};
