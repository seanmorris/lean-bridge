/**
 * Reviewed Subtype decisions and the support table preserve earlier source evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeReviewedSubtypeDecisionsSource, reviewedSubtypeDecisionsChangedPaths, reviewedSubtypeDecisionsHistoryPath, reverseReviewedSubtypeDecisionsUpdate } from "./reviewed-subtype-decisions-source-history.mjs";

test("Reviewed Subtype decisions authenticates each exact source predecessor", async () => {
	const record = JSON.parse(await readFile(reviewedSubtypeDecisionsHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "b1199d39025fc12786a24bffdc7f412ea2a2b106");
	assert.deepEqual(record.updates.map(update => update.path), reviewedSubtypeDecisionsChangedPaths);
	for(const update of record.updates)
	{
		const source = await readFile(update.path, "utf8");
		assert.equal(sha256(reverseReviewedSubtypeDecisionsUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeReviewedSubtypeDecisionsSource(update.path, source)), update.previousSha256);
		assert.equal(beforeReviewedSubtypeDecisionsSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforeReviewedSubtypeDecisionsSource(update.path, changed), changed);
		assert.throws(() => reverseReviewedSubtypeDecisionsUpdate(changed, update));
		assert.throws(() => reverseReviewedSubtypeDecisionsUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});
