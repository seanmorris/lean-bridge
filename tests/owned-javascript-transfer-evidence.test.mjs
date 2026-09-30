/**
 * Preserve prior receipts and require installed JavaScript input-transfer evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertOwnedJavaScriptTransferExecution } from "./helpers/owned-javascript-transfer-evidence.mjs";
import { beforeOwnedJavaScriptTransfer, ownedJavaScriptTransferAddedPaths, ownedJavaScriptTransferBaseline
	, ownedJavaScriptTransferChangedPaths, ownedJavaScriptTransferPath, ownedJavaScriptTransferPrevious
	, reverseOwnedJavaScriptTransferUpdate } from "./helpers/owned-javascript-transfer-history.mjs";

const read = async () => JSON.parse(await readFile(ownedJavaScriptTransferPath, "utf8"));

test("JavaScript transfers preserve prior receipts without promoting unrelated support cells", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-javascript-transfers");
	assert.equal(record.planNode, 1219); assert.equal(record.baselineRevision, ownedJavaScriptTransferBaseline);
	assert.deepEqual(record.previous, ownedJavaScriptTransferPrevious);
	const bytes = await readFile(record.previous.path), previous = JSON.parse(bytes);
	assert.equal(sha256(bytes), record.previous.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), [...Object.keys(previous.sources), ...ownedJavaScriptTransferAddedPaths].sort());
	for(const [path, hash] of Object.entries(record.sources)) assert.equal(sha256(await readFile(path)), hash, path);
	assert.deepEqual(record.updates.map(update => update.path), ownedJavaScriptTransferChangedPaths);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, previous.sources[update.path]);
		assert.equal(update.currentSha256, record.sources[update.path]);
		const source = await readFile(update.path, "utf8"), prior = beforeOwnedJavaScriptTransfer(update.path, source);
		assert.equal(sha256(prior), update.previousSha256);
		assert.equal(beforeOwnedJavaScriptTransfer(update.path, prior), prior);
		assert.equal(beforeOwnedJavaScriptTransfer(update.path, source, update.currentSha256), source);
	}
	const current = await readFile("docs/type-surface.v1.json", "utf8");
	const prior = JSON.parse(beforeOwnedJavaScriptTransfer("docs/type-surface.v1.json", current));
	for(const evidence of prior.evidence) for(const file of evidence.files) file.sha256 = sha256(await readFile(file.path));
	assert.deepEqual(JSON.parse(current), prior);
});

test("JavaScript transfer history rejects unknown changes and forged edit spans", async () => {
	for(const update of (await read()).updates)
	{
		const source = await readFile(update.path, "utf8"), unknown = source + "\n/* unrelated */\n";
		assert.equal(beforeOwnedJavaScriptTransfer(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedJavaScriptTransferUpdate(unknown, update));
		for(const changed of [{ ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }
			, { ...update, edits: [...update.edits, update.edits[0]] }])
			assert.throws(() => reverseOwnedJavaScriptTransferUpdate(source, changed));
	}
});

test("JavaScript transfer evidence requires compiled handoffs and installed browser execution", async () => {
	await assertOwnedJavaScriptTransferExecution(await read());
});

test("JavaScript transfer evidence rejects fabricated lifetime, packaging and platform claims", async () => {
	const original = await read();
	for(const mutate of [
		record => { record.scope.anchoredBorrowedResults = true; }
		, record => { record.scope.independentRebuild = true; }
		, record => { record.scope.docker = true; }
		, record => { record.scope.installedSupportPromotions = 1; }
		, record => { record.runtime[0].privateAbi.version = 10; }
		, record => { record.runtime[0].nativeFaults.before = 0; }
		, record => { record.runtime[1].hostFaults.after = 0; }
		, record => { record.runtime[1].liveIdentities++; }
		, record => { record.runtime[1].exports.pop(); }
		, record => { record.packages.reports[0].sourceRemovedBeforeInstall = false; }
		, record => { record.packages.reports[1].observed.checks--; }
		, record => { record.packages.reports[0].browser.executions.pop(); }
		, record => { record.packages.reports[1].browser.executions[0].assets[0] = "0".repeat(64); }
		, record => { record.packages.reports[0].documentation.output = "42\n"; }
		, record => { record.packages.reports[1].receipt.ownedGraph.inputTransfers.exports.pop(); }
		, record => { record.packages.reports[1].rejected = 0; }
	]) {
		const record = structuredClone(original); mutate(record);
		await assert.rejects(() => assertOwnedJavaScriptTransferExecution(record));
	}
});
