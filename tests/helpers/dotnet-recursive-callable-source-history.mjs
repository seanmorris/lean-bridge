/**
 * Preserve exact predecessor sources across recursive Dotnet callable admission.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";

export const dotnetRecursiveCallableHistoryPath = "docs/evidence/dotnet-recursive-callable-integration-20260926.json";
export const dotnetRecursiveCallableChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, ".github/workflows/perl-consumer.yml"
	, "config/checked-javascript.json"
	, "config/cli-package.v1.json"
	, "docs/architecture/cross-language-authoring.md"
	, "docs/consume/dotnet.md"
	, "docs/contributing/testing.md"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "docs/publish/nuget.md"
	, "docs/reference/types.md"
	, "docs/type-surface.v1.json"
	, "nix/perl-engine-source-boundary.json"
	, "package.json"
	, "scripts/generate-type-docs.mjs"
	, "src/adoption/test-profiles.mjs"
	, "src/backends/dotnet/copied-graph-assets.mjs"
	, "src/backends/managed/package-audit.mjs"
	, "src/build/native-dotnet-artifacts.mjs"
	, "src/build/native-dotnet-projection.mjs"
	, "src/build/native-graph-projection.mjs"
	, "src/release/native-nuget.mjs"
	, "tests/documentation.test.mjs"
	, "tests/dotnet-structured-callable-contract.test.mjs"
	, "tests/helpers/perl-recursive-callable-evidence.mjs"
	, "tests/helpers/perl-recursive-callable-source-history.mjs"
	, "tests/perl-recursive-callable-contract.test.mjs"
	, "tests/perl-recursive-callable-evidence.test.mjs"
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
export const reverseDotnetRecursiveCallableUpdate = (source, update) => {
	assert.ok(dotnetRecursiveCallableChangedPaths.includes(update.path), update.path);
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
export const beforeDotnetRecursiveCallables = (path, source, expected) => {
	const digest = sha256(source);
	if(digest === expected || !dotnetRecursiveCallableChangedPaths.includes(path)) return source;
	const record = history ??= JSON.parse(readFileSync(dotnetRecursiveCallableHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseDotnetRecursiveCallableUpdate(source, update) : source;
};
