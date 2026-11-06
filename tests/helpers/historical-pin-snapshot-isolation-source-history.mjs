/**
 * Preserve the repair that isolates historical pin assertions from live bytes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const historicalPinSnapshotIsolationHistoryPath
	= "docs/evidence/historical-pin-snapshot-isolation-source-history-20261106.json";
export const historicalPinSnapshotIsolationPredecessor
	= "aa3297a61bfdb1bcb7a0c56b6efd9eaebf04e0f1";
export const historicalPinSnapshotIsolationImplementation
	= "df5101dcfd553228b79be8a8765f0e830e38fd6e";
export const historicalPinSnapshotIsolationImplementationPaths = Object.freeze([
	"tests/helpers/consumer-suite-contract-repair-source-history-tests.mjs"
	, "tests/helpers/core-historical-evidence-replay-source-history-tests.mjs"
	, "tests/helpers/final-audit-checkout-optimization-source-history-tests.mjs"
	, "tests/helpers/performance-checkout-filter-source-history-tests.mjs"
	, "tests/helpers/reviewed-specialization-sparse-suite-repair-source-history-tests.mjs"
	, "tests/helpers/scalar-fin-suite-registration-source-history-tests.mjs"
]);
export const historicalPinSnapshotIsolationIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const historicalPinSnapshotIsolationHistoryAdditions = Object.freeze([
	"scripts/update-historical-pin-snapshot-isolation-source-history.mjs"
	, "tests/helpers/historical-pin-snapshot-isolation-source-history-tests.mjs"
	, "tests/helpers/historical-pin-snapshot-isolation-source-history.mjs"
]);
export const historicalPinSnapshotIsolationNormalizationPaths = Object.freeze([
	...new Set([
		...historicalPinSnapshotIsolationImplementationPaths
		, ...historicalPinSnapshotIsolationIntegrationPaths
	])
].sort());

let history;
const record = () => history ??= JSON.parse(readFileSync(
	historicalPinSnapshotIsolationHistoryPath, "utf8"));

/**
 * Reverse one exact authenticated transition.
 *
 * @param source - Complete later source.
 * @param update - Authenticated reversible transition.
 */
export const reverseHistoricalPinSnapshotIsolationUpdate = (source, update) => {
	assert.ok(historicalPinSnapshotIsolationNormalizationPaths
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
 * Remove the integration and implementation transitions in order.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping SHA-256.
 */
export const beforeHistoricalPinSnapshotIsolationSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !historicalPinSnapshotIsolationNormalizationPaths.includes(path))
		return source;
	let current = source;
	for(const updates of [record().integrationUpdates, record().updates])
	{
		if(expected !== undefined && sha256(current) === expected) return current;
		const digest = sha256(current);
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update !== undefined)
			current = reverseHistoricalPinSnapshotIsolationUpdate(current, update);
	}
	return current;
};
