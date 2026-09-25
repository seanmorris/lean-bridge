/**
 * Preserve exact receipt sources across the PHP CI verifier repairs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";

export const phpCiHistoryPath = "docs/evidence/php-ci-regression-integration-20260925.json";
export const phpCiChangedPaths = [
	"docs/reference/types.md", "docs/type-surface.v1.json"
	, "src/adoption/test-profiles.mjs"
	, "tests/fixtures/structured-callable-consumers/php-faults.php"
	, "tests/helpers/closure-thread-evidence.mjs"
	, "tests/helpers/closure-thread-source-history.mjs"
	, "tests/closure-thread-evidence.test.mjs"
	, "tests/helpers/php-structured-callable-evidence.mjs"
	, "tests/helpers/php-wasm-legacy-comparison.mjs"
	, "tests/helpers/php-wasm-shared-regression-receipt.mjs"
].sort();
let history;

/**
 * Reverse exact source spans and authenticate both complete file identities.
 *
 * @param source - Complete current UTF-8 source.
 * @param update - Recorded original and current hashes and nonoverlapping edits.
 */
export const reversePhpCiUpdate = (source, update) => {
	assert.ok(phpCiChangedPaths.includes(update.path), update.path);
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
 * Normalize only this known transition, leaving every unrelated edit visible.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical contents.
 * @param expected - Optional exact predecessor at which normalization stops.
 */
export const beforePhpCiRegression = (path, source, expected) => {
	const digest = sha256(source);
	if(digest === expected || !phpCiChangedPaths.includes(path)) return source;
	const record = history ??= JSON.parse(readFileSync(phpCiHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reversePhpCiUpdate(source, update) : source;
};
