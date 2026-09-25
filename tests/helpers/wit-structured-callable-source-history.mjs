/**
 * Exact WIT callback transitions retain the original cross-language receipts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";

export const witStructuredCallableHistoryPath = "docs/evidence/wit-structured-callable-integration-20260925.json";
export const witStructuredCallableChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, "config/checked-javascript.json"
	, "config/cli-package.v1.json"
	, "docs/consume/wit-wasi.md"
	, "docs/contributing/testing.md"
	, "docs/lean/export-decisions.md"
	, "docs/publish/wit-wasi.md"
	, "docs/reference/types.md"
	, "docs/type-surface.v1.json"
	, "nix/perl-engine-source-boundary.json"
	, "package.json"
	, "scripts/generate-type-docs.mjs"
	, "src/adoption/test-profiles.mjs"
	, "src/backends/c/native-callables.mjs"
	, "src/backends/wit/callable-host.mjs"
	, "src/backends/wit/copied-aliases.mjs"
	, "src/backends/wit/copied-model.mjs"
	, "src/build/native-c-projection.mjs"
	, "src/build/native-project.mjs"
	, "src/release/native-wasi.mjs"
	, "tests/documentation.test.mjs"
	, "tests/helpers/php-wasm-structured-callable-evidence.mjs"
	, "tests/helpers/php-wasm-structured-callable-source-history.mjs"
	, "tests/helpers/recursive-acceptance-updates.mjs"
	, "tests/php-wasm-structured-callable-evidence.test.mjs"
	, "tests/type-surface-docs.test.mjs"
	, "tests/type-surface.test.mjs"
	, "tests/wit-callable-contract.test.mjs"
	, "tests/wit-callable-evidence.test.mjs"
	, "tests/wit-compound-contract.test.mjs"
	, "tests/wit-compound-evidence.test.mjs"
	, "tests/wit-list-contract.test.mjs"
];
let history;

/**
 * Reverse authenticated nonoverlapping literal source spans, in original order.
 *
 * @param source - Complete source at this milestone.
 * @param update - Original/current hashes and ordered source edits.
 */
export const reverseWitStructuredCallableUpdate = (source, update) => {
	assert.ok(witStructuredCallableChangedPaths.includes(update.path));
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
 * Normalize this measured transition without masking unrelated source changes.
 *
 * @param path - Repository-relative source path.
 * @param source - Current or historical source text.
 * @param expected - Optional intermediate digest at which to stop.
 */
export const beforeWitStructuredCallables = (path, source, expected) => {
	const digest = sha256(source);
	if(digest === expected || !witStructuredCallableChangedPaths.includes(path)) return source;
	const record = history ??= JSON.parse(readFileSync(witStructuredCallableHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseWitStructuredCallableUpdate(source, update) : source;
};
