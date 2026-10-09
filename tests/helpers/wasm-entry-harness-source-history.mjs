/**
 * Preserve exact predecessors when registering the reviewed Wasm entry harness.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";

export const wasmEntryHarnessHistoryPath = "docs/evidence/wasm-entry-harness-source-history-20261009.json";
export const wasmEntryHarnessPredecessor = "f2dbb3b8e2fe478283357ed16fb2f8979117c99f";
export const wasmEntryHarnessChangedPaths = [
	"docs/type-surface.v1.json"
	, ".gitattributes"
	, "src/adoption/test-profiles.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/wasm-entry-controls-source-history.mjs"
	, "tests/wasm-entry-controls-history.test.mjs"
	, "tests/helpers/reviewed-fin-wasm-entry.mjs"
	, "tests/reviewed-fin-wasm-entry-controls.test.mjs"
	, "tests/helpers/type-corpus-browser.mjs"
];
let history;

/**
 * Reverse registered spans only when both complete source hashes match.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseWasmEntryHarnessUpdate = (source, update) => {
	assert.ok(wasmEntryHarnessChangedPaths.includes(update.path));
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
 * Restore the source before the Wasm entry harness integration, stopping at an explicitly requested identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeWasmEntryHarnessSource = (path, source, expected) => {
	if(typeof source !== "string" || !wasmEntryHarnessChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(wasmEntryHarnessHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseWasmEntryHarnessUpdate(source, update) : source;
};
