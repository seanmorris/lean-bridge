/**
 * Keep Rust callback ownership upgrades separate from prior acceptance records.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { beforeOwnedPythonCallbackResults } from "./helpers/owned-python-callback-result-history.mjs";
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
		// The hub reverses every recognized state, so live reads and predecessor reads name their stops.
		const current = Buffer.from(beforeOwnedPythonCallbackResults(update.path, await readFile(update.path), update.currentSha256));
		const prior = beforeOwnedRustCallbackResults(update.path, current, update.previousSha256);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(sha256(prior), update.previousSha256, update.path);
		assert.equal(beforeOwnedRustCallbackResults(update.path, current, update.currentSha256), current);
		assert.equal(beforeOwnedRustCallbackResults(update.path, prior, update.previousSha256), prior);
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
	const path = "docs/type-surface.v1.json", history = JSON.parse(await readFile(ownedRustCallbackHistoryPath, "utf8"));
	const transition = history.updates.find(update => update.path === path);
	assert.ok(transition, "Rust callback history records an explicit type-surface predecessor");
	const current = beforeOwnedPythonCallbackResults(path, await readFile(path, "utf8"), transition.currentSha256);
	const previous = JSON.parse(beforeOwnedRustCallbackResults(path, current, transition.previousSha256));
	// Source pins compare against the milestone inventory's own pins, never later live bytes.
	const pins = new Map();
	for(const evidence of JSON.parse(current).evidence) for(const file of evidence.files)
	{
		assert.ok(!pins.has(file.path) || pins.get(file.path) === file.sha256, file.path);
		pins.set(file.path, file.sha256);
	}
	for(const evidence of previous.evidence) for(const file of evidence.files)
	{
		assert.ok(pins.has(file.path), file.path);
		file.sha256 = pins.get(file.path);
	}
	assert.deepEqual(JSON.parse(current), previous);
	const binary = Buffer.from([0, 255, 128, 192]);
	assert.equal(beforeOwnedRustCallbackResults("unrelated.bin", binary), binary);
});
