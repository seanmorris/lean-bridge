/**
 * Reverse the managed result-only consumer fixture repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const managedResultOnlyFixtureRepairHistoryPath
	= "docs/evidence/managed-result-only-fixture-repair-source-history-20261024.json";
export const managedResultOnlyFixtureRepairPredecessor
	= "1013044a183122c8276940020df1b3484b1dc6f8";
export const managedResultOnlyFixtureRepairImplementation
	= "cfd00775833587ed165385b2257f861be1911f41";
export const managedResultOnlyFixtureRepairChangedPaths = Object.freeze([
	"tests/fixtures/structured-types/owned-checked-record-result-only-java.java"
	, "tests/fixtures/structured-types/owned-checked-record-result-only-kotlin.kt"
	, "tests/fixtures/structured-types/owned-checked-record-result-only-php.php"
	, "tests/owned-checked-record-managed-packaging.test.mjs"
]);
export const managedResultOnlyFixtureRepairIntegrationPaths = Object.freeze([
	"tests/component-array-contract.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const managedResultOnlyFixtureRepairNormalizationPaths = Object.freeze([
	...managedResultOnlyFixtureRepairChangedPaths
	, ...managedResultOnlyFixtureRepairIntegrationPaths
]);
export const managedResultOnlyFixtureRepairAddedPaths = Object.freeze([
	"scripts/update-managed-result-only-fixture-repair-source-history.mjs"
	, "tests/helpers/managed-result-only-fixture-repair-source-history-tests.mjs"
	, "tests/helpers/managed-result-only-fixture-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	managedResultOnlyFixtureRepairHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param {string} source - Complete current source text.
 * @param {object} update - Exact recorded transition.
 */
export const reverseManagedResultOnlyFixtureRepairUpdate = (source, update) => {
	assert.ok(managedResultOnlyFixtureRepairNormalizationPaths
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
 * Remove only the exact managed result-only consumer fixture repair.
 *
 * @param {string} path - Repository-relative source path.
 * @param {string} source - Complete current or historical source.
 * @param {string} [expected] - Optional digest at which normalization stops.
 */
export const beforeManagedResultOnlyFixtureRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !managedResultOnlyFixtureRepairNormalizationPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const value = record();
	const update = [...value.integrationUpdates, ...value.updates]
		.find(item => item.path === path && item.currentSha256 === digest);
	return update === undefined ? source
		: reverseManagedResultOnlyFixtureRepairUpdate(source, update);
};
