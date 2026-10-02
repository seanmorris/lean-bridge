/**
 * Exact callback source upgrades preserve history and expose unrecorded edits.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { beforeCallbackInventoryRepair } from "./helpers/owned-callback-inventory-history.mjs";
import { ownedCallbackResultHistoryPath, ownedCallbackResultHistorySha256
	, ownedCallbackResultBaseline, ownedCallbackResultChangedPaths
	, beforeOwnedCallbackResults, reverseOwnedCallbackResultUpdate } from "./helpers/owned-callback-result-history.mjs";

test("callback lifetime history authenticates each exact source transition", async () => {
	const bytes = await readFile(ownedCallbackResultHistoryPath);
	assert.equal(sha256(bytes), ownedCallbackResultHistorySha256);
	const history = JSON.parse(bytes);
	assert.equal(history.baselineRevision, ownedCallbackResultBaseline);
	assert.equal(sha256(await readFile(history.previous.path)), history.previous.sha256);
	assert.deepEqual(history.updates.map(update => update.path), ownedCallbackResultChangedPaths);
	for(const update of history.updates)
	{
		const current = beforeCallbackInventoryRepair(update.path, await readFile(update.path)), prior = beforeOwnedCallbackResults(update.path, current);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(sha256(prior), update.previousSha256, update.path);
		assert.equal(beforeOwnedCallbackResults(update.path, current, update.currentSha256), current);
		assert.equal(beforeOwnedCallbackResults(update.path, prior, update.previousSha256), prior);
		assert.equal(beforeOwnedCallbackResults(update.path, prior), prior);
		for(const unknown of [current + "\n", current + current, ""])
		{
			assert.equal(beforeOwnedCallbackResults(update.path, unknown), unknown);
			assert.notEqual(sha256(unknown), update.previousSha256);
			assert.throws(() => reverseOwnedCallbackResultUpdate(unknown, update));
		}
		for(const changed of [{ ...update, previousSha256: "0".repeat(64) }
			, { ...update, currentSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }
			, { ...update, edits: [] }
			, { ...update, edits: [...update.edits, update.edits[0]] }])
			assert.throws(() => reverseOwnedCallbackResultUpdate(current, changed));
		assert.equal(beforeOwnedCallbackResults("unknown.mjs", current), current);
	}
});

test("callback source upgrades refresh hashes without claiming new support cells", async () => {
	const path = "docs/type-surface.v1.json", current = beforeCallbackInventoryRepair(path, await readFile(path, "utf8"));
	const previous = JSON.parse(beforeOwnedCallbackResults(path, current));
	for(const evidence of previous.evidence) for(const file of evidence.files)
		file.sha256 = sha256(beforeCallbackInventoryRepair(file.path, await readFile(file.path)));
	assert.deepEqual(JSON.parse(current), previous);
	const bytes = Buffer.from([0, 255, 128, 192]);
	assert.equal(beforeOwnedCallbackResults("unrelated.bin", bytes), bytes);
});
