/**
 * Exact source transitions for native PHP copied callbacks; old receipts stay intact.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";

export const phpStructuredCallableHistoryPath = "docs/evidence/php-structured-callable-integration-20260925.json";
export const phpStructuredCallableChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "docs/lean/export-decisions.md"
	, "docs/php.md"
	, "docs/publish/php.md"
	, "docs/reference/types.md"
	, "docs/type-surface.v1.json"
	, "scripts/generate-type-docs.mjs"
	, "src/adoption/test-profiles.mjs"
	, "src/backends/php/copied-model.mjs"
	, "src/backends/php/copied-values.mjs"
	, "src/backends/php/generate.mjs"
	, "src/build/native-c-projection.mjs"
	, "src/build/native-php-artifacts.mjs"
	, "src/build/native-project.mjs"
	, "tests/component-structured-callable-evidence.test.mjs"
	, "tests/documentation.test.mjs"
	, "tests/helpers/current-collection-evidence.mjs"
	, "tests/helpers/native-shared-admission.mjs"
	, "tests/helpers/npm-structured-callable-evidence.mjs"
	, "tests/helpers/npm-structured-callable-source-history.mjs"
	, "tests/php-callable-contract.test.mjs"
	, "tests/php-collection-evidence.test.mjs"
	, "tests/php-list-contract.test.mjs"
	, "tests/php-variant-contract.test.mjs"
	, "tests/php-variant-evidence.test.mjs"
	, "tests/type-surface-docs.test.mjs"
	, "tests/type-surface.test.mjs"
	, "tests/word-evidence.test.mjs"
];
let history;

/**
 * Undo only the authenticated current byte spans in their original order.
 *
 * @param source - Complete current source.
 * @param update - Recorded before/after hashes and nonoverlapping edits.
 */
export const reversePhpStructuredCallableUpdate = (source, update) => {
	assert.ok(phpStructuredCallableChangedPaths.includes(update.path));
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
 * Leave unrelated drift detectable while restoring exactly the preceding milestone.
 *
 * @param path - Repository-relative source path.
 * @param source - Current or historical text.
 * @param expected - Optional intermediate hash at which to stop.
 */
export const beforePhpStructuredCallables = (path, source, expected) => {
	const digest = sha256(source);
	if(digest === expected || !phpStructuredCallableChangedPaths.includes(path)) return source;
	const record = history ??= JSON.parse(readFileSync(phpStructuredCallableHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reversePhpStructuredCallableUpdate(source, update) : source;
};
