/**
 * Authenticate Java/Kotlin input transfers without claiming other lifetime support.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { beforeOwnedPerlTransfer, ownedPerlTransferHistoricalBytes } from "./helpers/owned-perl-transfer-history.mjs";
import { assertOwnedJvmTransferExecution, assertOwnedJvmTransferCi } from "./helpers/owned-jvm-transfer-evidence.mjs";
import { beforeOwnedJvmTransfer, ownedJvmTransferAddedPaths, ownedJvmTransferBaseline
	, ownedJvmTransferChangedPaths, ownedJvmTransferHistoricalBytes, ownedJvmTransferPath
	, ownedJvmTransferPrevious, reverseOwnedJvmTransferUpdate } from "./helpers/owned-jvm-transfer-history.mjs";

const read = async () => JSON.parse(await readFile(ownedJvmTransferPath, "utf8"));

test("Java/Kotlin transfers bind current sources without promoting unrelated type cells", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-jvm-transfers");
	assert.equal(record.planNode, 1219); assert.equal(record.baselineRevision, ownedJvmTransferBaseline);
	assert.deepEqual(record.previous, ownedJvmTransferPrevious);
	const bytes = await readFile(record.previous.path), previous = JSON.parse(bytes);
	assert.equal(sha256(bytes), record.previous.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), [...new Set([...Object.keys(previous.sources), ...ownedJvmTransferAddedPaths])].sort());
	for(const [path, digest] of Object.entries(record.sources)) assert.equal(sha256(ownedPerlTransferHistoricalBytes(path, await readFile(path), digest)), digest, path);
	assert.deepEqual(record.updates.map(update => update.path), ownedJvmTransferChangedPaths);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, previous.sources[update.path]);
		assert.equal(update.currentSha256, record.sources[update.path]);
		const current = beforeOwnedPerlTransfer(update.path, await readFile(update.path, "utf8")), prior = beforeOwnedJvmTransfer(update.path, current);
		assert.equal(sha256(prior), update.previousSha256);
		assert.equal(beforeOwnedJvmTransfer(update.path, prior), prior);
		assert.equal(beforeOwnedJvmTransfer(update.path, current, update.currentSha256), current);
	}
	const current = beforeOwnedPerlTransfer("docs/type-surface.v1.json", await readFile("docs/type-surface.v1.json", "utf8"));
	const previousIndex = JSON.parse(beforeOwnedJvmTransfer("docs/type-surface.v1.json", current));
	for(const evidence of previousIndex.evidence) for(const file of evidence.files) file.sha256 = sha256(ownedPerlTransferHistoricalBytes(file.path, await readFile(file.path)));
	assert.deepEqual(JSON.parse(current), previousIndex);
});

test("Java/Kotlin transfer history rejects unrelated edits and invalid reversal spans", async () => {
	for(const update of (await read()).updates)
	{
		const source = beforeOwnedPerlTransfer(update.path, await readFile(update.path, "utf8")), unknown = source + "\n/* unrelated */\n";
		assert.equal(beforeOwnedJvmTransfer(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedJvmTransferUpdate(unknown, update));
		for(const changed of [{ ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }
			, { ...update, edits: [...update.edits, update.edits[0]] }])
			assert.throws(() => reverseOwnedJvmTransferUpdate(source, changed));
	}
	const binary = Buffer.from([0, 255, 128, 192]);
	assert.equal(ownedJvmTransferHistoricalBytes("unrelated.bin", binary), binary);
});

test("Java/Kotlin transfer receipts require both compiler paths, installed Maven and enabled CI", async () => {
	await assertOwnedJvmTransferExecution(await read());
	assertOwnedJvmTransferCi(await readFile(".github/workflows/consumer-matrix.yml", "utf8"));
});

test("Java/Kotlin transfer evidence rejects forged handoffs, installation and wider support", async () => {
	const original = await read();
	for(const mutate of [
		...["otherConsumerBindings", "anchoredBorrowedResults", "docker"].map(key => record => { record.scope[key] = true; })
		, record => { record.run.exitCode = 1; }
		, record => { record.run.command += " --import forged.mjs"; }
		, record => { record.run.text = record.run.text.replace("# pass 7", "# pass 6"); record.run.sha256 = sha256(record.run.text); }
		, record => { record.runtime[0].actualLean = false; }
		, record => { record.runtime[1].observed.javaFaults[6] = 0; }
		, record => { record.runtime[0].observed.kotlinFaults[7] = 0; }
		, record => { record.runtime[1].observed.identities = 1; }
		, record => { record.runtime[0].observed.threadExits = 0; }
		, record => { record.runtime[1].guardSha256 = "0".repeat(64); }
		, record => { record.runtime[0].javaProbeSha256 = "0".repeat(64); }
		, record => { record.runtime[1].instrumentedRuntimeSha256 = "0".repeat(64); }
		, record => { record.consumers[0].sourceRemovedBeforeInstallation = false; }
		, record => { record.consumers[1].observations[1].checks = 0; }
		, record => { record.consumers[0].observations[0].jvm.installedSourcesRemoved = false; }
		, record => { record.consumers[1].observations[1].jvm.compilerFreeExecution = false; }
		, record => { record.consumers[0].observations[1].jvm.handoffRemovedBeforeExecution = false; }
		, record => { record.consumers[1].observations[0].jvm.repeatExecution = false; }
		, record => { record.consumers[0].observations[1].jvm.documentation[0].sourceSha256 = "0".repeat(64); }
		, record => { record.consumers[1].observations[0].jvm.inspection.scenarios.pop(); }
		, record => { record.consumers[0].observations[0].jvm.inspection.scenarios[0].rejected = false; }
		, record => { record.consumers[1].observations[1].observation.results.pop(); }
		, record => { record.consumers[0].adapterReceipt.jvmValues.inputTransfers.aliases = "independent"; }
		, record => { record.consumers[1].componentReceipt.inputTransfers.consumption = "after-lean-call"; }
		, record => { record.consumers[0].manifest.ownedValues.inputTransfers.independentRetains = "consumed"; }
		, record => { record.consumers[1].manifest.schemaVersion = 1; }
		, record => { record.consumers[0].compiledProjection.schemaVersion = 1; }
		, record => { record.consumers[1].compiledProjection.kotlin.options.pop(); }
		, record => { record.consumers[0].adapterReceipt.gmp.binding = "global-symbols"; }
		, record => { record.consumers[1].tamperRejections.pop(); }
		, record => { record.consumers[0].runtimeReceipt.pointerBits = 32; }
	]) {
		const changed = structuredClone(original); mutate(changed);
		await assert.rejects(() => assertOwnedJvmTransferExecution(changed), mutate.toString());
	}
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	for(const text of ["          npm run test:owned-jvm-transfers\n"
		, "            build/owned-jvm-transfer-packaging/\n"
		, "          test -s build/owned-jvm-transfers/reviewed.json\n"])
		assert.throws(() => assertOwnedJvmTransferCi(workflow.replace(text, "")));
});
