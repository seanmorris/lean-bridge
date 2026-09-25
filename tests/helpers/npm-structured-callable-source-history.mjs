/**
 * Exact source transitions preceding npm structured callbacks. Historical
 * package and execution receipts stay immutable.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";

export const npmStructuredCallableHistoryPath = "docs/evidence/npm-structured-callable-integration-20260925.json";
export const npmStructuredCallableChangedPaths = [
	".github/workflows/consumer-matrix.yml"
	, ".github/workflows/performance.yml"
	, "config/checked-javascript.json"
	, "config/cli-package.v1.json"
	, "docs/architecture/cross-language-authoring.md"
	, "docs/architecture/elaborated-export-metadata.md"
	, "docs/javascript-typescript.md"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "docs/publish/npm.md"
	, "docs/reference/types.md"
	, "docs/type-surface.v1.json"
	, "nix/component-engine-source-boundary.json"
	, "package.json"
	, "schema/compiler-adapter-plan.schema.json"
	, "schema/elaborated-export-metadata.schema.json"
	, "scripts/generate-type-docs.mjs"
	, "src/adoption/test-profiles.mjs"
	, "src/analyze/NativeExports.lean"
	, "src/analyze/elaborated-metadata.mjs"
	, "src/build/compiler-adapters.mjs"
	, "src/build/component-callable-adapters.mjs"
	, "src/build/component-recursive-adapters.mjs"
	, "src/build/lean-component-compiler.mjs"
	, "src/release/component-callable-runtime.mjs"
	, "src/release/component-npm-package.mjs"
	, "src/release/component-runtime.mjs"
	, "tests/component-callable-contract.test.mjs"
	, "tests/component-callable-runtime.test.mjs"
	, "tests/component-compound-contract.test.mjs"
	, "tests/component-list-contract.test.mjs"
	, "tests/component-variant-contract.test.mjs"
	, "tests/documentation.test.mjs"
	, "tests/helpers/component-scalar-install.mjs"
	, "tests/helpers/perl-structured-callable-evidence.mjs"
	, "tests/helpers/perl-structured-callable-source-history.mjs"
	, "tests/perl-structured-callable-evidence.test.mjs"
	, "tests/type-surface-docs.test.mjs"
	, "tests/type-surface.test.mjs"
];
let history;

/**
 * Reverse a fully authenticated sequence of ordered literal source edits.
 *
 * @param source - Complete source at the npm milestone.
 * @param update - Recorded predecessor and replacement spans.
 */
export const reverseNpmStructuredCallableUpdate = (source, update) => {
	assert.ok(npmStructuredCallableChangedPaths.includes(update.path));
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
 * Restore only exact npm milestone bytes, leaving unrelated drift detectable.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional intermediate digest at which to stop.
 */
export const beforeNpmStructuredCallables = (path, source, expected) => {
	const digest = sha256(source);
	if(digest === expected || !npmStructuredCallableChangedPaths.includes(path)) return source;
	const record = history ??= JSON.parse(readFileSync(npmStructuredCallableHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseNpmStructuredCallableUpdate(source, update) : source;
};
