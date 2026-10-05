/**
 * Preserve callback acceptance across the development-package inventory repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeOwnedCppCallbackResults } from "./owned-cpp-callback-result-history.mjs";

export const callbackInventoryHistoryPath = "docs/evidence/owned-callback-inventory-repair-20261002.json";
export const callbackInventoryHistorySha256 = "52dbcf9a39a7a67d7ad473a9f4f5849c3890021345370977b01ffd5d15942403";
let history;
/** Load the pinned repair ledger and authenticate its unchanged predecessor. */
export const readCallbackInventoryHistory = () => {
	if(!history)
	{
		const bytes = readFileSync(callbackInventoryHistoryPath);
		assert.equal(sha256(bytes), callbackInventoryHistorySha256);
		history = JSON.parse(bytes);
		assert.equal(history.kind, "owned-callback-inventory-repair");
		assert.equal(history.schemaVersion, 1);
		assert.equal(history.baselineRevision, "44c6789c830869b9923245cb38c29d4215da1433");
		assert.deepEqual(history.previous, {
			path: "docs/evidence/owned-callback-results-20261002.json"
			, sha256: "f1e30c443a9f0b6c34035008cb5f7831a646b6f49f038d0ccbfa4edc440adb75"
		});
		assert.equal(sha256(readFileSync(history.previous.path)), history.previous.sha256);
		const paths = history.updates.map(update => update.path);
		assert.deepEqual(paths, [...new Set(paths)].sort());
	}
	return history;
};
export const callbackInventoryRepairPaths = Object.freeze(readCallbackInventoryHistory().updates.map(update => update.path));

/**
 * Reverse only the exact registered transition, preserving unrelated changes.
 *
 * @param path - Repository-relative source path.
 * @param source - Complete current or historical source bytes.
 * @param expected - Optional stopping digest.
 */
export const beforeCallbackInventoryRepair = (path, source, expected) => {
	source = beforeOwnedCppCallbackResults(path, source, expected);
	const update = readCallbackInventoryHistory().updates.find(item => item.path === path);
	if(!update || sha256(source) === expected || sha256(source) !== update.currentSha256) return source;
	if(update.strategy === "replacements")
	{
		let previous = source.toString();
		for(const edit of [...update.edits].reverse())
		{
			assert.equal(typeof edit.current, "string"); assert.ok(edit.current.length > 0);
			assert.equal(typeof edit.previous, "string"); assert.notEqual(edit.current, edit.previous);
			assert.ok(Number.isSafeInteger(edit.count) && edit.count > 0);
			assert.equal(previous.split(edit.current).length, edit.count + 1, path);
			previous = previous.replaceAll(edit.current, edit.previous);
		}
		assert.equal(sha256(previous), update.previousSha256, path); return previous;
	}
	assert.equal(update.strategy, "spans");
	const text = source.toString(), parts = []; let end = 0;
	for(const edit of update.edits)
	{
		assert.ok(Number.isSafeInteger(edit.start) && edit.start >= end);
		assert.equal(text.slice(edit.start, edit.start + edit.current.length), edit.current);
		assert.notEqual(edit.current, edit.previous);
		parts.push(text.slice(end, edit.start), edit.previous); end = edit.start + edit.current.length;
	}
	parts.push(text.slice(end)); const previous = parts.join("");
	assert.equal(sha256(previous), update.previousSha256, path); return previous;
};
