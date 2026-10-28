/**
 * Reverse the explicit Core evidence memory repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreEvidenceMemoryRepairHistoryPath
	= "docs/evidence/core-evidence-memory-repair-source-history-20261024.json";
export const coreEvidenceMemoryRepairPredecessor
	= "18788f75277f468b143346188a93c9bce62cd0fd";
export const coreEvidenceMemoryRepairImplementation
	= "310dd69af9b4edd7bdbdc40e215d3991baa14ec3";
export const coreEvidenceMemoryRepairIntegrationBase
	= "310dd69af9b4edd7bdbdc40e215d3991baa14ec3";
export const coreEvidenceMemoryRepairChangedPaths = Object.freeze([
	"config/checked-javascript.json"
	, "tests/cpp-structured-callable-evidence.test.mjs"
	, "tests/helpers/checked-record-value-index-php-ci-report.mjs"
	, "tests/helpers/ruby-gdb-ci-source-history-tests.mjs"
	, "tests/helpers/source-history-digest-tests.mjs"
	, "tests/helpers/source-history-test-source.mjs"
]);
export const coreEvidenceMemoryRepairIntegrationPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/cpp-structured-callable-evidence.test.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const coreEvidenceMemoryRepairNormalizationPaths = Object.freeze([
	...coreEvidenceMemoryRepairChangedPaths
	, ...coreEvidenceMemoryRepairIntegrationPaths
]);
export const coreEvidenceMemoryRepairAddedPaths = Object.freeze([
	"scripts/update-core-evidence-memory-repair-source-history.mjs"
	, "tests/helpers/core-evidence-memory-repair-source-history-tests.mjs"
	, "tests/helpers/core-evidence-memory-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	coreEvidenceMemoryRepairHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseCoreEvidenceMemoryRepairUpdate = (
	source, update
) => {
	assert.ok(coreEvidenceMemoryRepairNormalizationPaths
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
 * Remove only the exact Core evidence memory repair.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeCoreEvidenceMemoryRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreEvidenceMemoryRepairNormalizationPaths.includes(path))
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
		current = reverseCoreEvidenceMemoryRepairUpdate(current, update);
	}
	return current;
};
