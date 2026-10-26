/**
 * Reverse the explicit Entry fixture repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const entryFixtureRepairHistoryPath
	= "docs/evidence/entry-fixture-repair-source-history-20261024.json";
export const entryFixtureRepairPredecessor
	= "f8c8ccf028e8039962a303ea86b22335c55d1514";
export const entryFixtureRepairImplementation
	= "aa25d9b715db519a80282c3a7b9e91e85a8cc430";
export const entryFixtureRepairIntegrationBase
	= "e2190c8a5829e6b4155094e5ecead80cbe30888e";
export const entryFixtureRepairChangedPaths = Object.freeze([
	"tests/helpers/nominal-subtype-entry-browser.mjs"
	, "tests/helpers/nominal-subtype-entry-tests.mjs"
	, "tests/helpers/nominal-subtype-entry.mjs"
	, "tests/helpers/php-wasm-owned-refinement-entry-fixtures-tests.mjs"
	, "tests/helpers/php-wasm-owned-refinement-entry-fixtures.mjs"
]);
export const entryFixtureRepairIntegrationPaths = Object.freeze([
	"tests/helpers/fin-refinement-source-history.mjs"
	, "tests/checked-javascript.test.mjs"
]);
export const entryFixtureRepairNormalizationPaths = Object.freeze([
	...entryFixtureRepairChangedPaths
	, ...entryFixtureRepairIntegrationPaths
]);
export const entryFixtureRepairAddedPaths = Object.freeze([
	"scripts/update-entry-fixture-repair-source-history.mjs"
	, "tests/helpers/entry-fixture-repair-source-history-tests.mjs"
	, "tests/helpers/entry-fixture-repair-source-history.mjs"
]);

let history;
const record = () => history ??= JSON.parse(readFileSync(
	entryFixtureRepairHistoryPath, "utf8"
));

/**
 * Restore one exact transition after authenticating both endpoints.
 *
 * @param source - Complete current source.
 * @param update - Exact recorded transition.
 */
export const reverseEntryFixtureRepairUpdate = (
	source, update
) => {
	assert.ok(entryFixtureRepairNormalizationPaths
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
 * Remove only the exact Entry fixture repair.
 * Without a requested stop, unwind all authenticated stages of this repair.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeEntryFixtureRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !entryFixtureRepairNormalizationPaths.includes(path))
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
		current = reverseEntryFixtureRepairUpdate(current, update);
	}
	return current;
};
