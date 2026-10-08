/**
 * Checked-record promotion and the support table preserve earlier source evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeCopiedGraphRepairSource } from "./copied-graph-repair-source-history.mjs";
import { beforeCheckedRecordPromotionSource, checkedRecordPromotionChangedPaths, checkedRecordPromotionHistoryPath, reverseCheckedRecordPromotionUpdate } from "./checked-record-promotion-source-history.mjs";

test("Checked-record promotion authenticates each exact source predecessor", async () => {
	const record = JSON.parse(await readFile(checkedRecordPromotionHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "fc58deb5ddb1f61040112883da8b6bfee3622f42");
	assert.deepEqual(record.updates.map(update => update.path), checkedRecordPromotionChangedPaths);
	for(const update of record.updates)
	{
		const source = beforeCopiedGraphRepairSource(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reverseCheckedRecordPromotionUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeCheckedRecordPromotionSource(update.path, source)), update.previousSha256);
		assert.equal(beforeCheckedRecordPromotionSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforeCheckedRecordPromotionSource(update.path, changed), changed);
		assert.throws(() => reverseCheckedRecordPromotionUpdate(changed, update));
		assert.throws(() => reverseCheckedRecordPromotionUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});
