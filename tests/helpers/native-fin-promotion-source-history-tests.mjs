/**
 * Native Fin promotion and the support table preserve earlier source evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeReviewedSubtypeDecisionsSource } from "./reviewed-subtype-decisions-source-history.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeNativeFinPromotionSource, nativeFinPromotionChangedPaths, nativeFinPromotionHistoryPath, reverseNativeFinPromotionUpdate } from "./native-fin-promotion-source-history.mjs";

test("native Fin promotion authenticates each exact source predecessor", async () => {
	const record = JSON.parse(await readFile(nativeFinPromotionHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "f0f2dee1ac994f7c1da548367a66e75472a91a48");
	assert.deepEqual(record.updates.map(update => update.path), nativeFinPromotionChangedPaths);
	for(const update of record.updates)
	{
		const source = beforeReviewedSubtypeDecisionsSource(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reverseNativeFinPromotionUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeNativeFinPromotionSource(update.path, source)), update.previousSha256);
		assert.equal(beforeNativeFinPromotionSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforeNativeFinPromotionSource(update.path, changed), changed);
		assert.throws(() => reverseNativeFinPromotionUpdate(changed, update));
		assert.throws(() => reverseNativeFinPromotionUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});
