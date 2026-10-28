/**
 * Preserve the exact reviewed Fin Box entry-harness accounting repair and its
 * central history registration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const coreReviewedFinBoxHarnessRepairHistoryPath
	= "docs/evidence/core-reviewed-fin-box-harness-repair-source-history-20261028.json";
export const coreReviewedFinBoxHarnessRepairPredecessor
	= "fd494e477bb212309c895f2f656b0ade3874d559";
export const coreReviewedFinBoxHarnessRepairImplementation
	= "34d7c60c46c2ec6be8d745f2b832ad450780f325";
export const coreReviewedFinBoxHarnessRepairCommits = Object.freeze([
	coreReviewedFinBoxHarnessRepairImplementation
]);
export const coreReviewedFinBoxHarnessRepairImplementationPaths = Object.freeze([
	"tests/reviewed-fin-wasm-entry-harness.test.mjs"
]);
export const coreReviewedFinBoxHarnessRepairIntegrationPaths = Object.freeze([
	"tests/checked-javascript-partition-10.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const coreReviewedFinBoxHarnessRepairNormalizationPaths = Object.freeze([
	...coreReviewedFinBoxHarnessRepairImplementationPaths
	, ...coreReviewedFinBoxHarnessRepairIntegrationPaths
]);
export const coreReviewedFinBoxHarnessRepairAddedPaths = Object.freeze([
	"scripts/update-core-reviewed-fin-box-harness-repair-source-history.mjs"
	, "tests/helpers/core-reviewed-fin-box-harness-repair-source-history-tests.mjs"
	, "tests/helpers/core-reviewed-fin-box-harness-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	coreReviewedFinBoxHarnessRepairHistoryPath, "utf8"
));

/**
 * Reverse one exact authenticated source transition.
 *
 * @param source - Complete current source.
 * @param update - Recorded transition.
 */
export const reverseCoreReviewedFinBoxHarnessRepairUpdate = (source, update) => {
	assert.ok(coreReviewedFinBoxHarnessRepairNormalizationPaths.includes(
		update.path));
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

/**
 * Remove only the recognized Box harness repair and its registration.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact stopping digest.
 */
export const beforeCoreReviewedFinBoxHarnessRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !coreReviewedFinBoxHarnessRepairNormalizationPaths.includes(path))
		return source;
	const value = record();
	const updates = [...value.integrationUpdates, ...value.updates];
	let current = source;
	for(let count = 0; count < updates.length; ++count)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item =>
			item.path === path && item.currentSha256 === digest);
		if(update === undefined) return current;
		current = reverseCoreReviewedFinBoxHarnessRepairUpdate(current, update);
	}
	return current;
};
