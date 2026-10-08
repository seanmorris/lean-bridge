/**
 * Native acceptance evidence archives and the support table preserve earlier source evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeArchiveBatchSource, archiveBatchChangedPaths, archiveBatchHistoryPath, reverseArchiveBatchUpdate } from "./archive-batch-source-history.mjs";

test("Native acceptance evidence archives authenticates each exact source predecessor", async () => {
	const record = JSON.parse(await readFile(archiveBatchHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "0df7653eee9146cace444ac0fa7ddb3c6c962237");
	assert.deepEqual(record.updates.map(update => update.path), archiveBatchChangedPaths);
	for(const update of record.updates)
	{
		const source = await readFile(update.path, "utf8");
		assert.equal(sha256(reverseArchiveBatchUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeArchiveBatchSource(update.path, source)), update.previousSha256);
		assert.equal(beforeArchiveBatchSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforeArchiveBatchSource(update.path, changed), changed);
		assert.throws(() => reverseArchiveBatchUpdate(changed, update));
		assert.throws(() => reverseArchiveBatchUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});
