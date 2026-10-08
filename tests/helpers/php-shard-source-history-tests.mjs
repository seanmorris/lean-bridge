/**
 * PHP acceptance shard and the support table preserve earlier source evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeCheckedRecordPromotionSource } from "./checked-record-promotion-source-history.mjs";
import { beforePhpShardSource, phpShardChangedPaths, phpShardHistoryPath, reversePhpShardUpdate } from "./php-shard-source-history.mjs";

test("PHP acceptance shard authenticates each exact source predecessor", async () => {
	const record = JSON.parse(await readFile(phpShardHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "a6e4d2e239f503ddaad77780bdbd0686ba6c0391");
	assert.deepEqual(record.updates.map(update => update.path), phpShardChangedPaths);
	for(const update of record.updates)
	{
		const source = beforeCheckedRecordPromotionSource(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reversePhpShardUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforePhpShardSource(update.path, source)), update.previousSha256);
		assert.equal(beforePhpShardSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforePhpShardSource(update.path, changed), changed);
		assert.throws(() => reversePhpShardUpdate(changed, update));
		assert.throws(() => reversePhpShardUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});

test("PHP shard source pins do not change observations or other inventory claims", async () => {
	const path = "docs/type-surface.v1.json", text = beforeCheckedRecordPromotionSource(path, await readFile(path, "utf8"));
	const document = JSON.parse(text), previous = JSON.parse(beforePhpShardSource(path, text));
	const record = JSON.parse(await readFile(phpShardHistoryPath, "utf8"));
	const byPath = new Map(record.updates.map(update => [update.path, update]));
	let refreshed = 0;
	for(const evidence of previous.evidence) for(const file of evidence.files)
	{
		const update = byPath.get(file.path);
		if(update && update.previousSha256 === file.sha256)
		{
			assert.equal(sha256(beforeCheckedRecordPromotionSource(file.path, await readFile(file.path, "utf8"))), update.currentSha256);
			file.sha256 = update.currentSha256; refreshed++;
		}
	}
	assert.ok(refreshed > 0);
	assert.deepEqual(document, previous);
});
