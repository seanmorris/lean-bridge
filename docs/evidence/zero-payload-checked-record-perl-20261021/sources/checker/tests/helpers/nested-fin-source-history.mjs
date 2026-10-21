/**
 * Restore authenticated predecessors without rewriting installed receipts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeRefinementClosureSource } from "./refinement-closure-source-history.mjs";
export { refinementClosureChangedPaths } from "./refinement-closure-source-history.mjs";

export const nestedFinHistoryPath = "docs/evidence/npm-nested-fin-source-history-20261005.json";
export const nestedFinChangedPaths = [
	"config/checked-javascript.json"
	, "config/cli-package.v1.json"
	, "docs/evidence/finite-specialization-20261005.md"
	, "docs/evidence/npm-fin-refinements-20261005.md"
	, "docs/evidence/npm-subtype-refinements-20261005.md"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "docs/type-surface.v1.json"
	, "nix/component-engine-source-boundary.json"
	, "nix/core-source-boundary.json"
	, "nix/perl-engine-source-boundary.json"
	, "package.json"
	, "schema/compiler-adapter-plan.schema.json"
	, "src/analyze/NativeExports.lean"
	, "src/analyze/elaborated-metadata.mjs"
	, "src/analyze/export-configuration.mjs"
	, "src/analyze/semantic-model.mjs"
	, "src/backends/javascript/generate.mjs"
	, "src/build/compiler-adapters.mjs"
	, "src/build/component-copied-adapters.mjs"
	, "src/build/component-record-adapters.mjs"
	, "src/build/component-recursive-adapters.mjs"
	, "src/build/component-refinements.mjs"
	, "src/build/component-structured-callable-adapters.mjs"
	, "tests/component-array-contract.test.mjs"
	, "tests/elaborated-metadata.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/owned-cpp-callback-result-evidence.mjs"
	, "tests/helpers/owned-dotnet-callback-result-evidence.mjs"
	, "tests/helpers/owned-dotnet-callback-result-package-evidence.mjs"
	, "tests/helpers/owned-jvm-callback-result-combined-evidence.mjs"
	, "tests/helpers/owned-jvm-callback-result-lifetime-evidence.mjs"
	, "tests/helpers/owned-jvm-callback-result-package-evidence.mjs"
	, "tests/helpers/owned-jvm-callback-result-runtime-evidence.mjs"
	, "tests/helpers/owned-perl-callback-result-package-evidence.mjs"
	, "tests/helpers/owned-perl-callback-result-runtime-evidence.mjs"
	, "tests/helpers/owned-perl-callback-result-variant-acceptance.mjs"
	, "tests/helpers/owned-perl-callback-result-variant-evidence.mjs"
	, "tests/helpers/owned-php-callback-result-package-sources.mjs"
	, "tests/helpers/owned-php-callback-result-runtime-sources.mjs"
	, "tests/helpers/owned-python-callback-result-acceptance.mjs"
	, "tests/helpers/owned-python-callback-result-evidence.mjs"
	, "tests/helpers/owned-ruby-callback-result-evidence.mjs"
	, "tests/helpers/owned-ruby-callback-result-package-evidence.mjs"
	, "tests/helpers/owned-rust-callback-result-acceptance.mjs"
	, "tests/helpers/owned-rust-callback-result-evidence.mjs"
	, "tests/helpers/php-wasm-callback-result-acceptance-history-tests.mjs"
	, "tests/helpers/subtype-component-source-history.mjs"
	, "tests/unlocked-component.test.mjs"
];
let history;

/**
 * Reconstruct a predecessor only from its complete, authenticated successor.
 *
 * @param source - Complete current source text.
 * @param update - Exact replacement spans and their enclosing hashes.
 */
export const reverseNestedFinUpdate = (source, update) => {
	assert.ok(nestedFinChangedPaths.includes(update.path));
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	let cursor = 0; const parts = [];
	for(const edit of update.edits)
	{
		assert.ok(Number.isSafeInteger(edit.start) && edit.start >= cursor && edit.start <= source.length);
		assert.equal(typeof edit.previous, "string"); assert.equal(typeof edit.current, "string");
		assert.notEqual(edit.previous, edit.current);
		assert.equal(source.slice(edit.start, edit.start + edit.current.length), edit.current);
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Undo this milestone before traversing older refinement history.
 *
 * @param path - Repository-relative path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact digest at which to stop.
 */
export const beforeNestedFinSource = (path, source, expected) => {
	source = beforeRefinementClosureSource(path, source, expected);
	if(typeof source !== "string" || !nestedFinChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(nestedFinHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseNestedFinUpdate(source, update) : source;
};
