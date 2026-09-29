/**
 * Authenticate C# input transfers without claiming other lifetime support.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertOwnedDotnetTransferExecution, assertOwnedDotnetTransferCi } from "./helpers/owned-dotnet-transfer-evidence.mjs";
import { beforeOwnedDotnetTransfer, ownedDotnetTransferAddedPaths, ownedDotnetTransferBaseline
	, ownedDotnetTransferChangedPaths, ownedDotnetTransferHistoricalBytes, ownedDotnetTransferPath
	, ownedDotnetTransferPrevious, reverseOwnedDotnetTransferUpdate } from "./helpers/owned-dotnet-transfer-history.mjs";

const read = async () => JSON.parse(await readFile(ownedDotnetTransferPath, "utf8"));

test("C# transfers bind current sources without promoting unrelated type cells", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-dotnet-transfers");
	assert.equal(record.planNode, 1219); assert.equal(record.baselineRevision, ownedDotnetTransferBaseline);
	assert.deepEqual(record.previous, ownedDotnetTransferPrevious);
	const bytes = await readFile(record.previous.path), previous = JSON.parse(bytes);
	assert.equal(sha256(bytes), record.previous.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), [...new Set([...Object.keys(previous.sources), ...ownedDotnetTransferAddedPaths])].sort());
	for(const [path, digest] of Object.entries(record.sources)) assert.equal(sha256(await readFile(path)), digest, path);
	assert.deepEqual(record.updates.map(update => update.path), ownedDotnetTransferChangedPaths);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, previous.sources[update.path]);
		assert.equal(update.currentSha256, record.sources[update.path]);
		const current = await readFile(update.path, "utf8"), prior = beforeOwnedDotnetTransfer(update.path, current);
		assert.equal(sha256(prior), update.previousSha256);
		assert.equal(beforeOwnedDotnetTransfer(update.path, prior), prior);
		assert.equal(beforeOwnedDotnetTransfer(update.path, current, update.currentSha256), current);
	}
	const current = await readFile("docs/type-surface.v1.json", "utf8");
	const previousIndex = JSON.parse(beforeOwnedDotnetTransfer("docs/type-surface.v1.json", current));
	for(const evidence of previousIndex.evidence) for(const file of evidence.files) file.sha256 = sha256(await readFile(file.path));
	assert.deepEqual(JSON.parse(current), previousIndex);
});

test("C# transfer history rejects unrelated edits and invalid reversal spans", async () => {
	for(const update of (await read()).updates)
	{
		const source = await readFile(update.path, "utf8"), unknown = source + "\n/* unrelated */\n";
		assert.equal(beforeOwnedDotnetTransfer(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedDotnetTransferUpdate(unknown, update));
		for(const changed of [{ ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }
			, { ...update, edits: [...update.edits, update.edits[0]] }])
			assert.throws(() => reverseOwnedDotnetTransferUpdate(source, changed));
	}
	const binary = Buffer.from([0, 255, 128, 192]);
	assert.equal(ownedDotnetTransferHistoricalBytes("unrelated.bin", binary), binary);
});

test("C# transfer receipts require both compiler paths, installed NuGet and enabled CI", async () => {
	await assertOwnedDotnetTransferExecution(await read());
	assertOwnedDotnetTransferCi(await readFile(".github/workflows/consumer-matrix.yml", "utf8"));
});

test("C# transfer evidence rejects forged handoffs, installation and wider support", async () => {
	const original = await read();
	for(const mutate of [
		...["otherConsumerBindings", "anchoredBorrowedResults", "docker"].map(key => record => { record.scope[key] = true; })
		, record => { record.run.exitCode = 1; }
		, record => { record.run.command += " --import forged.mjs"; }
		, record => { record.run.text = record.run.text.replace("# pass 6", "# pass 5"); record.run.sha256 = sha256(record.run.text); }
		, record => { record.runtime[0].actualLean = false; }
		, record => { record.runtime[1].observed.multiNativeBefore = 0; }
		, record => { record.runtime[0].observed.identities = 1; }
		, record => { record.runtime[1].observed.managedAfter = 0; }
		, record => { record.consumers[0].sourceFreeInstallation = false; }
		, record => { record.consumers[1].relocatedObservation.checks = 0; }
		, record => { record.consumers[0].packageCacheRemoved = false; }
		, record => { record.consumers[0].documentation.sourceSha256 = "0".repeat(64); }
		, record => { record.consumers[1].adapterReceipt.dotnetValues.inputTransfers.aliases = "independent"; }
		, record => { record.consumers[0].componentReceipt.inputTransfers.consumption = "after-lean-call"; }
		, record => { record.consumers[1].manifest.ownedValues.inputTransfers.independentRetains = "consumed"; }
		, record => { record.consumers[0].manifest.schemaVersion = 1; }
		, record => { record.consumers[1].companions.ruby = 0; }
		, record => { record.consumers[0].compiledProjection.schemaVersion = 1; }
		, record => { record.consumers[0].sdkFreeExecution = false; }
		, record => { record.consumers[1].consumerSourceRemoved = false; }
		, record => { record.consumers[1].adapterReceipt.gmp.binding = "global-symbols"; }
		, record => { record.consumers[0].tamperRejected.pop(); }
		, record => { record.consumers[1].manifest.files[`lib/net8.0/${record.consumers[1].compiledProjection.assembly}.dll`].sha256 = "0".repeat(64); }
	]) {
		const changed = structuredClone(original); mutate(changed);
		await assert.rejects(() => assertOwnedDotnetTransferExecution(changed), mutate.toString());
	}
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	for(const text of ["          npm run test:owned-dotnet-transfers\n"
		, "            build/owned-dotnet-transfer-packaging/\n"
		, "          test -s build/owned-dotnet-transfers/reviewed.json\n"])
		assert.throws(() => assertOwnedDotnetTransferCi(workflow.replace(text, "")));
});
