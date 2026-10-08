/**
 * Reviewed Subtype harness and the support table preserve earlier source evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeReviewedSubtypeHarnessSource, reviewedSubtypeHarnessChangedPaths, reviewedSubtypeHarnessHistoryPath, reverseReviewedSubtypeHarnessUpdate } from "./reviewed-subtype-harness-source-history.mjs";

test("Reviewed Subtype harness authenticates each exact source predecessor", async () => {
	const record = JSON.parse(await readFile(reviewedSubtypeHarnessHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "58a72d6a4b13ea26521a5db7ca4832ef6453a3cd");
	assert.deepEqual(record.updates.map(update => update.path), reviewedSubtypeHarnessChangedPaths);
	for(const update of record.updates)
	{
		const source = await readFile(update.path, "utf8");
		assert.equal(sha256(reverseReviewedSubtypeHarnessUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeReviewedSubtypeHarnessSource(update.path, source)), update.previousSha256);
		assert.equal(beforeReviewedSubtypeHarnessSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforeReviewedSubtypeHarnessSource(update.path, changed), changed);
		assert.throws(() => reverseReviewedSubtypeHarnessUpdate(changed, update));
		assert.throws(() => reverseReviewedSubtypeHarnessUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});
