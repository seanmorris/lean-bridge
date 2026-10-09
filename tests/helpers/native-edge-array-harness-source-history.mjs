/**
 * Preserve exact predecessors when registering the native Fin edge and generic-record Array harnesses.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeWasmEntryArchiveSource } from "./wasm-entry-archive-source-history.mjs";

export const nativeEdgeArrayHarnessHistoryPath = "docs/evidence/native-edge-array-harness-source-history-20261009.json";
export const nativeEdgeArrayHarnessPredecessor = "1406d54c0aac77f7cafa0cf73d7a2492ddc1628f";
export const nativeEdgeArrayHarnessChangedPaths = [
	"docs/type-surface.v1.json"
	, "src/adoption/test-profiles.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/helpers/wasm-entry-harness-source-history.mjs"
	, "tests/wasm-entry-harness-history.test.mjs"
];
let history;

/**
 * Reverse registered spans only when both complete source hashes match.
 *
 * @param source - Complete current source text.
 * @param update - Exact recorded transition.
 */
export const reverseNativeEdgeArrayHarnessUpdate = (source, update) => {
	assert.ok(nativeEdgeArrayHarnessChangedPaths.includes(update.path));
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
 * Restore the source before the Native edge/Array harness integration, stopping at an explicitly requested identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source text.
 * @param expected - Optional exact stopping digest.
 */
export const beforeNativeEdgeArrayHarnessSource = (path, source, expected) => {
	source = beforeWasmEntryArchiveSource(path, source, expected);
	if(typeof source !== "string" || !nativeEdgeArrayHarnessChangedPaths.includes(path)) return source;
	const digest = sha256(source);
	if(digest === expected) return source;
	const record = history ??= JSON.parse(readFileSync(nativeEdgeArrayHarnessHistoryPath, "utf8"));
	const update = record.updates.find(item => item.path === path);
	return update?.currentSha256 === digest ? reverseNativeEdgeArrayHarnessUpdate(source, update) : source;
};
