/**
 * Authenticate the checked native Fin admission without changing frozen installed evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeNativeFinSource, nativeFinChangedPaths
	, nativeFinHistoryPath, reverseNativeFinUpdate } from "./native-fin-source-history.mjs";

test("native Fin history authenticates predecessors and rejects unrelated edits", async () => {
	const record = JSON.parse(await readFile(nativeFinHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "e00a3eed70d08ea2e261b7908345bbd3b03b1490");
	assert.deepEqual(record.updates.map(item => item.path), nativeFinChangedPaths);
	for(const update of record.updates)
	{
		const source = await readFile(update.path, "utf8");
		assert.equal(sha256(reverseNativeFinUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeNativeFinSource(update.path, source)), update.previousSha256);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const bytes = Buffer.from(source);
		assert.equal(beforeFinRefinementSource(update.path, bytes, update.currentSha256), bytes);
		const changed = source + "\n// unrelated edit\n";
		assert.equal(beforeNativeFinSource(update.path, changed), changed);
		assert.throws(() => reverseNativeFinUpdate(changed, update));
		assert.throws(() => reverseNativeFinUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});
