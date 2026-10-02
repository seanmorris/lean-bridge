/**
 * Authenticate staged JVM source changes without claiming completed acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";

export const ownedJvmCallbackHistoryPath = "docs/evidence/owned-jvm-callback-result-source-history-20261002.json";
export const ownedJvmCallbackHistorySha256 = "5738bc2e884766b3bb05e52cf7ee93659a70a01ef5238898ebb796485086e211";
export const ownedJvmCallbackBaseline = "72d123d69917f1145ec03d8624b6a08c3b2be6bc";
let history;
/** Authenticate the staged ledger and unchanged completed predecessor. */
export const readOwnedJvmCallbackHistory = () => {
	if(!history)
	{
		const bytes = readFileSync(ownedJvmCallbackHistoryPath);
		assert.equal(sha256(bytes), ownedJvmCallbackHistorySha256);
		history = JSON.parse(bytes);
		assert.equal(history.schemaVersion, 1);
		assert.equal(history.kind, "owned-jvm-callback-result-source-history");
		assert.equal(history.baselineRevision, ownedJvmCallbackBaseline);
		assert.deepEqual(history.previous, {
			path: "docs/evidence/owned-dotnet-callback-result-source-history-20261002.json"
			, sha256: "dc4b95aa55a74b04b86e55e47289f5c45ca39d42a97247f3e9e62074496f2a59"
		});
		assert.equal(sha256(readFileSync(history.previous.path)), history.previous.sha256);
		const paths = history.updates.map(update => update.path);
		assert.deepEqual(paths, [...new Set(paths)].sort());
	}
	return history;
};
export const ownedJvmCallbackChangedPaths = Object.freeze(readOwnedJvmCallbackHistory().updates.map(update => update.path));

/**
 * Reverse an exact complete transition and reject partial or unrelated edits.
 *
 * @param source - Complete current source bytes or text.
 * @param update - Pinned path, complete identities and ordered reverse spans.
 */
export const reverseOwnedJvmCallbackUpdate = (source, update) => {
	assert.ok(ownedJvmCallbackChangedPaths.includes(update.path), update.path);
	assert.equal(sha256(source), update.currentSha256, update.path);
	assert.equal(update.strategy, "spans");
	assert.ok(Array.isArray(update.edits) && update.edits.length > 0);
	const current = source.toString(), parts = []; let end = 0;
	for(const edit of update.edits)
	{
		assert.ok(Number.isSafeInteger(edit.start) && edit.start >= end);
		assert.equal(typeof edit.current, "string"); assert.equal(typeof edit.previous, "string");
		assert.notEqual(edit.current, edit.previous);
		assert.equal(current.slice(edit.start, edit.start + edit.current.length), edit.current, update.path);
		parts.push(current.slice(end, edit.start), edit.previous); end = edit.start + edit.current.length;
	}
	parts.push(current.slice(end)); const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path); return previous;
};

/**
 * Preserve unknown bytes and stop at a requested intermediate source identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source.
 * @param expected - Optional stopping SHA-256.
 */
export const beforeOwnedJvmCallbackResults = (path, source, expected) => {
	const update = readOwnedJvmCallbackHistory().updates.find(item => item.path === path);
	const digest = sha256(source);
	return update && digest !== expected && digest === update.currentSha256
		? reverseOwnedJvmCallbackUpdate(source, update) : source;
};
