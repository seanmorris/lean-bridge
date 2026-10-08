/**
 * Callback Fin promotion and the support table preserve earlier source evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeCallbackFinPromotionSource, callbackFinPromotionChangedPaths, callbackFinPromotionHistoryPath, reverseCallbackFinPromotionUpdate } from "./callback-fin-promotion-source-history.mjs";

test("Callback Fin promotion authenticates each exact source predecessor", async () => {
	const bytes = await readFile(callbackFinPromotionHistoryPath, "utf8");
	assert.equal(sha256(bytes), "0c3149e70478569d72270ef2cbcc55eaa2613afa8907c297b6c7232463e1ba36");
	const record = JSON.parse(bytes);
	assert.equal(record.predecessorCommit, "6907463975e1d6a9e1c90c16519b3defc402e2dd");
	assert.deepEqual(record.updates.map(update => update.path), callbackFinPromotionChangedPaths);
	for(const update of record.updates)
	{
		const source = await readFile(update.path, "utf8");
		assert.equal(sha256(reverseCallbackFinPromotionUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeCallbackFinPromotionSource(update.path, source)), update.previousSha256);
		assert.equal(beforeCallbackFinPromotionSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforeCallbackFinPromotionSource(update.path, changed), changed);
		assert.throws(() => reverseCallbackFinPromotionUpdate(changed, update));
		assert.throws(() => reverseCallbackFinPromotionUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});

test("callback promotion preserves every earlier evidence claim except authenticated source pins", async () => {
	const path = "docs/type-surface.v1.json", source = await readFile(path, "utf8");
	const current = JSON.parse(source), previous = JSON.parse(beforeCallbackFinPromotionSource(path, source));
	const record = JSON.parse(await readFile(callbackFinPromotionHistoryPath, "utf8"));
	const updates = new Map(record.updates.map(update => [update.path, update]));
	let pins = 0;
	for(const entry of previous.evidence) for(const file of entry.files)
	{
		const update = updates.get(file.path);
		if(!update || file.sha256 !== update.previousSha256) continue;
		assert.equal(sha256(await readFile(file.path)), update.currentSha256);
		file.sha256 = update.currentSha256; pins++;
	}
	assert.ok(pins > 0);
	assert.deepEqual(current.evidence.slice(0, previous.evidence.length), previous.evidence);
	assert.deepEqual(current.observations.slice(0, previous.observations.length), previous.observations);
});
