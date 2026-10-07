/**
 * Reviewed Fin promotion and the support table preserve earlier source evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeCiDependencyTimeoutSource } from "./ci-dependency-timeout-source-history.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeReviewedFinPromotionSource, reviewedFinPromotionChangedPaths, reviewedFinPromotionHistoryPath, reverseReviewedFinPromotionUpdate } from "./reviewed-fin-promotion-source-history.mjs";

test("Reviewed Fin promotion authenticates each exact source predecessor", async () => {
	const record = JSON.parse(await readFile(reviewedFinPromotionHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "d40fd3bbb25728fcacb4ca50b88ded8610aae19a");
	assert.deepEqual(record.updates.map(update => update.path), reviewedFinPromotionChangedPaths);
	for(const update of record.updates)
	{
		const source = beforeCiDependencyTimeoutSource(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reverseReviewedFinPromotionUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeReviewedFinPromotionSource(update.path, source)), update.previousSha256);
		assert.equal(beforeReviewedFinPromotionSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforeReviewedFinPromotionSource(update.path, changed), changed);
		assert.throws(() => reverseReviewedFinPromotionUpdate(changed, update));
		assert.throws(() => reverseReviewedFinPromotionUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});
