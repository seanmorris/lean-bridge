/**
 * Preserve exact predecessors when registering the reviewed Wasm entry controls.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeWasmEntryHarnessSource } from "./wasm-entry-harness-source-history.mjs";

export const wasmEntryControlsHistoryPath = "docs/evidence/wasm-entry-controls-source-history-20261009.json";
export const wasmEntryControlsPredecessor = "01393fce581ae088df05cfc24f299f9a52a0ff97";
export const wasmEntryControlsChangedPaths = [
	"docs/type-surface.v1.json"
	, "src/adoption/test-profiles.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/hosted-container-inventory-source-history.mjs"
	, "tests/hosted-container-inventory.test.mjs"
];
let history;

/**
 * Reverse registered spans only when both complete source hashes match.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseWasmEntryControlsUpdate = (source, update) => {
	assert.ok(wasmEntryControlsChangedPaths.includes(update.path));
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
 * Restore the source before the Wasm entry controls integration, stopping at an explicitly requested identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeWasmEntryControlsSource = (path, source, expected) => {
	source = beforeWasmEntryHarnessSource(path, source, expected);
	if(typeof source !== "string" || !wasmEntryControlsChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(wasmEntryControlsHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseWasmEntryControlsUpdate(source, update) : source;
};
