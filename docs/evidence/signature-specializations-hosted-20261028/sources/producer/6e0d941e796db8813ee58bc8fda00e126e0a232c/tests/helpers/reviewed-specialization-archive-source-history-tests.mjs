/**
 * Reviewed specialization archive and the support table preserve earlier source evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeReviewedInstantiationSource } from "./reviewed-instantiation-source-history.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeReviewedSpecializationArchiveSource, reviewedSpecializationArchiveChangedPaths, reviewedSpecializationArchiveHistoryPath, reverseReviewedSpecializationArchiveUpdate } from "./reviewed-specialization-archive-source-history.mjs";

test("Reviewed specialization archive authenticates each exact source predecessor", async () => {
	const record = JSON.parse(await readFile(reviewedSpecializationArchiveHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "f9cda046e0b624bd847fe41d521b9cb9f84f21a3");
	assert.deepEqual(record.updates.map(update => update.path), reviewedSpecializationArchiveChangedPaths);
	for(const update of record.updates)
	{
		const source = beforeReviewedInstantiationSource(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reverseReviewedSpecializationArchiveUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeReviewedSpecializationArchiveSource(update.path, source)), update.previousSha256);
		assert.equal(beforeReviewedSpecializationArchiveSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforeReviewedSpecializationArchiveSource(update.path, changed), changed);
		assert.throws(() => reverseReviewedSpecializationArchiveUpdate(changed, update));
		assert.throws(() => reverseReviewedSpecializationArchiveUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});
