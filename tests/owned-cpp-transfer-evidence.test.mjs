/**
 * Reject forged C++ move evidence and preserve every earlier installed receipt.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { ownedRustTransferHistoricalBytes } from "./helpers/owned-rust-transfer-history.mjs";
import { assertOwnedCppTransferExecution, assertOwnedCppTransferCi } from "./helpers/owned-cpp-transfer-evidence.mjs";
import { beforeOwnedCppTransfer, ownedCppTransferAddedPaths, ownedCppTransferBaseline
	, ownedCppTransferChangedPaths, ownedCppTransferHistoricalBytes, ownedCppTransferPath
	, ownedCppTransferPrevious, reverseOwnedCppTransferUpdate } from "./helpers/owned-cpp-transfer-history.mjs";

const read = async () => JSON.parse(await readFile(ownedCppTransferPath, "utf8"));
const historical = async path => ownedRustTransferHistoricalBytes(path, await readFile(path));

test("C++ transfer acceptance authenticates all sources without changing earlier claims", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-cpp-transfers");
	assert.equal(record.planNode, 1219); assert.equal(record.baselineRevision, ownedCppTransferBaseline);
	assert.deepEqual(record.previous, ownedCppTransferPrevious);
	const previousBytes = await readFile(record.previous.path), previous = JSON.parse(previousBytes);
	assert.equal(sha256(previousBytes), record.previous.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), [...new Set([...Object.keys(previous.sources), ...ownedCppTransferAddedPaths])].sort());
	for(const [path, digest] of Object.entries(record.sources)) assert.equal(sha256(await historical(path)), digest, path);
	assert.deepEqual(record.updates.map(update => update.path), ownedCppTransferChangedPaths);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, previous.sources[update.path], update.path);
		assert.equal(update.currentSha256, record.sources[update.path], update.path);
		const current = (await historical(update.path)).toString(), prior = beforeOwnedCppTransfer(update.path, current);
		assert.equal(sha256(prior), update.previousSha256);
		assert.equal(beforeOwnedCppTransfer(update.path, prior), prior);
		assert.equal(beforeOwnedCppTransfer(update.path, current, update.currentSha256), current);
	}
	const current = (await historical("docs/type-surface.v1.json")).toString();
	const previousIndex = JSON.parse(beforeOwnedCppTransfer("docs/type-surface.v1.json", current));
	for(const evidence of previousIndex.evidence) for(const file of evidence.files) file.sha256 = sha256(await historical(file.path));
	assert.deepEqual(JSON.parse(current), previousIndex, "C++ transfers do not promote unrelated type-table cells");
});

test("C++ transfer history rejects unknown changes and invalid reversal spans", async () => {
	for(const update of (await read()).updates)
	{
		const source = (await historical(update.path)).toString(), unknown = source + "\n/* unrelated change */\n";
		assert.equal(beforeOwnedCppTransfer(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedCppTransferUpdate(unknown, update));
		for(const changed of [{ ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }
			, { ...update, edits: [...update.edits, update.edits[0]] }])
			assert.throws(() => reverseOwnedCppTransferUpdate(source, changed));
	}
	const binary = Buffer.from([0, 255, 128, 192]);
	assert.equal(ownedCppTransferHistoricalBytes("unrelated.bin", binary), binary);
});

test("C++ transfer receipts require real compiler paths, installed consumers and enabled CI", async () => {
	await assertOwnedCppTransferExecution(await read());
	assertOwnedCppTransferCi(await readFile(".github/workflows/consumer-matrix.yml", "utf8"));
});

test("C++ transfer evidence rejects forged execution, aliases, failures and wider support", async () => {
	const original = await read();
	for(const mutate of [
		...["otherConsumerBindings", "anchoredBorrowedResults", "docker"].map(key => record => { record.scope[key] = true; })
		, record => { record.run.exitCode = 1; }
		, record => { record.run.command += " --import forged.mjs"; }
		, record => { record.run.text = record.run.text.replace("# pass 5", "# pass 4"); record.run.sha256 = sha256(record.run.text); }
		, record => { record.runtime[0].actualLean = false; }
		, record => { record.runtime[1].result.multiNativeBefore = 0; }
		, record => { record.runtime[0].sanitizer.identities = 1; }
		, record => { record.runtime[1].contract.inputTransfers.aliases = "independent"; }
		, record => { record.consumers[0].sourceFreeInstallation = false; }
		, record => { record.consumers[1].checks.sanitized = 0; }
		, record => { record.consumers[0].documentation.stdout = "forged"; }
		, record => { record.consumers[1].model.ownedGraph.inputTransfers.exports.pop(); }
		, record => { record.consumers[0].componentReceipt.inputTransfers.consumption = "after-lean-call"; }
		, record => { record.consumers[1].adapterReceipt.cppValues.inputTransfers.independentRetains = "consumed"; }
		, record => { record.consumers[0].manifest.ownedValues.schemaVersion = 2; }
	]) {
		const changed = structuredClone(original); mutate(changed);
		await assert.rejects(() => assertOwnedCppTransferExecution(changed), mutate.toString());
	}
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	for(const text of ["          npm run test:owned-cpp-transfers\n"
		, "            build/owned-cpp-transfer-packaging/\n"
		, "          test -s build/owned-cpp-transfers/reviewed.json\n"])
		assert.throws(() => assertOwnedCppTransferCi(workflow.replace(text, "")));
});
