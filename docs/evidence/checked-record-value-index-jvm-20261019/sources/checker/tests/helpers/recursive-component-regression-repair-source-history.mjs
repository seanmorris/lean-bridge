/**
 * Authenticate the recursive component compatibility repair as one exact,
 * reversible source transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const recursiveComponentRegressionRepairHistoryPath
	= "docs/evidence/recursive-component-regression-repair-source-history-20261017.json";
export const recursiveComponentRegressionRepairPredecessor
	= "ad894681d7d131474dc8092f0dd9095c178df6ef";
export const recursiveComponentRegressionRepairChangedPaths = Object.freeze([
	"docs/type-surface.v1.json"
	, "src/adoption/test-profiles.mjs"
	, "src/analyze/elaborated-metadata.mjs"
	, "src/build/component-recursive-diagnostics.mjs"
	, "tests/elaborated-metadata.test.mjs"
	, "tests/helpers/component-nominal-subtype-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/mutual-checked-record-npm-source-history-tests.mjs"
	, "tests/helpers/nested-checked-record-source-history-tests.mjs"
]);
export const recursiveComponentRegressionRepairAddedPaths = Object.freeze([
	"scripts/update-recursive-component-regression-repair-history.mjs"
	, "tests/helpers/recursive-component-regression-repair-source-history.mjs"
	, "tests/recursive-component-regression-repair-source-history.test.mjs"
]);
let history;

const record = () => history ??= JSON.parse(readFileSync(
	recursiveComponentRegressionRepairHistoryPath, "utf8"
));

/**
 * Reverse one exact compatibility-repair transition.
 *
 * @param source - Complete current source text.
 * @param update - Authenticated transition for the same path.
 */
export const reverseRecursiveComponentRegressionRepairUpdate = (
	source, update
) => {
	assert.ok(recursiveComponentRegressionRepairChangedPaths.includes(
		update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	if(update.replacements !== undefined)
	{
		assert.ok(Array.isArray(update.replacements)
			&& update.replacements.length > 0);
		for(const replacement of [...update.replacements].reverse())
		{
			assert.equal(typeof replacement.previous, "string");
			assert.equal(typeof replacement.current, "string");
			assert.notEqual(replacement.previous, replacement.current);
			assert.ok(Number.isSafeInteger(replacement.count)
				&& replacement.count > 0);
			assert.equal(source.split(replacement.current).length - 1
				, replacement.count, update.path);
			source = source.replaceAll(
				replacement.current, replacement.previous);
		}
		assert.equal(sha256(source), update.previousSha256, update.path);
		return source;
	}
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0;
	const parts = [];
	for(const edit of update.edits)
	{
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
 * Remove only this repair layer from an exact current source.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional digest at which normalization stops.
 */
export const beforeRecursiveComponentRegressionRepairSource = (
	path, source, expected
) => {
	if(typeof source !== "string"
		|| !recursiveComponentRegressionRepairChangedPaths.includes(path))
		return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const update = record().updates.find(item => item.path === path);
	return update?.currentSha256 === digest
		? reverseRecursiveComponentRegressionRepairUpdate(source, update)
		: source;
};
