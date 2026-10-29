/**
 * Preserve installed managed HostNull acceptance and the final downstream pin
 * reconciliation shared by PHP, .NET, Java and Kotlin.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const hostNullDownstreamHistoryPath
	= "docs/evidence/host-null-downstream-source-history-20261029.json";
export const hostNullDownstreamPredecessor
	= "9a333bafef6b77c112d4f36c40d45a439dfae84e";
export const hostNullDownstreamManagedAcceptance
	= "78c3ad61336ef7d4d4212e05d6825061b4641e5f";
export const hostNullDownstreamPinDefinition
	= "01bee93f2c2370f2f76e49ec9d2f621e7e24f4c2";
export const hostNullDownstreamPinRefresh
	= "6cdc7a5e956987f9acf0a9c81dcca740d39c5d65";
export const hostNullDownstreamCommits = Object.freeze([
	hostNullDownstreamManagedAcceptance
	, hostNullDownstreamPinDefinition
	, hostNullDownstreamPinRefresh
]);
export const hostNullDownstreamChangedPaths = Object.freeze([
	".github/workflows/consumer-matrix.yml"
	, "tests/dotnet-host-null-contract.test.mjs"
	, "tests/jvm-host-null-contract.test.mjs"
]);
export const hostNullDownstreamExternalHistoryPaths = Object.freeze([
	"docs/type-surface.v1.json"
]);
export const hostNullDownstreamImplementationAddedPaths = Object.freeze([
	"scripts/check-host-null-managed-ci.mjs"
	, "scripts/refresh-host-null-downstream-pins.mjs"
	, "scripts/run-host-null-managed-ci.sh"
	, "tests/fixtures/host-null-consumers/dotnet.cs"
	, "tests/fixtures/host-null-consumers/java.java"
	, "tests/fixtures/host-null-consumers/kotlin.kt"
	, "tests/helpers/host-null-managed-installed.mjs"
]);
export const hostNullDownstreamIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const hostNullDownstreamHistoryAddedPaths = Object.freeze([
	"scripts/update-host-null-downstream-source-history.mjs"
	, "tests/helpers/host-null-downstream-source-history-tests.mjs"
	, "tests/helpers/host-null-downstream-source-history.mjs"
]);
export const hostNullDownstreamAddedPaths = Object.freeze([
	...hostNullDownstreamImplementationAddedPaths
	, ...hostNullDownstreamHistoryAddedPaths
]);
export const hostNullDownstreamNormalizationPaths = Object.freeze([
	...hostNullDownstreamChangedPaths
	, ...hostNullDownstreamIntegrationPaths
]);
export const hostNullDownstreamPinCounts = Object.freeze({
	".github/workflows/consumer-matrix.yml": 92
	, "docs/lean/existing-package.md": 18
	, "docs/lean/export-decisions.md": 22
	, "docs/php.md": 6
	, "src/adoption/type-surface.mjs": 1
	, "src/backends/c/generate.mjs": 37
	, "src/backends/c/native-copied-values.mjs": 113
	, "src/backends/c/primitive-surface.mjs": 60
	, "src/backends/php/copied-conversions.mjs": 18
	, "src/backends/php/copied-model.mjs": 20
	, "src/backends/php/copied-values.mjs": 19
	, "src/backends/php/copied-zend-conversions.mjs": 11
	, "src/backends/php/copied-zend.mjs": 16
	, "src/build/native-model.mjs": 146
});
export const hostNullDownstreamPinCount = Object.values(
	hostNullDownstreamPinCounts).reduce((sum, count) => sum + count, 0);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	hostNullDownstreamHistoryPath, "utf8"
));
const normalizationPaths = new Set(hostNullDownstreamNormalizationPaths);

/**
 * Restore one exact downstream HostNull transition.
 *
 * @param source - Complete current source.
 * @param update - Authenticated transition record.
 */
export const reverseHostNullDownstreamUpdate = (source, update) => {
	assert.ok(normalizationPaths.has(update.path), update.path);
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
		assert.deepEqual(Object.keys(edit).sort(), ["current", "previous", "start"]);
		assert.ok(Number.isSafeInteger(edit.start)
			&& edit.start >= cursor && edit.start <= source.length);
		assert.equal(typeof edit.previous, "string");
		assert.equal(typeof edit.current, "string");
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

const reverseSet = (path, source, expected, updates) => {
	if(typeof source !== "string" || !normalizationPaths.has(path)) return source;
	let current = source;
	while(true)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseHostNullDownstreamUpdate(current, update);
	}
};

/**
 * Restore only this layer's newest-first registration edits.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeHostNullDownstreamIntegrationSource = (path, source, expected) =>
	reverseSet(path, source, expected, record().integrationUpdates);

/**
 * Restore installed managed acceptance and downstream pins.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeHostNullDownstreamSource = (path, source, expected) =>
	reverseSet(path, source, expected, record().updates);
