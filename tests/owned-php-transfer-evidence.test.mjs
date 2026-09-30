/**
 * Preserve prior receipts and authenticate installed PHP input-transfer claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { beforeOwnedPhpWasmTransfer, ownedPhpWasmTransferHistoricalBytes } from "./helpers/owned-php-wasm-transfer-history.mjs";
import { assertOwnedPhpTransferExecution } from "./helpers/owned-php-transfer-evidence.mjs";
import { beforeOwnedPhpTransfer, ownedPhpTransferAddedPaths, ownedPhpTransferBaseline
	, ownedPhpTransferChangedPaths, ownedPhpTransferPath, ownedPhpTransferPrevious
	, reverseOwnedPhpTransferUpdate } from "./helpers/owned-php-transfer-history.mjs";

const read = async () => JSON.parse(await readFile(ownedPhpTransferPath, "utf8"));

test("native PHP transfers preserve frozen receipts without promoting unrelated type cells", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-php-transfers");
	assert.equal(record.planNode, 1219); assert.equal(record.baselineRevision, ownedPhpTransferBaseline);
	assert.deepEqual(record.previous, ownedPhpTransferPrevious);
	const bytes = await readFile(record.previous.path), previous = JSON.parse(bytes);
	assert.equal(sha256(bytes), record.previous.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), [...Object.keys(previous.sources), ...ownedPhpTransferAddedPaths].sort());
	for(const [path, hash] of Object.entries(record.sources)) assert.equal(sha256(ownedPhpWasmTransferHistoricalBytes(path, await readFile(path), hash)), hash, path);
	assert.deepEqual(record.updates.map(update => update.path), ownedPhpTransferChangedPaths);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, previous.sources[update.path]);
		assert.equal(update.currentSha256, record.sources[update.path]);
		const source = beforeOwnedPhpWasmTransfer(update.path, await readFile(update.path, "utf8")), prior = beforeOwnedPhpTransfer(update.path, source);
		assert.equal(sha256(prior), update.previousSha256);
		assert.equal(beforeOwnedPhpTransfer(update.path, prior), prior);
		assert.equal(beforeOwnedPhpTransfer(update.path, source, update.currentSha256), source);
	}
	const current = beforeOwnedPhpWasmTransfer("docs/type-surface.v1.json", await readFile("docs/type-surface.v1.json", "utf8"));
	const prior = JSON.parse(beforeOwnedPhpTransfer("docs/type-surface.v1.json", current));
	for(const evidence of prior.evidence) for(const file of evidence.files) file.sha256 = sha256(ownedPhpWasmTransferHistoricalBytes(file.path, await readFile(file.path)));
	assert.deepEqual(JSON.parse(current), prior);
});

test("native PHP transfer history rejects unknown edits and forged reversal spans", async () => {
	for(const update of (await read()).updates)
	{
		const source = beforeOwnedPhpWasmTransfer(update.path, await readFile(update.path, "utf8")), unknown = source + "\n/* unrelated */\n";
		assert.equal(beforeOwnedPhpTransfer(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedPhpTransferUpdate(unknown, update));
		for(const changed of [{ ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }
			, { ...update, edits: [...update.edits, update.edits[0]] }])
			assert.throws(() => reverseOwnedPhpTransferUpdate(source, changed));
	}
});

test("native PHP transfers require compiled handoffs, installed Composer calls and executable docs", async () => {
	await assertOwnedPhpTransferExecution(await read());
});

test("native PHP evidence rejects fabricated lifetime, package and platform claims", async () => {
	const original = await read();
	for(const mutate of [
		record => { record.scope.wasm = true; }
		, record => { record.scope.anchoredBorrowedResults = true; }
		, record => { record.scope.installedSupportPromotions = 1; }
		, record => { record.run.command += " --import forged.mjs"; }
		, record => { record.runtime[0].observed.checks--; }
		, record => { record.runtime[1].observed.heldErrors = 0; }
		, record => { record.runtime[0].observed.faults.single.php.after = 0; }
		, record => { record.runtime[1].observed.identities++; }
		, record => { record.consumers[0].sourceFreeInstallation = false; }
		, record => { record.consumers[1].observations.pop(); }
		, record => { record.consumers[0].observations[0].observed.functions.pop(); }
		, record => { record.consumers[1].adapterReceipt.ownedValues.inputTransfers.exports.pop(); }
		, record => { record.consumers[0].loader.liveIdentities++; }
		, record => { record.consumers[1].installation.offline = false; }
		, record => { record.consumers[0].tamperRejected.pop(); }
		, record => { record.documentation.sourceHashes.example = "0".repeat(64); }
		, record => { record.documentation.observed.stdout = "42\n42\n"; }
	]) {
		const record = structuredClone(original); mutate(record);
		await assert.rejects(() => assertOwnedPhpTransferExecution(record));
	}
});
