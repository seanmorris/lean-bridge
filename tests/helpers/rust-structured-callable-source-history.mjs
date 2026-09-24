/**
 * Preserve exact historical sources around the structured Rust callable change.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";

export const rustStructuredCallableHistoryPath = "docs/evidence/rust-structured-callable-integration-20260924.json";
export const rustStructuredCallableChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "docs/consume/rust.md", "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md", "docs/publish/cargo.md"
	, "docs/reference/types.md", "docs/type-surface.v1.json"
	, "scripts/generate-type-docs.mjs", "src/adoption/test-profiles.mjs"
	, "site/workflows.test.mjs"
	, "src/backends/rust/callables.mjs", "src/backends/rust/copied-model.mjs"
	, "src/backends/rust/copied-values.mjs"
	, "src/build/native-c-projection.mjs", "src/build/native-project.mjs"
	, "tests/cpp-structured-callable-evidence.test.mjs"
	, "tests/documentation.test.mjs"
	, "tests/helpers/cpp-structured-callable-evidence.mjs"
	, "tests/helpers/cpp-structured-callable-source-history.mjs"
	, "tests/rust-callable-contract.test.mjs"
	, "tests/rust-collection-evidence.test.mjs"
	, "tests/rust-compound-contract.test.mjs", "tests/rust-list-contract.test.mjs"
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
 * Authenticate complete sources and each ordered, nonoverlapping literal edit.
 *
 * @param source - Complete current source at this milestone.
 * @param update - Explicit predecessor and replacement spans.
 */
export const reverseRustStructuredCallableUpdate = (source, update) => {
	assert.ok(rustStructuredCallableChangedPaths.includes(update.path));
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
 * Undo recorded Rust changes, leaving any unrelated drift visible to old checks.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or predecessor source.
 * @param expected - Optional intermediate digest at which to stop.
 */
export const beforeRustStructuredCallables = (path, source, expected) => {
	if(sha256(source) === expected || !rustStructuredCallableChangedPaths.includes(path)) return source;
	const record = history ??= JSON.parse(readFileSync(rustStructuredCallableHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update ? reverse(source, update) : source;
};
