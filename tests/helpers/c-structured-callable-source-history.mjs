/**
 * Reverse only recorded structured C callable changes for historical receipts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeCppStructuredCallables } from "./cpp-structured-callable-source-history.mjs";

export const cStructuredCallableHistoryPath = "docs/evidence/c-structured-callable-integration-20260924.json";
export const cStructuredCallableChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "docs/consume/c.md", "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md", "docs/publish/c.md"
	, "docs/reference/types.md", "docs/type-surface.v1.json"
	, "scripts/generate-type-docs.mjs"
	, "src/adoption/test-profiles.mjs", "src/analyze/reviewed-source.mjs"
	, "src/backends/c/gmp-projection.mjs", "src/backends/c/native-callables.mjs"
	, "src/backends/c/native-primitives.mjs"
	, "src/backends/c/primitive-surface.mjs"
	, "src/build/native-c-projection.mjs", "src/build/native-model.mjs"
	, "src/build/native-project.mjs", "src/release/native-c-family.mjs"
	, "tests/documentation.test.mjs"
	, "tests/helpers/php-wasm-shared-regression-receipt.mjs"
	, "tests/helpers/wit-acceptance-source-history.mjs"
	, "tests/helpers/wit-recursive-acceptance.mjs"
	, "tests/reviewed-callables.test.mjs", "tests/type-surface.test.mjs"
	, "tests/type-surface-docs.test.mjs", "tests/wit-recursive-acceptance.test.mjs"
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
 * Check complete identities and literal, ordered, nonoverlapping source spans.
 *
 * @param source - Current source at this milestone.
 * @param update - Exact predecessor and replacement spans.
 */
export const reverseCStructuredCallableUpdate = (source, update) => {
	assert.ok(cStructuredCallableChangedPaths.includes(update.path));
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
	const previous = reverse(source, update);
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Retain unrelated drift while reversing this milestone for older evidence.
 *
 * @param path - Recorded repository-relative source path.
 * @param source - Complete source, including any unrelated edits.
 * @param expected - Optional historical digest where normalization stops.
 */
export const beforeCStructuredCallables = (path, source, expected) => {
	source = beforeCppStructuredCallables(path, source, expected);
	if(sha256(source) === expected || !cStructuredCallableChangedPaths.includes(path)) return source;
	const record = history ??= JSON.parse(readFileSync(cStructuredCallableHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update ? reverse(source, update) : source;
};
