/**
 * Keep Rust callback ownership upgrades separate from prior acceptance records.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { ownedRustCallbackHistoryPath, ownedRustCallbackHistorySha256
	, ownedRustCallbackBaseline, ownedRustCallbackChangedPaths
	, beforeOwnedRustCallbackResults, reverseOwnedRustCallbackUpdate } from "./helpers/owned-rust-callback-result-history.mjs";

test("Rust callback history authenticates exact source transitions and rejects partial edits", async () => {
	const bytes = await readFile(ownedRustCallbackHistoryPath);
	assert.equal(sha256(bytes), ownedRustCallbackHistorySha256);
	const history = JSON.parse(bytes);
	assert.equal(history.baselineRevision, ownedRustCallbackBaseline);
	assert.equal(sha256(await readFile(history.previous.path)), history.previous.sha256);
	assert.deepEqual(history.updates.map(update => update.path), ownedRustCallbackChangedPaths);
	for(const update of history.updates)
	{
		const current = await readFile(update.path), prior = beforeOwnedRustCallbackResults(update.path, current);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(sha256(prior), update.previousSha256, update.path);
		assert.equal(beforeOwnedRustCallbackResults(update.path, current, update.currentSha256), current);
		assert.equal(beforeOwnedRustCallbackResults(update.path, prior), prior);
		for(const unknown of [current + "\n", current + current, ""])
		{
			assert.equal(beforeOwnedRustCallbackResults(update.path, unknown), unknown);
			assert.throws(() => reverseOwnedRustCallbackUpdate(unknown, update));
		}
		for(const changed of [{ ...update, previousSha256: "0".repeat(64) }
			, { ...update, currentSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }, { ...update, edits: [] }
			, { ...update, edits: [...update.edits, update.edits[0]] }])
			assert.throws(() => reverseOwnedRustCallbackUpdate(current, changed));
		assert.equal(beforeOwnedRustCallbackResults("unknown.mjs", current), current);
	}
});

test("Rust callback source identities do not promote unrelated type-surface cells", async () => {
	const path = "docs/type-surface.v1.json", current = await readFile(path, "utf8");
	const previous = JSON.parse(beforeOwnedRustCallbackResults(path, current));
	for(const evidence of previous.evidence) for(const file of evidence.files)
		file.sha256 = sha256(await readFile(file.path));
	assert.deepEqual(JSON.parse(current), previous);
	const binary = Buffer.from([0, 255, 128, 192]);
	assert.equal(beforeOwnedRustCallbackResults("unrelated.bin", binary), binary);
});
