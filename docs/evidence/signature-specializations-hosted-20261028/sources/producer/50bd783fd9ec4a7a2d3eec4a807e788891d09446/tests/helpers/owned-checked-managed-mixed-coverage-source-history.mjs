/**
 * Authenticate expanded managed host source coverage without inferring installed support.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const ownedCheckedManagedMixedCoverageHistoryPath
	= "docs/evidence/owned-checked-managed-mixed-coverage-source-history-20261025.json";
export const ownedCheckedManagedMixedCoveragePredecessor
	= "19b9dd408f4f21fd111653620642c21a32e27b6d";
export const ownedCheckedManagedMixedCoverageImplementation
	= "16be744dbb02923e0b3905097c6cfb018167e6ff";
export const ownedCheckedManagedMixedCoverageIntegrationBase
	= "16be744dbb02923e0b3905097c6cfb018167e6ff";
export const ownedCheckedManagedMixedCoverageCommits = Object.freeze([
	"16be744dbb02923e0b3905097c6cfb018167e6ff"
]);
export const ownedCheckedManagedMixedCoverageChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/fixtures/structured-types/owned-checked-record-dotnet.cs"
	, "tests/fixtures/structured-types/owned-checked-record-installed.c"
	, "tests/fixtures/structured-types/owned-checked-record-java.java"
	, "tests/fixtures/structured-types/owned-checked-record-kotlin.kt"
	, "tests/fixtures/structured-types/owned-checked-record-php.php"
	, "tests/helpers/owned-checked-record-managed-fixture.mjs"
	, "tests/helpers/owned-checked-record-promotion-tests.mjs"
	, "tests/owned-checked-record-managed-packaging.test.mjs"
	, "tests/owned-checked-record-native-packaging.test.mjs"
]);
export const ownedCheckedManagedMixedCoverageImplementationAddedPaths = Object.freeze([
	"docs/evidence/owned-checked-managed-mixed-coverage-20261025.json"
]);
export const ownedCheckedManagedMixedCoverageImplementationPaths = Object.freeze([
	...ownedCheckedManagedMixedCoverageChangedPaths
	, ...ownedCheckedManagedMixedCoverageImplementationAddedPaths
]);
export const ownedCheckedManagedMixedCoverageIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const ownedCheckedManagedMixedCoverageNormalizationPaths = Object.freeze([
	...ownedCheckedManagedMixedCoverageChangedPaths
	, ...ownedCheckedManagedMixedCoverageIntegrationPaths
]);
export const ownedCheckedManagedMixedCoverageHistoryAddedPaths = Object.freeze([
	"scripts/update-owned-checked-managed-mixed-coverage-source-history.mjs"
	, "tests/helpers/owned-checked-managed-mixed-coverage-source-history-tests.mjs"
	, "tests/helpers/owned-checked-managed-mixed-coverage-source-history.mjs"
]);
export const ownedCheckedManagedMixedCoverageAddedPaths = Object.freeze([
	...ownedCheckedManagedMixedCoverageImplementationAddedPaths
	, ...ownedCheckedManagedMixedCoverageHistoryAddedPaths
]);
export const ownedCheckedManagedMixedCoveragePins = Object.freeze([
	Object.freeze({
		path: "tests/helpers/owned-checked-record-promotion-tests.mjs"
		, count: 11
		, previousSha256: "b159b87f91c8a44aa2629380063fab1b8ac981c3d3a6e318a3fc50d374693c1c"
		, currentSha256: "b257df31252c8007f2dfb5dc041c0deaa870bfc51d7b0c357fd6ed4a60132bf4"
	})
]);
let history;
const record = () => history ??= JSON.parse(readFileSync(
	ownedCheckedManagedMixedCoverageHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseOwnedCheckedManagedMixedCoverageUpdate = (
	source, update
) => {
	assert.ok(ownedCheckedManagedMixedCoverageNormalizationPaths
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
 * Remove only the exact Owned checked managed mixed coverage.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeOwnedCheckedManagedMixedCoverageSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !ownedCheckedManagedMixedCoverageNormalizationPaths.includes(path))
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
		current = reverseOwnedCheckedManagedMixedCoverageUpdate(current, update);
	}
	return current;
};
