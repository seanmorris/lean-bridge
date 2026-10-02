/**
 * Authenticate Python callback-owner changes without rewriting earlier evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";

export const ownedPythonCallbackHistoryPath = "docs/evidence/owned-python-callback-result-source-history-20261002.json";
export const ownedPythonCallbackHistorySha256 = "31082b5c541fe8536eef8d416fff51b46ed2bb4befa1d2c397ce048578754c10";
export const ownedPythonCallbackBaseline = "a3100134f1853102fc2cbf0c2f12839ac480af12";
let history;
/** Authenticate the complete ledger and its immutable predecessor. */
export const readOwnedPythonCallbackHistory = () => {
	if(!history)
	{
		const bytes = readFileSync(ownedPythonCallbackHistoryPath);
		assert.equal(sha256(bytes), ownedPythonCallbackHistorySha256);
		history = JSON.parse(bytes);
		assert.equal(history.schemaVersion, 1);
		assert.equal(history.kind, "owned-python-callback-result-source-history");
		assert.equal(history.baselineRevision, ownedPythonCallbackBaseline);
		assert.deepEqual(history.previous, {
			path: "docs/evidence/owned-rust-callback-result-source-history-20261002.json"
			, sha256: "793dc2d6c6d0331561586184671305c3407f29ea7779d1b630c246aae06c1078"
		});
		assert.equal(sha256(readFileSync(history.previous.path)), history.previous.sha256);
		const paths = history.updates.map(update => update.path);
		assert.deepEqual(paths, [...new Set(paths)].sort());
	}
	return history;
};
export const ownedPythonCallbackChangedPaths = Object.freeze(readOwnedPythonCallbackHistory().updates.map(update => update.path));

/**
 * Reverse an exact whole-source transition, never an unrecognized partial edit.
 *
 * @param source - Complete current source bytes or text.
 * @param update - Pinned path, complete identities and ordered reverse edits.
 */
export const reverseOwnedPythonCallbackUpdate = (source, update) => {
	assert.ok(ownedPythonCallbackChangedPaths.includes(update.path), update.path);
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
export const beforeOwnedPythonCallbackResults = (path, source, expected) => {
	const update = readOwnedPythonCallbackHistory().updates.find(item => item.path === path);
	const digest = sha256(source);
	return update && digest !== expected && digest === update.currentSha256
		? reverseOwnedPythonCallbackUpdate(source, update) : source;
};
