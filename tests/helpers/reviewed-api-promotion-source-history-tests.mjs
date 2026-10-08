/**
 * Reviewed API promotion and the support table preserve earlier source evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeReviewedApiPromotionSource, reviewedApiPromotionChangedPaths, reviewedApiPromotionHistoryPath, reverseReviewedApiPromotionUpdate } from "./reviewed-api-promotion-source-history.mjs";

test("Reviewed API promotion authenticates each exact source predecessor", async () => {
	const record = JSON.parse(await readFile(reviewedApiPromotionHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "72c5e27e62bf5676c29a24174cad7ff35b39c447");
	assert.deepEqual(record.updates.map(update => update.path), reviewedApiPromotionChangedPaths);
	for(const update of record.updates)
	{
		const source = await readFile(update.path, "utf8");
		assert.equal(sha256(reverseReviewedApiPromotionUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeReviewedApiPromotionSource(update.path, source)), update.previousSha256);
		assert.equal(beforeReviewedApiPromotionSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforeReviewedApiPromotionSource(update.path, changed), changed);
		assert.throws(() => reverseReviewedApiPromotionUpdate(changed, update));
		assert.throws(() => reverseReviewedApiPromotionUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});
