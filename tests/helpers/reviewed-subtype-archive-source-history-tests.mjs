/**
 * Reviewed Subtype archive and the support table preserve earlier source evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeReviewedSubtypeArchiveSource, reviewedSubtypeArchiveChangedPaths, reviewedSubtypeArchiveHistoryPath, reverseReviewedSubtypeArchiveUpdate } from "./reviewed-subtype-archive-source-history.mjs";

test("Reviewed Subtype archive authenticates each exact source predecessor", async () => {
	const record = JSON.parse(await readFile(reviewedSubtypeArchiveHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "f9d5ce96eb04ec800209c6a6863092b3bdea6e85");
	assert.deepEqual(record.updates.map(update => update.path), reviewedSubtypeArchiveChangedPaths);
	for(const update of record.updates)
	{
		const source = await readFile(update.path, "utf8");
		assert.equal(sha256(reverseReviewedSubtypeArchiveUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeReviewedSubtypeArchiveSource(update.path, source)), update.previousSha256);
		assert.equal(beforeReviewedSubtypeArchiveSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforeReviewedSubtypeArchiveSource(update.path, changed), changed);
		assert.throws(() => reverseReviewedSubtypeArchiveUpdate(changed, update));
		assert.throws(() => reverseReviewedSubtypeArchiveUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});
