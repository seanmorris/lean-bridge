/**
 * Authenticate CI repairs without rewriting frozen installed acceptance receipts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { beforeOwnedPythonTransfer, ownedPythonTransferHistoricalBytes } from "./helpers/owned-python-transfer-history.mjs";
import { assertOwnedConsumerCiExecution, assertOwnedWitLogTooling } from "./helpers/owned-consumer-ci-repair-evidence.mjs";
import { beforeOwnedConsumerCi, ownedConsumerCiAddedPaths, ownedConsumerCiBaseline
	, ownedConsumerCiChangedPaths, ownedConsumerCiHistoricalBytes, ownedConsumerCiPath
	, ownedConsumerCiPrevious, reverseOwnedConsumerCiUpdate } from "./helpers/owned-consumer-ci-repair-history.mjs";

const read = async () => JSON.parse(await readFile(ownedConsumerCiPath, "utf8"));

test("WIT log checks declare ripgrep before execution", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	assertOwnedWitLogTooling(workflow);
	const marker = "\n  wasi-consumer:\n", [otherJobs, witJob] = workflow.split(marker);
	assert.equal(typeof witJob, "string");
	const missing = witJob.replace("pkg-config zstd ripgrep", "pkg-config zstd");
	assert.notEqual(missing, witJob);
	assert.throws(() => assertOwnedWitLogTooling(otherJobs + marker + missing));
	assertOwnedWitLogTooling(otherJobs.replaceAll("ripgrep", "unavailable") + marker + witJob);
});

test("owned consumer CI repair authenticates current sources without promoting support", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-consumer-ci-repair");
	assert.equal(record.planNode, 1219); assert.equal(record.baselineRevision, ownedConsumerCiBaseline);
	assert.deepEqual(record.previous, ownedConsumerCiPrevious);
	const bytes = await readFile(record.previous.path), previous = JSON.parse(bytes);
	assert.equal(sha256(bytes), record.previous.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), [...new Set([...Object.keys(previous.sources), ...ownedConsumerCiAddedPaths])].sort());
	for(const [path, digest] of Object.entries(record.sources)) assert.equal(sha256(ownedPythonTransferHistoricalBytes(path, await readFile(path), digest)), digest, path);
	assert.deepEqual(record.updates.map(update => update.path), ownedConsumerCiChangedPaths);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, previous.sources[update.path]);
		assert.equal(update.currentSha256, record.sources[update.path]);
		const current = beforeOwnedPythonTransfer(update.path, await readFile(update.path, "utf8")), prior = beforeOwnedConsumerCi(update.path, current);
		assert.equal(sha256(prior), update.previousSha256);
		assert.equal(beforeOwnedConsumerCi(update.path, prior), prior);
		assert.equal(beforeOwnedConsumerCi(update.path, current, update.currentSha256), current);
	}
	const current = beforeOwnedPythonTransfer("docs/type-surface.v1.json", await readFile("docs/type-surface.v1.json", "utf8"));
	const previousIndex = JSON.parse(beforeOwnedConsumerCi("docs/type-surface.v1.json", current));
	for(const evidence of previousIndex.evidence) for(const file of evidence.files) file.sha256 = sha256(ownedPythonTransferHistoricalBytes(file.path, await readFile(file.path)));
	assert.deepEqual(JSON.parse(current), previousIndex);
});

test("owned consumer CI history rejects unrelated edits and invalid reversal spans", async () => {
	for(const update of (await read()).updates)
	{
		const source = beforeOwnedPythonTransfer(update.path, await readFile(update.path, "utf8")), unknown = source + "\n/* unrelated */\n";
		assert.equal(beforeOwnedConsumerCi(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedConsumerCiUpdate(unknown, update));
		for(const changed of [{ ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }
			, { ...update, edits: [...update.edits, update.edits[0]] }])
			assert.throws(() => reverseOwnedConsumerCiUpdate(source, changed));
	}
	const binary = Buffer.from([0, 255, 128, 192]);
	assert.equal(ownedConsumerCiHistoricalBytes("unrelated.bin", binary), binary);
});

test("owned consumer CI receipt binds reproduced failures and the actual Nix source", async () => {
	await assertOwnedConsumerCiExecution(await read());
});

test("owned consumer CI evidence rejects fabricated build and release claims", async () => {
	const original = await read();
	for(const mutate of [
		...["nixBuild", "installedPackage", "newTypeSupport"].map(key => record => { record.scope[key] = true; })
		, record => { record.runs.before.exitCode = 0; }
		, record => { record.runs.after.command += " --import forged.mjs"; }
		, record => { record.runs.witAfter.text = record.runs.witAfter.text.replace("# pass 1", "# pass 0"); record.runs.witAfter.sha256 = sha256(record.runs.witAfter.text); }
		, record => { record.nixSource.allFilesMatch = false; }
		, record => { record.nixSource.modules--; }
		, record => { delete record.nixSource.files["src/backends/native/owned-value-transfers.mjs"]; }
	]) {
		const changed = structuredClone(original); mutate(changed);
		await assert.rejects(() => assertOwnedConsumerCiExecution(changed));
	}
});
