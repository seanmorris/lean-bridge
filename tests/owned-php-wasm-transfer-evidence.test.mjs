/**
 * Preserve earlier receipts and authenticate installed PHP-Wasm transfers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertOwnedPhpWasmTransferExecution } from "./helpers/owned-php-wasm-transfer-evidence.mjs";
import { beforeOwnedPhpWasmTransfer, ownedPhpWasmTransferAddedPaths, ownedPhpWasmTransferBaseline
	, ownedPhpWasmTransferChangedPaths, ownedPhpWasmTransferPath, ownedPhpWasmTransferPrevious
	, reverseOwnedPhpWasmTransferUpdate } from "./helpers/owned-php-wasm-transfer-history.mjs";

const read = async () => JSON.parse(await readFile(ownedPhpWasmTransferPath, "utf8"));

test("PHP-Wasm transfers preserve frozen receipts without promoting unrelated type cells", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-php-wasm-transfers");
	assert.equal(record.planNode, 1219); assert.equal(record.baselineRevision, ownedPhpWasmTransferBaseline);
	assert.deepEqual(record.previous, ownedPhpWasmTransferPrevious);
	const bytes = await readFile(record.previous.path), previous = JSON.parse(bytes);
	assert.equal(sha256(bytes), record.previous.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), [...Object.keys(previous.sources), ...ownedPhpWasmTransferAddedPaths].sort());
	for(const [path, hash] of Object.entries(record.sources)) assert.equal(sha256(await readFile(path)), hash, path);
	assert.deepEqual(record.updates.map(update => update.path), ownedPhpWasmTransferChangedPaths);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, previous.sources[update.path]);
		assert.equal(update.currentSha256, record.sources[update.path]);
		const source = await readFile(update.path, "utf8"), prior = beforeOwnedPhpWasmTransfer(update.path, source);
		assert.equal(sha256(prior), update.previousSha256);
		assert.equal(beforeOwnedPhpWasmTransfer(update.path, prior), prior);
		assert.equal(beforeOwnedPhpWasmTransfer(update.path, source, update.currentSha256), source);
	}
	const current = await readFile("docs/type-surface.v1.json", "utf8");
	const prior = JSON.parse(beforeOwnedPhpWasmTransfer("docs/type-surface.v1.json", current));
	for(const evidence of prior.evidence) for(const file of evidence.files) file.sha256 = sha256(await readFile(file.path));
	assert.deepEqual(JSON.parse(current), prior);
});

test("PHP-Wasm transfer history rejects unknown edits and forged reversal spans", async () => {
	for(const update of (await read()).updates)
	{
		const source = await readFile(update.path, "utf8"), unknown = source + "\n/* unrelated */\n";
		assert.equal(beforeOwnedPhpWasmTransfer(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedPhpWasmTransferUpdate(unknown, update));
		for(const changed of [{ ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }
			, { ...update, edits: [...update.edits, update.edits[0]] }])
			assert.throws(() => reverseOwnedPhpWasmTransferUpdate(source, changed));
	}
});

test("PHP-Wasm transfers require compiled handoffs, installed archives and executable docs", async () => {
	await assertOwnedPhpWasmTransferExecution(await read());
});

test("PHP-Wasm evidence rejects fabricated lifetime, package and platform claims", async () => {
	const original = await read();
	for(const mutate of [
		record => { record.scope.anchoredBorrowedResults = true; }
		, record => { record.scope.docker = true; }
		, record => { record.scope.installedSupportPromotions = 1; }
		, record => { record.run.command += " --import forged.mjs"; }
		, record => { record.runtime[0].observations[0].checks--; }
		, record => { record.runtime[1].observations[0].heldErrors = 0; }
		, record => { record.runtime[0].observations[0].faults.single.after = 0; }
		, record => { record.runtime[1].observations[1].identities++; }
		, record => { record.runtime[0].bailouts.pop(); }
		, record => { record.runtime[1].bailouts[0].before.live++; }
		, record => { record.packages.observations[0].sourceFreeInstallation = false; }
		, record => { record.packages.observations[1].executions.pop(); }
		, record => { record.packages.observations[0].executions[0].observed.functions.pop(); }
		, record => { record.packages.observations[1].receipt.ownedGraph.inputTransfers.exports.pop(); }
		, record => { record.packages.observations[0].browser.observations[0].executions[0].refreshed.liveIdentities++; }
		, record => { record.packages.observations[1].rejected.pop(); }
		, record => { record.documentation.consumerSha256 = "0".repeat(64); }
		, record => { record.documentation.observed.output = "42\n42\n"; }
	]) {
		const record = structuredClone(original); mutate(record);
		await assert.rejects(() => assertOwnedPhpWasmTransferExecution(record));
	}
});
