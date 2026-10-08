/**
 * Native consumer CI repair integration and the support table preserve earlier source evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforePhpWasmFinPromotionSource } from "./php-wasm-fin-promotion-source-history.mjs";
import { beforeNativeConsumerCiRepairSource, nativeConsumerCiRepairChangedPaths, nativeConsumerCiRepairHistoryPath, reverseNativeConsumerCiRepairUpdate } from "./native-consumer-ci-repair-source-history.mjs";

test("Native consumer CI repair integration authenticates each exact source predecessor", async () => {
	const record = JSON.parse(await readFile(nativeConsumerCiRepairHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "38ea95ab086fb2a9b961d75ca6b06e78b7e7fc10");
	assert.deepEqual(record.updates.map(update => update.path), nativeConsumerCiRepairChangedPaths);
	for(const update of record.updates)
	{
		const source = beforePhpWasmFinPromotionSource(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reverseNativeConsumerCiRepairUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeNativeConsumerCiRepairSource(update.path, source)), update.previousSha256);
		assert.equal(beforeNativeConsumerCiRepairSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforeNativeConsumerCiRepairSource(update.path, changed), changed);
		assert.throws(() => reverseNativeConsumerCiRepairUpdate(changed, update));
		assert.throws(() => reverseNativeConsumerCiRepairUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});

test("Native consumer CI repair source pins do not change observations or other inventory claims", async () => {
	const path = "docs/type-surface.v1.json", text = beforePhpWasmFinPromotionSource(path, await readFile(path, "utf8"));
	const document = JSON.parse(text), previous = JSON.parse(beforeNativeConsumerCiRepairSource(path, text));
	const record = JSON.parse(await readFile(nativeConsumerCiRepairHistoryPath, "utf8"));
	const byPath = new Map(record.updates.map(update => [update.path, update]));
	let refreshed = 0;
	for(const evidence of previous.evidence) for(const file of evidence.files)
	{
		const update = byPath.get(file.path);
		if(update && update.previousSha256 === file.sha256)
		{
			assert.equal(sha256(beforePhpWasmFinPromotionSource(file.path, await readFile(file.path, "utf8"))), update.currentSha256);
			file.sha256 = update.currentSha256; refreshed++;
		}
	}
	assert.ok(refreshed > 0);
	assert.deepEqual(document, previous);
});
