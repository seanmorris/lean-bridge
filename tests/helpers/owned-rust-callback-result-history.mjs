/**
 * Authenticate Rust callback-owner changes without rewriting earlier evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "./source-history-digest.mjs";
import { beforeOwnedPythonCallbackResults } from "./owned-python-callback-result-history.mjs";

export const ownedRustCallbackHistoryPath = "docs/evidence/owned-rust-callback-result-source-history-20261002.json";
export const ownedRustCallbackHistorySha256 = "793dc2d6c6d0331561586184671305c3407f29ea7779d1b630c246aae06c1078";
export const ownedRustCallbackBaseline = "93589825d4b4c028724390e4c8d886213cbc92d8";
let history;
/** Authenticate the complete ledger and its immutable predecessor. */
export const readOwnedRustCallbackHistory = () => {
	if(!history)
	{
		const bytes = readFileSync(ownedRustCallbackHistoryPath);
		assert.equal(sha256(bytes), ownedRustCallbackHistorySha256);
		history = JSON.parse(bytes);
		assert.equal(history.schemaVersion, 1);
		assert.equal(history.kind, "owned-rust-callback-result-source-history");
		assert.equal(history.baselineRevision, ownedRustCallbackBaseline);
		assert.deepEqual(history.previous, {
			path: "docs/evidence/owned-cpp-callback-result-source-history-20261002.json"
			, sha256: "27523ee8d12ad0159405769b1478f7934f39c927a839e91711960737f48933ff"
		});
		assert.equal(sha256(readFileSync(history.previous.path)), history.previous.sha256);
		const paths = history.updates.map(update => update.path);
		assert.deepEqual(paths, [...new Set(paths)].sort());
	}
	return history;
};
export const ownedRustCallbackChangedPaths = Object.freeze(readOwnedRustCallbackHistory().updates.map(update => update.path));

/**
 * Reverse an exact whole-source transition, never an unrecognized partial edit.
 *
 * @param source - Complete current source bytes or text.
 * @param update - Pinned path, complete identities and ordered reverse edits.
 */
export const reverseOwnedRustCallbackUpdate = (source, update) => {
	assert.ok(ownedRustCallbackChangedPaths.includes(update.path), update.path);
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	if(update.strategy === "replacements")
	{
		let previous = source.toString();
		for(const edit of [...update.edits].reverse())
		{
			assert.equal(typeof edit.current, "string"); assert.ok(edit.current.length > 0);
			assert.equal(typeof edit.previous, "string"); assert.notEqual(edit.current, edit.previous);
			assert.ok(Number.isSafeInteger(edit.count) && edit.count > 0);
			assert.equal(previous.split(edit.current).length, edit.count + 1, update.path);
			previous = previous.replaceAll(edit.current, edit.previous);
		}
		assert.equal(sha256(previous), update.previousSha256, update.path); return previous;
	}
	assert.equal(update.strategy, "spans");
	const current = source.toString(), parts = []; let end = 0;
	for(const edit of update.edits)
	{
		assert.ok(Number.isSafeInteger(edit.start) && edit.start >= end);
		assert.equal(typeof edit.current, "string"); assert.equal(typeof edit.previous, "string");
		assert.notEqual(edit.current, edit.previous);
		assert.equal(current.slice(edit.start, edit.start + edit.current.length), edit.current);
		parts.push(current.slice(end, edit.start), edit.previous); end = edit.start + edit.current.length;
	}
	parts.push(current.slice(end)); const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path); return previous;
};

/**
 * Preserve unknown edits and stop at an explicitly requested intermediate hash.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional stopping identity.
 */
export const beforeOwnedRustCallbackResults = (path, source, expected) => {
	source = beforeOwnedPythonCallbackResults(path, source, expected);
	const update = readOwnedRustCallbackHistory().updates.find(item => item.path === path);
	const digest = sha256(source);
	return update && digest !== expected && digest === update.currentSha256
		? reverseOwnedRustCallbackUpdate(source, update) : source;
};
