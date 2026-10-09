/**
 * Preserve exact predecessors when attaching measured npm Fin entry evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const wasmEntrySupplementHistoryPath = "docs/evidence/wasm-entry-supplement-source-history-20261009.json";
export const wasmEntrySupplementPredecessor = "e8d701ead2bffc247924473f98c65b02cf909ef1";
export const wasmEntrySupplementChangedPaths = [
	"docs/type-surface.v1.json"
	, "docs/javascript-typescript.md"
	, "docs/lean/existing-package.md"
	, "src/adoption/test-profiles.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/perl-scalar-promotion-source-history.mjs"
	, "tests/helpers/perl-scalar-promotion.mjs"
	, "tests/perl-scalar-promotion.test.mjs"
];
let history;

/**
 * Reverse registered spans only when both complete source hashes match.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseWasmEntrySupplementUpdate = (source, update) => {
	assert.ok(wasmEntrySupplementChangedPaths.includes(update.path));
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
 * Restore the source before the Wasm entry supplement, stopping at an explicitly requested identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeWasmEntrySupplementSource = (path, source, expected) => {
	if(typeof source !== "string" || !wasmEntrySupplementChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(wasmEntrySupplementHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseWasmEntrySupplementUpdate(source, update) : source;
};
