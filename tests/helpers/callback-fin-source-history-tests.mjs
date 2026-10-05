/**
 * Authenticate the callback Fin admission without changing frozen installed evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeCallbackFinSource, callbackFinChangedPaths
	, callbackFinHistoryPath, reverseCallbackFinUpdate } from "./callback-fin-source-history.mjs";

test("callback Fin history authenticates predecessors and rejects unrelated edits", async () => {
	const record = JSON.parse(await readFile(callbackFinHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "1d19858cec6f825c11ffa8b852baa4fc3ce5d3de");
	assert.deepEqual(record.updates.map(item => item.path), callbackFinChangedPaths);
	for(const update of record.updates)
	{
		const source = await readFile(update.path, "utf8");
		assert.equal(sha256(reverseCallbackFinUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeCallbackFinSource(update.path, source)), update.previousSha256);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const bytes = Buffer.from(source);
		assert.equal(beforeFinRefinementSource(update.path, bytes, update.currentSha256), bytes);
		const changed = source + "\n// unrelated edit\n";
		assert.equal(beforeCallbackFinSource(update.path, changed), changed);
		assert.throws(() => reverseCallbackFinUpdate(changed, update));
		assert.throws(() => reverseCallbackFinUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});
