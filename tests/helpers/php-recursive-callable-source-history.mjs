/**
 * Preserve exact predecessor sources across recursive Php callable admission.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforePhpWasmRecursiveCallables } from "./php-wasm-recursive-callable-source-history.mjs";

export const phpRecursiveCallableHistoryPath = "docs/evidence/php-recursive-callable-integration-20260926.json";
export const phpRecursiveCallableChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "config/checked-javascript.json"
	, "config/cli-package.v1.json"
	, "docs/architecture/cross-language-authoring.md"
	, "docs/contributing/testing.md"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "docs/php.md"
	, "docs/publish/php.md"
	, "docs/reference/types.md"
	, "docs/type-surface.v1.json"
	, "nix/perl-engine-source-boundary.json"
	, "package.json"
	, "scripts/generate-type-docs.mjs"
	, "src/adoption/test-profiles.mjs"
	, "src/backends/php/package-audit.mjs"
	, "src/build/native-c-projection.mjs"
	, "src/build/native-graph-projection.mjs"
	, "src/build/native-php-artifacts.mjs"
	, "src/release/native-composer.mjs"
	, "tests/documentation.test.mjs"
	, "tests/dotnet-recursive-callable-contract.test.mjs"
	, "tests/helpers/jvm-recursive-callable-evidence.mjs"
	, "tests/helpers/jvm-recursive-callable-source-history.mjs"
	, "tests/jvm-recursive-callable-contract.test.mjs"
	, "tests/jvm-recursive-callable-evidence.test.mjs"
	, "tests/perl-recursive-callable-contract.test.mjs"
	, "tests/ruby-recursive-callable-contract.test.mjs"
	, "tests/rust-recursive-callable-contract.test.mjs"
	, "tests/type-surface-docs.test.mjs"
	, "tests/type-surface.test.mjs"
].sort();
let history;

/**
 * Authenticate whole file identities and reverse only measured source changes.
 *
 * @param source - Complete current source text.
 * @param update - Exact predecessor/current digests and nonoverlapping edits.
 */
export const reversePhpRecursiveCallableUpdate = (source, update) => {
	assert.ok(phpRecursiveCallableChangedPaths.includes(update.path), update.path);
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
export const beforePhpRecursiveCallables = (path, source, expected) => {
	source = beforePhpWasmRecursiveCallables(path, source, expected);
	const digest = sha256(source);
	if(digest === expected || !phpRecursiveCallableChangedPaths.includes(path)) return source;
	const record = history ??= JSON.parse(readFileSync(phpRecursiveCallableHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reversePhpRecursiveCallableUpdate(source, update) : source;
};
