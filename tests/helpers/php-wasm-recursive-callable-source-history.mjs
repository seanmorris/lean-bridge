/**
 * Retain exact predecessor sources across recursive PHP-Wasm callable admission.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";

export const phpWasmRecursiveCallableHistoryPath = "docs/evidence/php-wasm-recursive-callable-integration-20260926.json";
export const phpWasmRecursiveCallableChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "config/checked-javascript.json", "config/cli-package.v1.json"
	, "docs/architecture/cross-language-authoring.md"
	, "docs/contributing/testing.md", "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md", "docs/php.md", "docs/publish/php.md"
	, "docs/reference/types.md", "docs/type-surface.v1.json"
	, "nix/perl-engine-source-boundary.json", "package.json"
	, "scripts/generate-type-docs.mjs", "src/adoption/test-profiles.mjs"
	, "site/workflows.test.mjs"
	, "src/backends/php/copied-graph-zend-runtime.mjs"
	, "src/backends/php/copied-graph-zend.mjs"
	, "src/build/php-wasm-copied-component.mjs"
	, "src/build/php-wasm-graph-component.mjs"
	, "src/build/php-wasm-graph-model.mjs"
	, "src/release/php-wasm-copied-package.mjs"
	, "tests/documentation.test.mjs"
	, "tests/helpers/php-ci-regression-evidence.mjs"
	, "tests/helpers/php-recursive-callable-evidence.mjs"
	, "tests/helpers/php-recursive-callable-source-history.mjs"
	, "tests/helpers/php-wasm-graph-packages.mjs"
	, "tests/php-recursive-callable-evidence.test.mjs"
	, "tests/type-surface-docs.test.mjs", "tests/type-surface.test.mjs"
].sort();
let history;

/**
 * Reverse only recorded, nonoverlapping edits with matching whole-file digests.
 *
 * @param source - Complete current source text.
 * @param update - Exact predecessor/current identities and edits.
 */
export const reversePhpWasmRecursiveCallableUpdate = (source, update) => {
	assert.ok(phpWasmRecursiveCallableChangedPaths.includes(update.path), update.path);
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
 * Normalize this authenticated transition and leave unknown changes visible.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact predecessor at which normalization stops.
 */
export const beforePhpWasmRecursiveCallables = (path, source, expected) => {
	const digest = sha256(source);
	if(digest === expected || !phpWasmRecursiveCallableChangedPaths.includes(path)) return source;
	const record = history ??= JSON.parse(readFileSync(phpWasmRecursiveCallableHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reversePhpWasmRecursiveCallableUpdate(source, update) : source;
};
