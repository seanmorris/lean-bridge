/**
 * Preserve the exact heap-refinement baseline while extending component ABIs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeNestedFinSource } from "./nested-fin-source-history.mjs";

export const subtypeComponentHistoryPath = "docs/evidence/npm-subtype-component-source-history-20261005.json";
export const subtypeComponentChangedPaths = [
	"config/checked-javascript.json"
	, "config/cli-package.v1.json"
	, "docs/evidence/finite-specialization-20261005.md"
	, "docs/evidence/npm-fin-refinements-20261005.md"
	, "docs/evidence/npm-subtype-refinements-20261005.md"
	, "docs/lean/diagnostics.md"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "docs/type-surface.v1.json"
	, "nix/component-engine-source-boundary.json"
	, "nix/perl-engine-source-boundary.json"
	, "package.json"
	, "poc/lean-link-spike/bindings/generated-package-gate.json"
	, "src/build/compiler-adapters.mjs"
	, "src/build/component-callable-adapters.mjs"
	, "src/build/component-copied-adapters.mjs"
	, "src/build/component-record-adapters.mjs"
	, "src/build/component-recursive-adapters.mjs"
	, "src/build/component-recursive-lean.mjs"
	, "src/build/component-refinements.mjs"
	, "src/build/component-structured-callable-adapters.mjs"
	, "src/build/component-structured-callable-lean.mjs"
	, "src/build/lean-component-compiler.mjs"
	, "tests/component-array-contract.test.mjs"
	, "tests/component-callable-contract.test.mjs"
	, "tests/component-record-contract.test.mjs"
	, "tests/component-structured-callable-contract.test.mjs"
	, "tests/export-configuration.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/php-wasm-callback-result-acceptance-history.mjs"
	, "tests/helpers/subtype-heap-source-history.mjs"
	, "tests/unlocked-component.test.mjs"
];
let history;

/**
 * Restore a recorded predecessor only from its complete authenticated successor.
 *
 * @param source - Complete component-composition milestone source.
 * @param update - Exact ordered replacement spans and both hashes.
 */
export const reverseSubtypeComponentUpdate = (source, update) => {
	assert.ok(subtypeComponentChangedPaths.includes(update.path));
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
 * Remove this isolated change before following the earlier refinement lineage.
 *
 * @param path - Repository-relative source path.
 * @param source - Current or historical complete source.
 * @param expected - Optional digest at which to stop reconstruction.
 */
export const beforeSubtypeComponentSource = (path, source, expected) => {
	source = beforeNestedFinSource(path, source, expected);
	if(typeof source !== "string" || !subtypeComponentChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(subtypeComponentHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseSubtypeComponentUpdate(source, update) : source;
};
