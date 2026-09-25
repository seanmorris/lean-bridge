/**
 * Preserve complete predecessor sources across the closure lifetime repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";

export const closureThreadHistoryPath = "docs/evidence/closure-thread-lifetime-integration-20260925.json";
export const closureThreadChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "docs/consume/c.md", "docs/contributing/testing.md"
	, "docs/reference/types.md", "docs/type-surface.v1.json"
	, "src/adoption/test-profiles.mjs", "src/backends/c/native-callables.mjs"
	, "tests/documentation.test.mjs"
	, "tests/helpers/native-recursive-callable-evidence.mjs"
	, "tests/helpers/native-recursive-callable-source-history.mjs"
	, "tests/helpers/wit-structured-callable-regression.mjs"
	, "tests/native-recursive-callable-evidence.test.mjs"
].sort();
let history;

/**
 * Reverse exact nonoverlapping edits, authenticating both complete file hashes.
 *
 * @param source - Complete current file bytes as UTF-8.
 * @param update - Recorded predecessor, current digest and exact edit spans.
 */
export const reverseClosureThreadUpdate = (source, update) => {
	assert.ok(closureThreadChangedPaths.includes(update.path), update.path);
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let end = 0;
	for(const edit of update.edits)
	{
		assert.ok(Number.isSafeInteger(edit.start) && edit.start >= end);
		assert.equal(typeof edit.previous, "string"); assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start, edit.start + edit.current.length), edit.current);
		end = edit.start + edit.current.length;
	}
	let previous = source;
	for(const edit of update.edits.toReversed())
		previous = previous.slice(0, edit.start) + edit.previous + previous.slice(edit.start + edit.current.length);
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Normalize this authenticated transition and leave every unknown edit visible.
 *
 * @param path - Repository-relative complete source path.
 * @param source - Current or historical file text.
 * @param expected - Optional exact digest at which normalization stops.
 */
export const beforeClosureThreadLifetime = (path, source, expected) => {
	const digest = sha256(source);
	if(digest === expected || !closureThreadChangedPaths.includes(path)) return source;
	const record = history ??= JSON.parse(readFileSync(closureThreadHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseClosureThreadUpdate(source, update) : source;
};
