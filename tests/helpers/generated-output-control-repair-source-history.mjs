/**
 * Preserve the generated-output control repair and its newest-first history
 * registration without treating the large type-surface inventory as an
 * ordinary in-memory source transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const generatedOutputControlRepairHistoryPath
	= "docs/evidence/generated-output-control-repair-source-history-20261029.json";
export const generatedOutputControlRepairPredecessor
	= "dab1fc037b5cff14c61178c1b7bc0d1c8f89ad56";
export const generatedOutputControlRepairImplementation
	= "f8d95c2dec3509752a92f512b7556473d73c5f08";
export const generatedOutputControlRepairPinDefinition
	= "b9c7b30a610dbf39d46a5346e8d655ea975a1dd9";
export const generatedOutputControlRepairPinRefresh
	= "0b8d29a1936a39cef94ac6174c45860e69c5652e";
export const generatedOutputControlRepairCommits = Object.freeze([
	generatedOutputControlRepairImplementation
	, generatedOutputControlRepairPinDefinition
	, generatedOutputControlRepairPinRefresh
]);
export const generatedOutputControlRepairChangedPaths = Object.freeze([
	"src/backends/perl/generate.mjs"
	, "tests/closure-thread-contract.test.mjs"
	, "tests/helpers/callable-error-code-history.mjs"
	, "tests/helpers/jvm-structured-callable-regression.mjs"
	, "tests/helpers/owned-dotnet-process-evidence.mjs"
	, "tests/helpers/owned-dotnet-process-history.mjs"
]);
export const generatedOutputControlRepairExternalHistoryPaths = Object.freeze([
	"docs/type-surface.v1.json"
]);
export const generatedOutputControlRepairImplementationAddedPaths = Object.freeze([
	"scripts/refresh-generated-output-control-repair-pins.mjs"
	, "tests/helpers/copied-native-local-namespace-history.mjs"
	, "tests/helpers/managed-host-null-readme-history.mjs"
]);
export const generatedOutputControlRepairIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const generatedOutputControlRepairHistoryAddedPaths = Object.freeze([
	"scripts/update-generated-output-control-repair-source-history.mjs"
	, "tests/helpers/generated-output-control-repair-source-history-tests.mjs"
	, "tests/helpers/generated-output-control-repair-source-history.mjs"
]);
export const generatedOutputControlRepairAddedPaths = Object.freeze([
	...generatedOutputControlRepairImplementationAddedPaths
	, ...generatedOutputControlRepairHistoryAddedPaths
]);
export const generatedOutputControlRepairNormalizationPaths = Object.freeze([
	...generatedOutputControlRepairChangedPaths
	, ...generatedOutputControlRepairIntegrationPaths
]);
export const generatedOutputControlRepairPinCounts = Object.freeze({
	"src/backends/perl/generate.mjs": 15
	, "tests/helpers/jvm-structured-callable-regression.mjs": 2
});
export const generatedOutputControlRepairPinCount = Object.values(
	generatedOutputControlRepairPinCounts).reduce((sum, count) => sum + count, 0);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	generatedOutputControlRepairHistoryPath, "utf8"
));
const normalizationPaths = new Set(generatedOutputControlRepairNormalizationPaths);

/**
 * Reverse one exact generated-output repair transition.
 *
 * @param source - Complete current source.
 * @param update - Authenticated transition record.
 */
export const reverseGeneratedOutputControlRepairUpdate = (source, update) => {
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
		current = reverseGeneratedOutputControlRepairUpdate(current, update);
	}
};

/**
 * Restore only this layer's newest-first registration edits.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeGeneratedOutputControlRepairIntegrationSource
	= (path, source, expected) => reverseSet(
		path, source, expected, record().integrationUpdates);

/**
 * Restore the three generated-output repair milestones.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeGeneratedOutputControlRepairSource
	= (path, source, expected) => reverseSet(path, source, expected, record().updates);
