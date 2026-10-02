/**
 * Keep Dotnet callback ownership upgrades separate from prior acceptance records.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { beforeOwnedJvmCallbackResults } from "./helpers/owned-jvm-callback-result-history.mjs";
import { ownedDotnetCallbackHistoryPath, ownedDotnetCallbackHistorySha256
	, ownedDotnetCallbackBaseline, ownedDotnetCallbackChangedPaths
	, beforeOwnedDotnetCallbackResults, reverseOwnedDotnetCallbackUpdate } from "./helpers/owned-dotnet-callback-result-history.mjs";

test("Dotnet callback history authenticates exact source transitions and rejects partial edits", async () => {
	const bytes = await readFile(ownedDotnetCallbackHistoryPath);
	assert.equal(sha256(bytes), ownedDotnetCallbackHistorySha256);
	const history = JSON.parse(bytes);
	assert.equal(history.baselineRevision, ownedDotnetCallbackBaseline);
	assert.equal(sha256(await readFile(history.previous.path)), history.previous.sha256);
	assert.deepEqual(history.updates.map(update => update.path), ownedDotnetCallbackChangedPaths);
	for(const update of history.updates)
	{
		const current = Buffer.from(beforeOwnedJvmCallbackResults(update.path, await readFile(update.path)));
		const prior = beforeOwnedDotnetCallbackResults(update.path, current);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(sha256(prior), update.previousSha256, update.path);
		assert.equal(beforeOwnedDotnetCallbackResults(update.path, current, update.currentSha256), current);
		assert.equal(beforeOwnedDotnetCallbackResults(update.path, prior), prior);
		for(const unknown of [current + "\n", current + current, ""])
		{
			assert.equal(beforeOwnedDotnetCallbackResults(update.path, unknown), unknown);
			assert.throws(() => reverseOwnedDotnetCallbackUpdate(unknown, update));
		}
		for(const changed of [{ ...update, previousSha256: "0".repeat(64) }
			, { ...update, currentSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }, { ...update, edits: [] }
			, { ...update, edits: [...update.edits, update.edits[0]] }])
			assert.throws(() => reverseOwnedDotnetCallbackUpdate(current, changed));
		assert.equal(beforeOwnedDotnetCallbackResults("unknown.mjs", current), current);
	}
});
