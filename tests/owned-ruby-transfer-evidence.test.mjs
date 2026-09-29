/**
 * Authenticate Ruby transfers and reject unsupported release claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertOwnedRubyTransferExecution, assertOwnedRubyTransferCi } from "./helpers/owned-ruby-transfer-evidence.mjs";
import { beforeOwnedRubyTransfer, ownedRubyTransferAddedPaths, ownedRubyTransferBaseline
	, ownedRubyTransferChangedPaths, ownedRubyTransferHistoricalBytes, ownedRubyTransferPath
	, ownedRubyTransferPrevious, reverseOwnedRubyTransferUpdate } from "./helpers/owned-ruby-transfer-history.mjs";

const read = async () => JSON.parse(await readFile(ownedRubyTransferPath, "utf8"));

test("Ruby transfers bind current sources without promoting unrelated type cells", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-ruby-transfers");
	assert.equal(record.planNode, 1219); assert.equal(record.baselineRevision, ownedRubyTransferBaseline);
	assert.deepEqual(record.previous, ownedRubyTransferPrevious);
	const bytes = await readFile(record.previous.path), previous = JSON.parse(bytes);
	assert.equal(sha256(bytes), record.previous.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), [...new Set([...Object.keys(previous.sources), ...ownedRubyTransferAddedPaths])].sort());
	for(const [path, digest] of Object.entries(record.sources)) assert.equal(sha256(await readFile(path)), digest, path);
	assert.deepEqual(record.updates.map(update => update.path), ownedRubyTransferChangedPaths);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, previous.sources[update.path]);
		assert.equal(update.currentSha256, record.sources[update.path]);
		const current = await readFile(update.path, "utf8"), prior = beforeOwnedRubyTransfer(update.path, current);
		assert.equal(sha256(prior), update.previousSha256);
		assert.equal(beforeOwnedRubyTransfer(update.path, prior), prior);
		assert.equal(beforeOwnedRubyTransfer(update.path, current, update.currentSha256), current);
	}
	const current = await readFile("docs/type-surface.v1.json", "utf8");
	const previousIndex = JSON.parse(beforeOwnedRubyTransfer("docs/type-surface.v1.json", current));
	for(const evidence of previousIndex.evidence) for(const file of evidence.files) file.sha256 = sha256(await readFile(file.path));
	assert.deepEqual(JSON.parse(current), previousIndex);
});

test("Ruby transfer history rejects unrelated edits and invalid reversal spans", async () => {
	for(const update of (await read()).updates)
	{
		const source = await readFile(update.path, "utf8"), unknown = source + "\n/* unrelated */\n";
		assert.equal(beforeOwnedRubyTransfer(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedRubyTransferUpdate(unknown, update));
		for(const changed of [{ ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }
			, { ...update, edits: [...update.edits, update.edits[0]] }])
			assert.throws(() => reverseOwnedRubyTransferUpdate(source, changed));
	}
	const binary = Buffer.from([0, 255, 128, 192]);
	assert.equal(ownedRubyTransferHistoricalBytes("unrelated.bin", binary), binary);
});

test("Ruby transfer receipts require both compiler paths, installed gems and enabled CI", async () => {
	await assertOwnedRubyTransferExecution(await read());
	assertOwnedRubyTransferCi(await readFile(".github/workflows/consumer-matrix.yml", "utf8"));
});

test("Ruby transfer evidence rejects forged handoffs, installation and wider support", async () => {
	const original = await read();
	for(const mutate of [
		...["otherConsumerBindings", "anchoredBorrowedResults", "docker"].map(key => record => { record.scope[key] = true; })
		, record => { record.run.exitCode = 1; }
		, record => { record.run.command += " --import forged.mjs"; }
		, record => { record.run.text = record.run.text.replace("# pass 6", "# pass 5"); record.run.sha256 = sha256(record.run.text); }
		, record => { record.runtime[0].actualLean = false; }
		, record => { record.runtime[1].observed.multiNativeBefore = 0; }
		, record => { record.runtime[0].observed.identities = 1; }
		, record => { record.runtime[1].observed.rubyAfter = 0; }
		, record => { record.consumers[0].sourceFreeInstallation = false; }
		, record => { record.consumers[1].relocatedObservation.checks = 0; }
		, record => { record.consumers[0].gemCacheRemoved = false; }
		, record => { record.consumers[0].documentation.sha256 = "0".repeat(64); }
		, record => { record.consumers[1].adapterReceipt.rubyValues.inputTransfers.aliases = "independent"; }
		, record => { record.consumers[0].componentReceipt.inputTransfers.consumption = "after-lean-call"; }
		, record => { record.consumers[1].manifest.ownedValues.inputTransfers.independentRetains = "consumed"; }
		, record => { record.consumers[0].manifest.schemaVersion = 1; }
		, record => { record.consumers[1].companions.python = 0; }
		, record => { record.consumers[0].loader.liveIdentities = 1; }
		, record => { record.consumers[0].loader.privateGmp = false; }
		, record => { record.consumers[1].loader.forkBeforeLock = false; }
		, record => { record.consumers[1].adapterReceipt.gmp.binding = "global-symbols"; }
		, record => { record.consumers[0].tamperRejected.pop(); }
		, record => { record.consumers[1].manifest.files["lib/lean_bridge/owned_aggregates/native.rb"].sha256 = "0".repeat(64); }
	]) {
		const changed = structuredClone(original); mutate(changed);
		await assert.rejects(() => assertOwnedRubyTransferExecution(changed), mutate.toString());
	}
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	for(const text of ["          npm run test:owned-ruby-transfers\n"
		, "            build/owned-ruby-transfer-packaging/\n"
		, "          test -s build/owned-ruby-transfers/reviewed.json\n"])
		assert.throws(() => assertOwnedRubyTransferCi(workflow.replace(text, "")));
});
