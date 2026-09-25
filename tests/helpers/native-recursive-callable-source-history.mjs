/**
 * Preserve historical receipts across the recursive C-family implementation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";

export const nativeRecursiveCallableHistoryPath = "docs/evidence/native-recursive-callable-integration-20260925.json";
export const nativeRecursiveCallableChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "config/checked-javascript.json", "config/cli-package.v1.json"
	, "docs/consume/c.md", "docs/consume/cpp.md", "docs/contributing/testing.md"
	, "docs/lean/export-decisions.md", "docs/publish/c.md", "docs/publish/cpp.md"
	, "docs/reference/types.md", "docs/type-surface.v1.json"
	, "nix/perl-engine-source-boundary.json", "package.json"
	, "scripts/generate-type-docs.mjs", "src/adoption/test-profiles.mjs"
	, "src/backends/c/graph-package.mjs"
	, "src/backends/c/native-graph-adapters.mjs"
	, "src/build/native-c-projection.mjs", "src/build/native-component.mjs"
	, "src/build/native-graph-model.mjs", "src/build/native-graph-projection.mjs"
	, "src/build/native-graph-sources.mjs", "src/release/native-c-family.mjs"
	, "tests/documentation.test.mjs"
	, "tests/helpers/cpp-structured-callable-install.mjs"
	, "tests/helpers/wit-structured-callable-evidence.mjs"
	, "tests/helpers/wit-structured-callable-source-history.mjs"
	, "tests/native-graph-package.test.mjs", "tests/type-surface-docs.test.mjs"
	, "tests/native-shared-admission.test.mjs"
	, "tests/type-surface.test.mjs"
	, "tests/wit-structured-callable-evidence.test.mjs"
].sort();
let history;

/**
 * Authenticate both complete files and reverse only the recorded source spans.
 *
 * @param source - Complete current source text.
 * @param update - Exact predecessor/current identities and nonoverlapping edits.
 */
export const reverseNativeRecursiveCallableUpdate = (source, update) => {
	assert.ok(nativeRecursiveCallableChangedPaths.includes(update.path), update.path);
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
 * Normalize this exact transition, leaving unknown source edits visible.
 *
 * @param path - Repository-relative source path.
 * @param source - Entire current or historical file.
 * @param expected - Optional predecessor at which normalization stops.
 */
export const beforeNativeRecursiveCallables = (path, source, expected) => {
	const digest = sha256(source);
	if(digest === expected || !nativeRecursiveCallableChangedPaths.includes(path)) return source;
	const record = history ??= JSON.parse(readFileSync(nativeRecursiveCallableHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseNativeRecursiveCallableUpdate(source, update) : source;
};
