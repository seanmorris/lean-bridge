/**
 * Exact source transition for heap-backed primitive Subtype constructors.
 * This layer restores the first checked-Subtype milestone before the older
 * refinement lineage continues.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";

export const subtypeHeapHistoryPath = "docs/evidence/npm-subtype-heap-source-history-20261005.json";
export const subtypeHeapChangedPaths = [
	"docs/evidence/finite-specialization-20261005.md"
	, "docs/evidence/npm-fin-refinements-20261005.md"
	, "docs/evidence/npm-subtype-refinements-20261005.md"
	, "docs/javascript-typescript.md"
	, "docs/lean/diagnostics.md"
	, "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
	, "docs/type-surface.v1.json"
	, "src/analyze/NativeExports.lean"
	, "src/build/component-record-adapters.mjs"
	, "src/build/component-scalar-adapters.mjs"
	, "tests/elaborated-metadata.test.mjs"
	, "tests/helpers/subtype-refinement-source-history.mjs"
	, "tests/type-surface.test.mjs"
	, "tests/unlocked-component.test.mjs"
	, "tests/word-contract.test.mjs"
];
let history;

/**
 * Reverse one fully authenticated ordered source transition.
 *
 * @param source - Complete source at the heap-backed Subtype milestone.
 * @param update - Recorded predecessor and replacement spans.
 */
export const reverseSubtypeHeapUpdate = (source, update) => {
	assert.ok(subtypeHeapChangedPaths.includes(update.path));
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
	let cursor = 0; const parts = [];
	for(const edit of update.edits)
	{
		parts.push(source.slice(cursor, edit.start), edit.previous);
		cursor = edit.start + edit.current.length;
	}
	parts.push(source.slice(cursor));
	const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Restore only exact heap-backed Subtype milestone bytes.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional intermediate digest at which to stop.
 */
export const beforeSubtypeHeapSource = (path, source, expected) => {
	if(typeof source !== "string" || !subtypeHeapChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(subtypeHeapHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseSubtypeHeapUpdate(source, update) : source;
};
