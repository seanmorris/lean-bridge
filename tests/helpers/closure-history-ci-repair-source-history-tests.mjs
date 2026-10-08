/**
 * Closure history CI repair and the support table preserve earlier source evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeClosureHistoryCiRepairSource, closureHistoryCiRepairChangedPaths, closureHistoryCiRepairHistoryPath, reverseClosureHistoryCiRepairUpdate } from "./closure-history-ci-repair-source-history.mjs";

test("Closure history CI repair authenticates each exact source predecessor", async () => {
	const record = JSON.parse(await readFile(closureHistoryCiRepairHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "84c804242b76bc3d01d10a87d96d88859fb2917f");
	assert.deepEqual(record.updates.map(update => update.path), closureHistoryCiRepairChangedPaths);
	for(const update of record.updates)
	{
		const source = await readFile(update.path, "utf8");
		assert.equal(sha256(reverseClosureHistoryCiRepairUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeClosureHistoryCiRepairSource(update.path, source)), update.previousSha256);
		assert.equal(beforeClosureHistoryCiRepairSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforeClosureHistoryCiRepairSource(update.path, changed), changed);
		assert.throws(() => reverseClosureHistoryCiRepairUpdate(changed, update));
		assert.throws(() => reverseClosureHistoryCiRepairUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});
