/**
 * Preserve prior receipts and reject forged installed Rust consumption claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertOwnedRustTransferExecution, assertOwnedRustTransferCi } from "./helpers/owned-rust-transfer-evidence.mjs";
import { beforeOwnedRustTransfer, ownedRustTransferAddedPaths, ownedRustTransferBaseline
	, ownedRustTransferChangedPaths, ownedRustTransferHistoricalBytes, ownedRustTransferPath
	, ownedRustTransferPrevious, reverseOwnedRustTransferUpdate } from "./helpers/owned-rust-transfer-history.mjs";

const read = async () => JSON.parse(await readFile(ownedRustTransferPath, "utf8"));

test("Rust transfer acceptance binds current sources without promoting unrelated type cells", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-rust-transfers");
	assert.equal(record.planNode, 1219); assert.equal(record.baselineRevision, ownedRustTransferBaseline);
	assert.deepEqual(record.previous, ownedRustTransferPrevious);
	const previousBytes = await readFile(record.previous.path), previous = JSON.parse(previousBytes);
	assert.equal(sha256(previousBytes), record.previous.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), [...new Set([...Object.keys(previous.sources), ...ownedRustTransferAddedPaths])].sort());
	for(const [path, digest] of Object.entries(record.sources)) assert.equal(sha256(await readFile(path)), digest, path);
	assert.deepEqual(record.updates.map(update => update.path), ownedRustTransferChangedPaths);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, previous.sources[update.path], update.path);
		assert.equal(update.currentSha256, record.sources[update.path], update.path);
		const current = await readFile(update.path, "utf8"), prior = beforeOwnedRustTransfer(update.path, current);
		assert.equal(sha256(prior), update.previousSha256);
		assert.equal(beforeOwnedRustTransfer(update.path, prior), prior);
		assert.equal(beforeOwnedRustTransfer(update.path, current, update.currentSha256), current);
	}
	const current = await readFile("docs/type-surface.v1.json", "utf8");
	const previousIndex = JSON.parse(beforeOwnedRustTransfer("docs/type-surface.v1.json", current));
	for(const evidence of previousIndex.evidence) for(const file of evidence.files) file.sha256 = sha256(await readFile(file.path));
	assert.deepEqual(JSON.parse(current), previousIndex);
});

test("Rust transfer history rejects unrelated edits and invalid reversal spans", async () => {
	for(const update of (await read()).updates)
	{
		const source = await readFile(update.path, "utf8"), unknown = source + "\n/* unrelated change */\n";
		assert.equal(beforeOwnedRustTransfer(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedRustTransferUpdate(unknown, update));
		for(const changed of [{ ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }
			, { ...update, edits: [...update.edits, update.edits[0]] }])
			assert.throws(() => reverseOwnedRustTransferUpdate(source, changed));
	}
	const binary = Buffer.from([0, 255, 128, 192]);
	assert.equal(ownedRustTransferHistoricalBytes("unrelated.bin", binary), binary);
});

test("Rust transfer receipts require both compiler paths, installed consumers and enabled CI", async () => {
	await assertOwnedRustTransferExecution(await read());
	assertOwnedRustTransferCi(await readFile(".github/workflows/consumer-matrix.yml", "utf8"));
});

test("Rust transfer evidence rejects forged aliases, failure behavior and wider support", async () => {
	const original = await read();
	for(const mutate of [
		...["otherConsumerBindings", "anchoredBorrowedResults", "docker"].map(key => record => { record.scope[key] = true; })
		, record => { record.run.exitCode = 1; }
		, record => { record.run.command += " --import forged.mjs"; }
		, record => { record.run.text = record.run.text.replace("# pass 6", "# pass 5"); record.run.sha256 = sha256(record.run.text); }
		, record => { record.runtime[0].actualLean = false; }
		, record => { record.runtime[1].result.multiNativeBefore = 0; }
		, record => { record.runtime[0].result.identities = 1; }
		, record => { record.runtime[1].result.panicAfter = 0; }
		, record => { record.runtime[0].rejected.pop(); }
		, record => { record.consumers[0].sourceFreeInstallation = false; }
		, record => { record.consumers[1].relocatedChecks = 0; }
		, record => { record.consumers[0].documentationSha256 = "0".repeat(64); }
		, record => { record.consumers[1].adapterReceipt.rustValues.inputTransfers.aliases = "independent"; }
		, record => { record.consumers[0].componentReceipt.inputTransfers.consumption = "after-lean-call"; }
		, record => { record.consumers[1].manifest.ownedValues.inputTransfers.independentRetains = "consumed"; }
		, record => { record.consumers[0].compiledReceipt.schemaVersion = 2; }
	]) {
		const changed = structuredClone(original); mutate(changed);
		await assert.rejects(() => assertOwnedRustTransferExecution(changed), mutate.toString());
	}
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	for(const text of ["          npm run test:owned-rust-transfers\n"
		, "            build/owned-rust-transfer-packaging/\n"
		, "          test -s build/owned-rust-transfers/reviewed.json\n"])
		assert.throws(() => assertOwnedRustTransferCi(workflow.replace(text, "")));
});
