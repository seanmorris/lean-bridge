/**
 * Reverse the repair that reconnects exact pre-Fin type-surface history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const preFinTypeSurfaceHistoryRepairHistoryPath
	= "docs/evidence/pre-fin-type-surface-history-repair-source-history-20261023.json";
export const preFinTypeSurfaceHistoryRepairPredecessor
	= "44486151261f342e06f0a57290c5ac261921a621";
export const preFinTypeSurfaceHistoryRepairImplementation
	= "6af7ee0a3d97e8a2d29862f08772cfe829ea8abe";
export const preFinTypeSurfaceHistoryRepairChangedPaths = Object.freeze([
	"tests/helpers/dependent-record-constructor-authority-source-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const preFinTypeSurfaceHistoryRepairIntegrationPaths = Object.freeze([
	"tests/component-array-contract.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
]);
export const preFinTypeSurfaceHistoryRepairNormalizationPaths = Object.freeze([
	...new Set([
		...preFinTypeSurfaceHistoryRepairChangedPaths
		, ...preFinTypeSurfaceHistoryRepairIntegrationPaths
	])
]);
export const preFinTypeSurfaceHistoryRepairAddedPaths = Object.freeze([
	"scripts/update-pre-fin-type-surface-history-repair-source-history.mjs"
	, "tests/helpers/pre-fin-type-surface-history-repair-source-history-tests.mjs"
	, "tests/helpers/pre-fin-type-surface-history-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	preFinTypeSurfaceHistoryRepairHistoryPath, "utf8"
));

/**
 * Restore one exact source transition after authenticating both endpoints.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reversePreFinTypeSurfaceHistoryRepairUpdate = (
	source, update
) => {
	assert.ok(preFinTypeSurfaceHistoryRepairNormalizationPaths
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
 * Remove only the exact pre-Fin type-surface history repair.
 *
 * The history hub is both an implementation source and an integration source,
 * so this reader intentionally follows every contiguous authenticated update.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforePreFinTypeSurfaceHistoryRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !preFinTypeSurfaceHistoryRepairNormalizationPaths.includes(path))
		return source;
	const original = source;
	let current = source;
	const value = record();
	const updates = [...value.integrationUpdates, ...value.updates];
	while(true)
	{
		const digest = sha256(current);
		if(digest === expected) return current;
		const update = updates.find(item => item.path === path
			&& item.currentSha256 === digest);
		if(update === undefined) break;
		current = reversePreFinTypeSurfaceHistoryRepairUpdate(current, update);
	}
	return current === original ? source : current;
};
