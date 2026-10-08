/**
 * JVM acceptance shard and the support table preserve earlier source evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeJvmShardSource, jvmShardChangedPaths, jvmShardHistoryPath, reverseJvmShardUpdate } from "./jvm-shard-source-history.mjs";

test("JVM acceptance shard authenticates each exact source predecessor", async () => {
	const record = JSON.parse(await readFile(jvmShardHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "ff6c0ef943d5d2bf40a937b970a8c3d71eb383f4");
	assert.deepEqual(record.updates.map(update => update.path), jvmShardChangedPaths);
	for(const update of record.updates)
	{
		const source = await readFile(update.path, "utf8");
		assert.equal(sha256(reverseJvmShardUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeJvmShardSource(update.path, source)), update.previousSha256);
		assert.equal(beforeJvmShardSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforeJvmShardSource(update.path, changed), changed);
		assert.throws(() => reverseJvmShardUpdate(changed, update));
		assert.throws(() => reverseJvmShardUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});
