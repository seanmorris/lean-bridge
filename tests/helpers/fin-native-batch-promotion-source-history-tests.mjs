/**
 * Rust/.NET structural and WIT field promotion and the support table preserve earlier source evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforePhpShardSource } from "./php-shard-source-history.mjs";
import { beforeFinNativeBatchPromotionSource, finNativeBatchPromotionChangedPaths, finNativeBatchPromotionHistoryPath, reverseFinNativeBatchPromotionUpdate } from "./fin-native-batch-promotion-source-history.mjs";

test("Rust/.NET structural and WIT field promotion authenticates each exact source predecessor", async () => {
	const record = JSON.parse(await readFile(finNativeBatchPromotionHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "e3dcf141d7efa555eba77c75b6fe6d9750bbe3c1");
	assert.deepEqual(record.updates.map(update => update.path), finNativeBatchPromotionChangedPaths);
	for(const update of record.updates)
	{
		const source = beforePhpShardSource(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reverseFinNativeBatchPromotionUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeFinNativeBatchPromotionSource(update.path, source)), update.previousSha256);
		assert.equal(beforeFinNativeBatchPromotionSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforeFinNativeBatchPromotionSource(update.path, changed), changed);
		assert.throws(() => reverseFinNativeBatchPromotionUpdate(changed, update));
		assert.throws(() => reverseFinNativeBatchPromotionUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});
