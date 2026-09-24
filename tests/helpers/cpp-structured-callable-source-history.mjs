/**
 * Preserve exact historical sources around the structured C++ callable change.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";

export const cppStructuredCallableHistoryPath = "docs/evidence/cpp-structured-callable-integration-20260924.json";
export const cppStructuredCallableChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "docs/consume/cpp.md", "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md", "docs/publish/cpp.md"
	, "docs/reference/types.md", "docs/type-surface.v1.json"
	, "scripts/generate-type-docs.mjs", "src/adoption/test-profiles.mjs"
	, "src/backends/cpp/callables.mjs", "src/backends/cpp/copied-values.mjs"
	, "src/backends/cpp/primitives.mjs", "src/build/native-c-projection.mjs"
	, "src/build/native-project.mjs", "src/release/native-c-family.mjs"
	, "tests/c-structured-callable-contract.test.mjs"
	, "tests/c-structured-callable-evidence.test.mjs"
	, "tests/cpp-callable-contract.test.mjs"
	, "tests/documentation.test.mjs"
	, "tests/helpers/c-structured-callable-evidence.mjs"
	, "tests/helpers/c-structured-callable-source-history.mjs"
	, "tests/type-surface-docs.test.mjs", "tests/type-surface.test.mjs"
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
 * Authenticate complete predecessor/current sources and each literal edit.
 *
 * @param source - Complete source at this milestone.
 * @param update - Explicit, ordered and nonoverlapping source changes.
 */
export const reverseCppStructuredCallableUpdate = (source, update) => {
	assert.ok(cppStructuredCallableChangedPaths.includes(update.path));
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
 * Undo only recorded changes and leave unrelated drift visible to old checkers.
 *
 * @param path - Repository-relative source path.
 * @param source - Entire current or predecessor file.
 * @param expected - Optional intermediate source identity at which to stop.
 */
export const beforeCppStructuredCallables = (path, source, expected) => {
	if(sha256(source) === expected || !cppStructuredCallableChangedPaths.includes(path)) return source;
	const record = history ??= JSON.parse(readFileSync(cppStructuredCallableHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update ? reverse(source, update) : source;
};
