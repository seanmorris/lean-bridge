/**
 * Authenticate structural Subtype runtime evidence registration without rewriting earlier source receipts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const structuralSubtypeRuntimeHistoryPath = "docs/evidence/structural-subtype-runtime-source-history-20261011.json";
export const structuralSubtypeRuntimePredecessor = "64fa303eca2cc963ecc4b000e32599bfe73a3fd4";
export const structuralSubtypeRuntimeChangedPaths = [
	"docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "docs/type-surface.v1.json"
	, "src/abi/refinements.mjs"
	, "src/analyze/NativeExports.lean"
	, "src/analyze/checked-refinement-selection.mjs"
	, "src/analyze/elaborated-metadata.mjs"
	, "src/analyze/export-configuration.mjs"
	, "src/analyze/native-types.mjs"
	, "src/analyze/reviewed-subtypes.mjs"
	, "src/backends/c/fin-diagnostic.mjs"
	, "src/backends/c/native-copied-values.mjs"
	, "src/backends/javascript/generate.mjs"
	, "src/backends/native/fin-refinements.mjs"
	, "src/backends/perl/generate.mjs"
	, "src/build/component-refinements.mjs"
	, "src/build/native-model.mjs"
	, "tests/compiler-adapters.test.mjs"
	, "tests/helpers/checked-record-host-ci-workflow-tests.mjs"
	, "tests/helpers/checked-record-native-host-tests.mjs"
	, "tests/helpers/checked-refinement-selection-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/php-wasm-refinement-readme-tests.mjs"
	, "tests/helpers/reviewed-fin-tests.mjs"
	, "tests/helpers/reviewed-subtype-decisions-tests.mjs"
	, "tests/helpers/structural-subtype-selection-history.mjs"
	, "tests/native-fin-callbacks.test.mjs"
	, "tests/native-refinement-boundaries.test.mjs"
	, "tests/native-subtype.test.mjs"
];
let history;

/**
 * Restore only a complete recorded transition with matching before/after digests.
 *
 * @param source - Current complete file text.
 * @param update - Exact immutable transition.
 */
export const reverseStructuralSubtypeRuntimeUpdate = (source, update) => {
	assert.ok(structuralSubtypeRuntimeChangedPaths.includes(update.path));
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
 * Preserve unknown edits and exact requested stopping points.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete source text.
 * @param expected - Optional stopping digest.
 */
export const beforeStructuralSubtypeRuntimeSource = (path, source, expected) => {
	if(typeof source !== "string" || !structuralSubtypeRuntimeChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(structuralSubtypeRuntimeHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseStructuralSubtypeRuntimeUpdate(source, update) : source;
};
