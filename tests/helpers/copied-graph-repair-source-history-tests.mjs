/**
 * Restore copied-graph callers without changing installed claims or original evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeCallbackFinPromotionSource } from "./callback-fin-promotion-source-history.mjs";
import { beforeCopiedGraphRepairSource, copiedGraphRepairChangedPaths, copiedGraphRepairHistoryPath, reverseCopiedGraphRepairUpdate } from "./copied-graph-repair-source-history.mjs";

test("copied-graph repair authenticates each exact source predecessor", async () => {
	const record = JSON.parse(await readFile(copiedGraphRepairHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "2b5a0f9d6a32a7973c8b91a2751558dc6a8d8010");
	assert.deepEqual(record.updates.map(update => update.path), copiedGraphRepairChangedPaths);
	for(const update of record.updates)
	{
		const source = beforeCallbackFinPromotionSource(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reverseCopiedGraphRepairUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeCopiedGraphRepairSource(update.path, source)), update.previousSha256);
		assert.equal(beforeCopiedGraphRepairSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforeCopiedGraphRepairSource(update.path, changed), changed);
		assert.throws(() => reverseCopiedGraphRepairUpdate(changed, update));
		assert.throws(() => reverseCopiedGraphRepairUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});

test("copied-graph repair updates source identities without changing observed coverage", async () => {
	const path = "docs/type-surface.v1.json", source = beforeCallbackFinPromotionSource(path, await readFile(path, "utf8"));
	const current = JSON.parse(source), previous = JSON.parse(beforeCopiedGraphRepairSource(path, source));
	const record = JSON.parse(await readFile(copiedGraphRepairHistoryPath, "utf8"));
	const updates = new Map(record.updates.map(update => [update.path, update]));
	let pins = 0;
	for(const entry of previous.evidence) for(const file of entry.files)
	{
		const update = updates.get(file.path);
		if(!update || file.sha256 !== update.previousSha256) continue;
		assert.equal(sha256(beforeCallbackFinPromotionSource(file.path, await readFile(file.path, "utf8"))), update.currentSha256);
		file.sha256 = update.currentSha256; pins++;
	}
	assert.ok(pins > 0);
	assert.deepEqual(current, previous);
});
