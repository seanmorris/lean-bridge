/**
 * Authenticate Python transfers and reject unsupported release claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { beforeOwnedRubyTransfer, ownedRubyTransferHistoricalBytes } from "./helpers/owned-ruby-transfer-history.mjs";
import { assertOwnedPythonTransferExecution, assertOwnedPythonTransferCi } from "./helpers/owned-python-transfer-evidence.mjs";
import { beforeOwnedPythonTransfer, ownedPythonTransferAddedPaths, ownedPythonTransferBaseline
	, ownedPythonTransferChangedPaths, ownedPythonTransferHistoricalBytes, ownedPythonTransferPath
	, ownedPythonTransferPrevious, reverseOwnedPythonTransferUpdate } from "./helpers/owned-python-transfer-history.mjs";

const read = async () => JSON.parse(await readFile(ownedPythonTransferPath, "utf8"));

test("Python transfers bind current sources without promoting unrelated type cells", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-python-transfers");
	assert.equal(record.planNode, 1219); assert.equal(record.baselineRevision, ownedPythonTransferBaseline);
	assert.deepEqual(record.previous, ownedPythonTransferPrevious);
	const bytes = await readFile(record.previous.path), previous = JSON.parse(bytes);
	assert.equal(sha256(bytes), record.previous.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), [...new Set([...Object.keys(previous.sources), ...ownedPythonTransferAddedPaths])].sort());
	for(const [path, digest] of Object.entries(record.sources)) assert.equal(sha256(ownedRubyTransferHistoricalBytes(path, await readFile(path), digest)), digest, path);
	assert.deepEqual(record.updates.map(update => update.path), ownedPythonTransferChangedPaths);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, previous.sources[update.path]);
		assert.equal(update.currentSha256, record.sources[update.path]);
		const current = beforeOwnedRubyTransfer(update.path, await readFile(update.path, "utf8")), prior = beforeOwnedPythonTransfer(update.path, current);
		assert.equal(sha256(prior), update.previousSha256);
		assert.equal(beforeOwnedPythonTransfer(update.path, prior), prior);
		assert.equal(beforeOwnedPythonTransfer(update.path, current, update.currentSha256), current);
	}
	const current = beforeOwnedRubyTransfer("docs/type-surface.v1.json", await readFile("docs/type-surface.v1.json", "utf8"));
	const previousIndex = JSON.parse(beforeOwnedPythonTransfer("docs/type-surface.v1.json", current));
	for(const evidence of previousIndex.evidence) for(const file of evidence.files) file.sha256 = sha256(ownedRubyTransferHistoricalBytes(file.path, await readFile(file.path)));
	assert.deepEqual(JSON.parse(current), previousIndex);
});

test("Python transfer history rejects unrelated edits and invalid reversal spans", async () => {
	for(const update of (await read()).updates)
	{
		const source = beforeOwnedRubyTransfer(update.path, await readFile(update.path, "utf8")), unknown = source + "\n/* unrelated */\n";
		assert.equal(beforeOwnedPythonTransfer(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedPythonTransferUpdate(unknown, update));
		for(const changed of [{ ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }
			, { ...update, edits: [...update.edits, update.edits[0]] }])
			assert.throws(() => reverseOwnedPythonTransferUpdate(source, changed));
	}
	const binary = Buffer.from([0, 255, 128, 192]);
	assert.equal(ownedPythonTransferHistoricalBytes("unrelated.bin", binary), binary);
});

test("Python transfer receipts require both compiler paths, installed wheels and enabled CI", async () => {
	await assertOwnedPythonTransferExecution(await read());
	assertOwnedPythonTransferCi(await readFile(".github/workflows/consumer-matrix.yml", "utf8"));
});

test("Python transfer evidence rejects forged handoffs, installation and wider support", async () => {
	const original = await read();
	for(const mutate of [
		...["otherConsumerBindings", "anchoredBorrowedResults", "docker"].map(key => record => { record.scope[key] = true; })
		, record => { record.run.exitCode = 1; }
		, record => { record.run.command += " --import forged.mjs"; }
		, record => { record.run.text = record.run.text.replace("# pass 6", "# pass 5"); record.run.sha256 = sha256(record.run.text); }
		, record => { record.runtime[0].actualLean = false; }
		, record => { record.runtime[1].observations[0].multiNativeBefore = 0; }
		, record => { record.runtime[0].observations[1].identities = 1; }
		, record => { record.runtime[1].observations.pop(); }
		, record => { record.consumers[0].sourceFreeInstallation = false; }
		, record => { record.consumers[1].observations[0].relocatedChecks = 0; }
		, record => { record.consumers[0].documentationSha256 = "0".repeat(64); }
		, record => { record.consumers[1].adapterReceipt.pythonValues.inputTransfers.aliases = "independent"; }
		, record => { record.consumers[0].componentReceipt.inputTransfers.consumption = "after-lean-call"; }
		, record => { record.consumers[1].observations[2].manifest.ownedValues.inputTransfers.independentRetains = "consumed"; }
		, record => { record.consumers[0].observations[0].manifest.schemaVersion = 2; }
		, record => { record.consumers[1].companions.rust = 0; }
		, record => { record.consumers[0].observations[0].installation.resolvedOffline = false; }
		, record => { record.consumers[0].observations[0].loader.liveIdentities = 1; }
	]) {
		const changed = structuredClone(original); mutate(changed);
		await assert.rejects(() => assertOwnedPythonTransferExecution(changed), mutate.toString());
	}
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	for(const text of ["          npm run test:owned-python-transfers\n"
		, "            build/owned-python-transfer-packaging/\n"
		, "          test -s build/owned-python-transfers/reviewed.json\n"])
		assert.throws(() => assertOwnedPythonTransferCi(workflow.replace(text, "")));
});
