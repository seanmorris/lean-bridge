/**
 * WIT record evidence archive and the support table preserve earlier source evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeFinWitArchiveSource, finWitArchiveChangedPaths, finWitArchiveHistoryPath, reverseFinWitArchiveUpdate } from "./fin-wit-archive-source-history.mjs";

test("WIT record evidence archive authenticates each exact source predecessor", async () => {
	const record = JSON.parse(await readFile(finWitArchiveHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "ed8d83691f74c56483ca37a87896278cc9cbc25b");
	assert.deepEqual(record.updates.map(update => update.path), finWitArchiveChangedPaths);
	for(const update of record.updates)
	{
		const source = await readFile(update.path, "utf8");
		assert.equal(sha256(reverseFinWitArchiveUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeFinWitArchiveSource(update.path, source)), update.previousSha256);
		assert.equal(beforeFinWitArchiveSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforeFinWitArchiveSource(update.path, changed), changed);
		assert.throws(() => reverseFinWitArchiveUpdate(changed, update));
		assert.throws(() => reverseFinWitArchiveUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});
