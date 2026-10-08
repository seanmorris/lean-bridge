/**
 * Browser callback archive and the support table preserve earlier source evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeBrowserCallbackArchiveSource, browserCallbackArchiveChangedPaths, browserCallbackArchiveHistoryPath, reverseBrowserCallbackArchiveUpdate } from "./browser-callback-archive-source-history.mjs";

test("Browser callback archive authenticates each exact source predecessor", async () => {
	const record = JSON.parse(await readFile(browserCallbackArchiveHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "111ec13268059c8bf8c901ff0b17583c1fa3ed29");
	assert.deepEqual(record.updates.map(update => update.path), browserCallbackArchiveChangedPaths);
	for(const update of record.updates)
	{
		const source = await readFile(update.path, "utf8");
		assert.equal(sha256(reverseBrowserCallbackArchiveUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeBrowserCallbackArchiveSource(update.path, source)), update.previousSha256);
		assert.equal(beforeBrowserCallbackArchiveSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforeBrowserCallbackArchiveSource(update.path, changed), changed);
		assert.throws(() => reverseBrowserCallbackArchiveUpdate(changed, update));
		assert.throws(() => reverseBrowserCallbackArchiveUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});
