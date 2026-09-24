/**
 * Preserve committed WIT receipts across the measured composition changes.
 * Reverse exact source spans, retaining unrelated edits for hash validation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";

export const witCompositionHistoryPath = "docs/evidence/wit-recursive-composition-integration-20260924.json";
export const witCompositionChangedPaths = [
	".github/workflows/consumer-matrix.yml", "docs/consume/wit-wasi.md"
	, "docs/type-surface.v1.json", "src/adoption/test-profiles.mjs"
	, "src/backends/wit/copied-host.mjs", "src/backends/wit/host-evidence.mjs"
	, "tests/documentation.test.mjs", "tests/helpers/wit-host-evidence.mjs"
	, "tests/helpers/wit-host-source-history.mjs"
	, "tests/wit-host-evidence.test.mjs"
	, "tests/wit-host-isolation-evidence.test.mjs"
].sort();
let history;

const reverse = (source, update) => {
	let result = source;
	for(const edit of update.edits.toReversed())
	{
		if(result.slice(edit.start, edit.start + edit.current.length) !== edit.current) return source;
		result = result.slice(0, edit.start) + edit.previous + result.slice(edit.start + edit.current.length);
	}
	return result;
};

/**
 * Check the complete current and predecessor bytes around each declared edit.
 *
 * @param source - Full current file.
 * @param update - Exact original/current hashes and nonoverlapping source spans.
 */
export const reverseWitCompositionUpdate = (source, update) => {
	assert.ok(witCompositionChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let end = 0;
	for(const edit of update.edits)
	{
		assert.ok(Number.isSafeInteger(edit.start) && edit.start >= end);
		assert.equal(typeof edit.previous, "string");
		assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start, edit.start + edit.current.length), edit.current);
		end = edit.start + edit.current.length;
	}
	const previous = reverse(source, update);
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Normalize only measured changes before checking older immutable receipts.
 *
 * @param path - Recorded repository-relative source path.
 * @param source - Entire current or historical file contents.
 * @param expected - Optional historical digest at which normalization stops.
 */
export const beforeWitCompositionIntegration = (path, source, expected) => {
	if(sha256(source) === expected || !witCompositionChangedPaths.includes(path)) return source;
	const record = history ??= JSON.parse(readFileSync(witCompositionHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update ? reverse(source, update) : source;
};
