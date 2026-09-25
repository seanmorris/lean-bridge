/**
 * Preserve exact predecessor sources across recursive Rust callable admission.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";

export const rustRecursiveCallableHistoryPath = "docs/evidence/rust-recursive-callable-integration-20260925.json";
export const rustRecursiveCallableChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "config/checked-javascript.json", "config/cli-package.v1.json"
	, "docs/architecture/cross-language-authoring.md"
	, "docs/consume/rust.md", "docs/contributing/testing.md"
	, "docs/lean/existing-package.md", "docs/lean/export-decisions.md"
	, "docs/publish/cargo.md"
	, "docs/reference/types.md", "docs/type-surface.v1.json"
	, "nix/perl-engine-source-boundary.json", "package.json"
	, "scripts/generate-type-docs.mjs"
	, "src/adoption/test-profiles.mjs", "src/build/native-graph-projection.mjs"
	, "src/build/native-rust-artifacts.mjs", "src/build/native-rust-projection.mjs"
	, "src/release/native-cargo.mjs"
	, "tests/documentation.test.mjs", "tests/rust-graph-package.test.mjs"
	, "tests/type-surface-docs.test.mjs", "tests/type-surface.test.mjs"
	, "tests/python-recursive-callable-contract.test.mjs"
	, "tests/python-recursive-callable-evidence.test.mjs"
	, "tests/helpers/python-recursive-callable-evidence.mjs"
	, "tests/helpers/python-recursive-callable-source-history.mjs"
].sort();
let history;

/**
 * Authenticate whole file identities and reverse only measured source changes.
 *
 * @param source - Complete current source text.
 * @param update - Exact predecessor/current digests and nonoverlapping edits.
 */
export const reverseRustRecursiveCallableUpdate = (source, update) => {
	assert.ok(rustRecursiveCallableChangedPaths.includes(update.path), update.path);
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
 * Normalize this known transition while leaving every unknown change visible.
 *
 * @param path - Repository-relative path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact predecessor at which normalization stops.
 */
export const beforeRustRecursiveCallables = (path, source, expected) => {
	const digest = sha256(source);
	if(digest === expected || !rustRecursiveCallableChangedPaths.includes(path)) return source;
	const record = history ??= JSON.parse(readFileSync(rustRecursiveCallableHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseRustRecursiveCallableUpdate(source, update) : source;
};
