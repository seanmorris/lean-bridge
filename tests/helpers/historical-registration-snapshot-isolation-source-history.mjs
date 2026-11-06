/**
 * Preserve historical registration assertions at their authenticated snapshots.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const historicalRegistrationSnapshotIsolationHistoryPath
	= "docs/evidence/historical-registration-snapshot-isolation-source-history-20261106.json";
export const historicalRegistrationSnapshotIsolationPredecessor
	= "62d458bee80db6aed0544dc565928df11554a078";
export const historicalRegistrationSnapshotIsolationImplementation
	= "19eab2a490e56c706e1301135988d0eac54c2650";
export const historicalRegistrationSnapshotIsolationImplementationPaths
	= Object.freeze([
		"tests/helpers/generic-refusal-fix-source-history-tests.mjs"
		, "tests/helpers/perl-scalar-relocation-source-history-tests.mjs"
	]);
export const historicalRegistrationSnapshotIsolationIntegrationPaths
	= Object.freeze([
		"tests/checked-javascript-partition-11.test.mjs"
		, "tests/helpers/fin-refinement-source-history.mjs"
	]);
export const historicalRegistrationSnapshotIsolationHistoryAdditions
	= Object.freeze([
		"scripts/update-historical-registration-snapshot-isolation-source-history.mjs"
		, "tests/helpers/historical-registration-snapshot-isolation-source-history-tests.mjs"
		, "tests/helpers/historical-registration-snapshot-isolation-source-history.mjs"
	]);
export const historicalRegistrationSnapshotIsolationNormalizationPaths
	= Object.freeze([...new Set([
		...historicalRegistrationSnapshotIsolationImplementationPaths
		, ...historicalRegistrationSnapshotIsolationIntegrationPaths
	])].sort());

let history;
const record = () => history ??= JSON.parse(readFileSync(
	historicalRegistrationSnapshotIsolationHistoryPath, "utf8"));

/**
 * Reverse one exact authenticated transition.
 *
 * @param source - Complete later source.
 * @param update - Authenticated reversible transition.
 */
export const reverseHistoricalRegistrationSnapshotIsolationUpdate = (
	source, update
) => {
	assert.ok(historicalRegistrationSnapshotIsolationNormalizationPaths
		.includes(update.path), update.path);
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
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start
			, edit.start + edit.current.length), edit.current, update.path);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Remove integration and implementation transitions in order.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping SHA-256.
 */
export const beforeHistoricalRegistrationSnapshotIsolationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !historicalRegistrationSnapshotIsolationNormalizationPaths
			.includes(path)) return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseHistoricalRegistrationSnapshotIsolationUpdate(
				current, update);
	}
	return current;
};
