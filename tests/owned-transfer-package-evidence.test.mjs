/**
 * Keep installed C transfers source-bound and older observations immutable.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertOwnedTransferPackageExecution, assertOwnedTransferPackageCi } from "./helpers/owned-transfer-package-evidence.mjs";
import { beforeOwnedTransferPackage, ownedTransferPackageAddedPaths, ownedTransferPackageBaseline
	, ownedTransferPackageChangedPaths, ownedTransferPackageHistoricalBytes, ownedTransferPackagePath
	, ownedTransferPackagePrevious, reverseOwnedTransferPackageUpdate } from "./helpers/owned-transfer-package-history.mjs";

const read = async () => JSON.parse(await readFile(ownedTransferPackagePath, "utf8"));

test("installed C transfer evidence authenticates sources and preserves prior observations", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-transfer-packages");
	assert.equal(record.planNode, 1219); assert.equal(record.baselineRevision, ownedTransferPackageBaseline);
	assert.deepEqual(record.previous, ownedTransferPackagePrevious);
	const bytes = await readFile(record.previous.path), previous = JSON.parse(bytes);
	assert.equal(sha256(bytes), record.previous.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), [...new Set([...Object.keys(previous.sources), ...ownedTransferPackageAddedPaths])].sort());
	for(const [path, digest] of Object.entries(record.sources)) assert.equal(sha256(await readFile(path)), digest, path);
	assert.deepEqual(record.updates.map(update => update.path), ownedTransferPackageChangedPaths);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, previous.sources[update.path], update.path);
		assert.equal(update.currentSha256, record.sources[update.path], update.path);
		const current = await readFile(update.path, "utf8"), prior = beforeOwnedTransferPackage(update.path, current);
		assert.equal(sha256(prior), update.previousSha256);
		assert.equal(beforeOwnedTransferPackage(update.path, prior), prior);
		assert.equal(beforeOwnedTransferPackage(update.path, current, update.currentSha256), current);
	}
	const current = await readFile("docs/type-surface.v1.json", "utf8");
	const prior = JSON.parse(beforeOwnedTransferPackage("docs/type-surface.v1.json", current));
	for(const evidence of prior.evidence) for(const file of evidence.files) file.sha256 = sha256(await readFile(file.path));
	assert.deepEqual(JSON.parse(current), prior, "C transfer acceptance does not promote unrelated type-table cells");
});

test("installed C transfer history rejects unknown edits and forged ancestors", async () => {
	for(const update of (await read()).updates)
	{
		const source = await readFile(update.path, "utf8"), unknown = source + "\n/* unrelated */\n";
		assert.equal(beforeOwnedTransferPackage(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedTransferPackageUpdate(unknown, update));
		for(const changed of [{ ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unrecorded.mjs" }
			, { ...update, edits: [...update.edits, update.edits[0]] }])
			assert.throws(() => reverseOwnedTransferPackageUpdate(source, changed));
	}
	const binary = Buffer.from([0, 255, 192, 128]);
	assert.equal(ownedTransferPackageHistoricalBytes("unknown.bin", binary), binary);
});

test("installed C transfers require both source paths, public consumers and enabled CI", async () => {
	await assertOwnedTransferPackageExecution(await read());
	assertOwnedTransferPackageCi(await readFile(".github/workflows/consumer-matrix.yml", "utf8"));
});

test("installed transfer receipts reject forged execution, move rules and unsupported claims", async () => {
	const original = await read();
	for(const mutate of [
		...["otherConsumerBindings", "anchoredBorrowedResults", "docker"].map(key => record => { record.scope[key] = true; })
		, record => { record.run.exitCode = 1; }
		, record => { record.run.command += " --import forged.mjs"; }
		, record => { record.run.text = record.run.text.replace("# pass 5", "# pass 4"); record.run.sha256 = sha256(record.run.text); }
		, record => { record.analyses[0].adaptersCompiled = true; }
		, record => { record.analyses[1].transfers = 0; }
		, record => { record.consumers[0].sourceFreeInstallation = false; }
		, record => { record.consumers[1].checks.cmake = 0; }
		, record => { record.consumers[0].model.ownedGraph.inputTransfers.exports.pop(); }
		, record => { record.consumers[0].componentReceipt.inputTransfers.consumption = "after-lean-call"; }
		, record => { record.consumers[1].adapterReceipt.ownedValues.inputTransfers = null; }
		, record => { record.consumers[1].manifest.ownedValues.schemaVersion = 2; }
	]) {
		const changed = structuredClone(original); mutate(changed);
		await assert.rejects(() => assertOwnedTransferPackageExecution(changed), mutate.toString());
	}
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	for(const text of ["          npm run test:owned-transfer-packages\n"
		, "            build/owned-transfer-packaging/\n"
		, "          test -s build/owned-transfer-packaging/reviewed.json\n"])
		assert.throws(() => assertOwnedTransferPackageCi(workflow.replace(text, "")));
});
