/**
 * Callback error-code and CI repair and the support table preserve earlier source evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeCallbackCodeCiRepairSource, callbackCodeCiRepairChangedPaths, callbackCodeCiRepairHistoryPath, reverseCallbackCodeCiRepairUpdate } from "./callback-code-ci-repair-source-history.mjs";

test("Callback error-code and CI repair authenticates each exact source predecessor", async () => {
	const record = JSON.parse(await readFile(callbackCodeCiRepairHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "50c742b4565b4b68ab397fa41ad8d7b82220dfe6");
	assert.deepEqual(record.updates.map(update => update.path), callbackCodeCiRepairChangedPaths);
	for(const update of record.updates)
	{
		const source = await readFile(update.path, "utf8");
		assert.equal(sha256(reverseCallbackCodeCiRepairUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeCallbackCodeCiRepairSource(update.path, source)), update.previousSha256);
		assert.equal(beforeCallbackCodeCiRepairSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforeCallbackCodeCiRepairSource(update.path, changed), changed);
		assert.throws(() => reverseCallbackCodeCiRepairUpdate(changed, update));
		assert.throws(() => reverseCallbackCodeCiRepairUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});
