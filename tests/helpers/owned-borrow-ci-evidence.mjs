/**
 * Check the historical extractor repair and every repaired installed receipt.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { ownedBorrowHistoricalBytes } from "./owned-borrow-history.mjs";
import { ownedBorrowCiBaseline, ownedBorrowCiPrevious, ownedBorrowCiChangedPaths
	, ownedBorrowCiAddedPaths, reverseOwnedBorrowCiUpdate } from "./owned-borrow-ci-history.mjs";

export const ownedBorrowCiConsumers = ["dotnet", "jvm", "perl", "php", "python", "ruby", "rust"];
export const ownedBorrowCiReceipts = ownedBorrowCiConsumers.map(name => `docs/evidence/owned-${name}-transfers-202609${name === "php" ? "30" : "29"}.json`);

/**
 * Authenticate source transitions, unchanged support, and old compiler versions.
 *
 * @param record - Repair receipt, with no new installed-runtime support claim.
 */
export const assertOwnedBorrowCiRepair = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-borrow-ci-repair");
	assert.equal(record.planNode, 1219); assert.equal(record.baselineRevision, ownedBorrowCiBaseline);
	assert.deepEqual(record.previous, ownedBorrowCiPrevious);
	assert.equal(record.typeSupportPromotions, 0);
	assert.deepEqual(record.repairedReceipts.map(item => item.path), ownedBorrowCiReceipts);
	const priorBytes = await readFile(record.previous.path), previous = JSON.parse(priorBytes);
	assert.equal(sha256(priorBytes), record.previous.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), [...Object.keys(previous.sources), ...ownedBorrowCiAddedPaths].sort());
	for(const [path, hash] of Object.entries(record.sources)) assert.equal(sha256(await readFile(path)), hash, path);
	assert.deepEqual(record.updates.map(update => update.path), ownedBorrowCiChangedPaths);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, previous.sources[update.path]);
		assert.equal(update.currentSha256, record.sources[update.path]);
		assert.equal(sha256(reverseOwnedBorrowCiUpdate(await readFile(update.path, "utf8"), update)), update.previousSha256);
	}
	assert.equal(record.sources["docs/type-surface.v1.json"], previous.sources["docs/type-surface.v1.json"]);
	const extractor = "src/analyze/NativeExports.lean", bytes = await readFile(extractor);
	assert.equal(record.extractor.path, extractor);
	assert.equal(record.extractor.currentSha256, sha256(bytes));
	assert.equal(record.extractor.previousSha256, "bbee934c9edbf1de092857dc68a0d770d9139fea40e6cfa74a2bfd3abff61b08");
	assert.equal(sha256(ownedBorrowHistoricalBytes(extractor, bytes, record.extractor.previousSha256)), record.extractor.previousSha256);
	const unknown = Buffer.concat([bytes, Buffer.from("\n-- unrecorded extractor edit\n")]);
	assert.equal(ownedBorrowHistoricalBytes(extractor, unknown, record.extractor.previousSha256), unknown.toString("utf8"));
	for(const [i, name] of ownedBorrowCiConsumers.entries())
	{
		const repaired = record.repairedReceipts[i], bytes = await readFile(repaired.path);
		assert.equal(sha256(bytes), repaired.sha256);
		const evidence = JSON.parse(bytes), title = name[0].toUpperCase() + name.slice(1);
		for(const item of [...evidence.runtime, ...evidence.consumers]) assert.equal(item.input.sourceIdentity.extractorSha256, record.extractor.previousSha256);
		const module = await import(`./owned-${name}-transfer-evidence.mjs`);
		await module[`assertOwned${title}TransferExecution`](evidence);
	}
};
