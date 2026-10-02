/**
 * Authenticate the callback-result source transition without rewriting receipts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeCallbackInventoryRepair } from "./owned-callback-inventory-history.mjs";

export const ownedCallbackResultHistoryPath = "docs/evidence/owned-callback-result-source-history-20261002.json";
export const ownedCallbackResultHistorySha256 = "7698cab1fc6c12a7272d2e042f01dee1066fe4391c719d3df5aeda9215619e12";
export const ownedCallbackResultBaseline = "ac6b9d4c7bbb2c2b3fc6919ef7b1b85bbb89f4ad";
let history;
const readHistory = () => {
	if(!history)
	{
		const bytes = readFileSync(ownedCallbackResultHistoryPath);
		assert.equal(sha256(bytes), ownedCallbackResultHistorySha256);
		history = JSON.parse(bytes);
		assert.equal(history.schemaVersion, 1);
		assert.equal(history.kind, "owned-callback-result-source-history");
		assert.equal(history.baselineRevision, ownedCallbackResultBaseline);
		assert.deepEqual(history.previous, {
			path: "docs/evidence/copied-fixture-reader-repair-20261002.json"
			, sha256: "767d1d2958676ed9018e7a690a96f49be5c709494aa8316b9dc7d09401601dee"
		});
		assert.equal(sha256(readFileSync(history.previous.path)), history.previous.sha256);
		const paths = history.updates.map(update => update.path);
		assert.deepEqual(paths, [...new Set(paths)].sort());
	}
	return history;
};
export const ownedCallbackResultChangedPaths = Object.freeze(readHistory().updates.map(update => update.path));

/**
 * Restore exact predecessor spans only after checking both complete identities.
 *
 * @param source - Complete current source bytes or text.
 * @param update - Registered path, before/after identities and ordered spans.
 */
export const reverseOwnedCallbackResultUpdate = (source, update) => {
	assert.ok(ownedCallbackResultChangedPaths.includes(update.path), update.path);
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
		assert.equal(sha256(previous), update.previousSha256, update.path);
		return previous;
	}
	assert.equal(update.strategy, "spans");
	const current = source.toString(), parts = [];
	let end = 0;
	for(const edit of update.edits)
	{
		assert.ok(Number.isSafeInteger(edit.start) && edit.start >= end);
		assert.equal(typeof edit.current, "string"); assert.equal(typeof edit.previous, "string");
		assert.notEqual(edit.current, edit.previous);
		assert.equal(current.slice(edit.start, edit.start + edit.current.length), edit.current, update.path);
		parts.push(current.slice(end, edit.start), edit.previous); end = edit.start + edit.current.length;
	}
	parts.push(current.slice(end)); const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, update.path);
	return previous;
};

/**
 * Leave unrelated edits visible and stop at an explicitly requested identity.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical bytes.
 * @param expected - Optional stopping SHA-256.
 */
export const beforeOwnedCallbackResults = (path, source, expected) => {
	source = beforeCallbackInventoryRepair(path, source, expected);
	const update = readHistory().updates.find(entry => entry.path === path);
	if(!update) return source;
	const digest = sha256(source);
	return digest !== expected && digest === update.currentSha256
		? reverseOwnedCallbackResultUpdate(source, update) : source;
};
