/**
 * Keep staged transfer observations bound to source without promoting packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { ownedTransferPackageHistoricalBytes } from "./helpers/owned-transfer-package-history.mjs";
import { assertOwnedTransferCExecution, assertOwnedTransferCCi } from "./helpers/owned-transfer-c-evidence.mjs";
import { beforeOwnedTransferC, ownedTransferCAddedPaths, ownedTransferCBaseline
	, ownedTransferCChangedPaths, ownedTransferCHistoricalBytes, ownedTransferCPath
	, ownedTransferCPrevious, ownedTransferCRegisteredSources, reverseOwnedTransferCUpdate } from "./helpers/owned-transfer-c-history.mjs";

const read = async () => JSON.parse(await readFile(ownedTransferCPath, "utf8"));
const historical = async path => ownedTransferPackageHistoricalBytes(path, await readFile(path));
const historicalText = async path => (await historical(path)).toString("utf8");

test("staged C transfers authenticate every source and preserve installed support", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-transfer-c");
	assert.equal(record.planNode, 1219); assert.equal(record.baselineRevision, ownedTransferCBaseline);
	assert.deepEqual(record.previous, ownedTransferCPrevious);
	assert.deepEqual(record.registeredSources, ownedTransferCRegisteredSources);
	const bytes = await readFile(record.previous.path), previous = JSON.parse(bytes);
	assert.equal(sha256(bytes), record.previous.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), [...new Set([...Object.keys(previous.sources)
		, ...Object.keys(ownedTransferCRegisteredSources)
		, ...ownedTransferCAddedPaths])].sort());
	for(const [path, digest] of Object.entries(record.sources)) assert.equal(sha256(await historical(path)), digest, path);
	assert.deepEqual(record.updates.map(update => update.path), ownedTransferCChangedPaths);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, previous.sources[update.path] ?? ownedTransferCRegisteredSources[update.path], update.path);
		assert.equal(update.currentSha256, record.sources[update.path], update.path);
		const current = await historicalText(update.path), prior = beforeOwnedTransferC(update.path, current);
		assert.equal(sha256(prior), update.previousSha256);
		assert.equal(beforeOwnedTransferC(update.path, prior), prior);
		assert.equal(beforeOwnedTransferC(update.path, current, update.currentSha256), current);
	}
	const current = await historicalText("docs/type-surface.v1.json");
	const prior = JSON.parse(beforeOwnedTransferC("docs/type-surface.v1.json", current));
	for(const evidence of prior.evidence) for(const file of evidence.files) file.sha256 = sha256(await historical(file.path));
	assert.deepEqual(JSON.parse(current), prior, "Staged C transfer execution does not promote installed support");
});

test("staged C transfer history rejects unknown edits and forged ancestors", async () => {
	for(const update of (await read()).updates)
	{
		const source = await historicalText(update.path), unknown = source + "\n/* unrelated */\n";
		assert.equal(beforeOwnedTransferC(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedTransferCUpdate(unknown, update));
		for(const changed of [{ ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unrecorded.mjs" }
			, { ...update, edits: [...update.edits, update.edits[0]] }])
			assert.throws(() => reverseOwnedTransferCUpdate(source, changed));
	}
	const binary = Buffer.from([0, 255, 192, 128]);
	assert.equal(ownedTransferCHistoricalBytes("unknown.bin", binary), binary);
});

test("staged transfers require real ordinary/reviewed Lean execution and enabled CI", async () => {
	await assertOwnedTransferCExecution(await read());
	assertOwnedTransferCCi(await readFile(".github/workflows/consumer-matrix.yml", "utf8"));
});

test("transfer evidence rejects removed checks, changed inputs and unsupported package claims", async () => {
	const original = await read();
	for(const mutate of [
		...["installedPackage", "otherConsumerBindings", "anchoredBorrowedResults"].map(key => record => { record.scope[key] = true; })
		, record => { record.scope.installedSupportPromotions = 1; }
		, record => { record.run.exitCode = 1; }
		, record => { record.run.command += " --import forged.mjs"; }
		, record => { record.run.text = record.run.text.replace("# pass 7", "# pass 6"); record.run.sha256 = sha256(record.run.text); }
		, record => { record.native.ownerMembership = false; }
		, record => { record.native.rejectedMutations.pop(); }
		, record => { record.consumers[0].input.sourceIdentity.sourceTreeSha256 = "0".repeat(64); }
		, record => { record.consumers[0].report.result.beforeFailures = 0; }
		, record => { record.consumers[1].report.result.afterFailures = 0; }
		, record => { record.consumers[0].report.sourceSha256 = "0".repeat(64); }
	]) {
		const changed = structuredClone(original); mutate(changed);
		await assert.rejects(() => assertOwnedTransferCExecution(changed), mutate.toString());
	}
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	for(const text of ["          npm run test:owned-transfers\n"
		, "            build/owned-transfers/\n"
		, "          test -s build/owned-transfers/reviewed-c.json\n"])
		assert.throws(() => assertOwnedTransferCCi(workflow.replace(text, "")));
});
