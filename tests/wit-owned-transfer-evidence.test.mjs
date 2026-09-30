/**
 * Source-bound WIT transfer acceptance, immutable predecessors and required CI.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertOwnedWitTransferCi, ownedWitTransferScript } from "./helpers/wit-owned-transfer-ci.mjs";
import { assertOwnedWitTransferExecution } from "./helpers/wit-owned-transfer-evidence.mjs";
import { beforeOwnedWitTransfer, ownedWitTransferAddedPaths, ownedWitTransferBaseline
	, ownedWitTransferChangedPaths, ownedWitTransferPath, ownedWitTransferPrevious
	, reverseOwnedWitTransferUpdate } from "./helpers/wit-owned-transfer-history.mjs";

const read = async () => JSON.parse(await readFile(ownedWitTransferPath, "utf8"));

test("WIT transfers preserve predecessor receipts without promoting unrelated support cells", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "wit-owned-transfers");
	assert.equal(record.planNode, 1219); assert.equal(record.baselineRevision, ownedWitTransferBaseline);
	assert.deepEqual(record.previous, ownedWitTransferPrevious);
	const bytes = await readFile(record.previous.path), previous = JSON.parse(bytes);
	assert.equal(sha256(bytes), record.previous.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), [...Object.keys(previous.sources), ...ownedWitTransferAddedPaths].sort());
	for(const [path, hash] of Object.entries(record.sources)) assert.equal(sha256(await readFile(path)), hash, path);
	assert.deepEqual(record.updates.map(update => update.path), ownedWitTransferChangedPaths);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, previous.sources[update.path]);
		assert.equal(update.currentSha256, record.sources[update.path]);
		const source = await readFile(update.path, "utf8"), prior = beforeOwnedWitTransfer(update.path, source);
		assert.equal(sha256(prior), update.previousSha256);
		assert.equal(beforeOwnedWitTransfer(update.path, prior), prior);
		assert.equal(beforeOwnedWitTransfer(update.path, source, update.currentSha256), source);
	}
	const current = await readFile("docs/type-surface.v1.json", "utf8");
	const prior = JSON.parse(beforeOwnedWitTransfer("docs/type-surface.v1.json", current));
	for(const evidence of prior.evidence) for(const file of evidence.files) file.sha256 = sha256(await readFile(file.path));
	assert.deepEqual(JSON.parse(current), prior);
});

test("WIT transfer history rejects unknown edits and forged history", async () => {
	for(const update of (await read()).updates)
	{
		const source = await readFile(update.path, "utf8"), unknown = source + "\n/* unrelated */\n";
		assert.equal(beforeOwnedWitTransfer(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedWitTransferUpdate(unknown, update));
		for(const changed of [{ ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }
			, { ...update, edits: [...update.edits, update.edits[0]] }])
			assert.throws(() => reverseOwnedWitTransferUpdate(source, changed));
	}
});

test("WIT transfer evidence requires compiled handoff and relocated installed consumers", async () => {
	await assertOwnedWitTransferExecution(await read());
});

test("WIT transfer evidence rejects missing tests and fabricated ownership claims", async () => {
	const original = await read();
	for(const mutate of [
		...["anchoredBorrowedResults", "independentRebuild", "callerOwnedStores", "standaloneWasi", "docker"]
			.map(key => record => { record.scope[key] = true; })
		, record => { record.scope.installedSupportPromotions = 1; }
		, record => { record.run.exitCode = 1; }
		, record => { record.run.text += "unknown"; }
		, record => { record.run.text = record.run.text.replace("# skipped 0", "# skipped 1"); record.run.sha256 = sha256(record.run.text); }
		, record => { record.runtime.pop(); }
		, record => { record.runtime[0].report.beforeFailures = 0; }
		, record => { record.runtime[1].report.afterFailures = 0; }
		, record => { record.runtime[1].report.live++; }
		, record => { record.runtime[1].report.identities++; }
		, record => { record.runtime[1].counts.exports--; }
		, record => { record.runtime[0].componentBase64 += "AA=="; }
		, record => { record.runtime[0].sourceSha256 = "0".repeat(64); }
		, record => { record.runtime[0].missingTransferFramePreservesOwner = false; }
		, record => { record.runtime[1].malformedResultConsumesInputs = false; }
		, record => { record.runtime[0].rejectedMutations.pop(); }
		, record => { record.packages[0].sourceRemovedBeforeInstall = false; }
		, record => { record.packages[1].targets = ["wit-wasi"]; }
		, record => { record.packages[0].receipt.ownedValues.inputTransfers.exports.pop(); }
		, record => { record.packages[1].installed.checks--; }
		, record => { record.packages[1].installed.compilerFreePath = false; }
		, record => { record.packages[1].rejected = 0; }
		, record => { record.packages[0].documentation.stdout = "0\n"; }
		, record => { record.packages[1].loader.reports.pop(); }
		, record => { record.packages[1].loader.reports[2].conflict = false; }
		, record => { record.packages[0].manifest.files["lib/libwasmtime.so"].sha256 = "0".repeat(64); }
	]) {
		const changed = structuredClone(original); mutate(changed);
		await assert.rejects(() => assertOwnedWitTransferExecution(changed), undefined, mutate.toString());
	}
});

test("WIT transfer CI runs both enabled paths and retains their reports", async () => {
	assertOwnedWitTransferCi(await readFile(".github/workflows/consumer-matrix.yml", "utf8"), JSON.parse(await readFile("package.json", "utf8")));
});

test("WIT transfer CI rejects disabled checks and hidden failures", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const manifest = JSON.parse(await readFile("package.json", "utf8"));
	const execute = "      - name: Verify consuming WIT input ownership\n";
	for(const [before, after] of [
		[execute, execute + "        if: false\n"]
		, [execute, execute + "        continue-on-error: true\n"]
		, ["tee build/wit-owned-transfers.log\n", "tee build/wit-owned-transfers.log || true\n"]
		, ...["pass 5", "fail 0", "skipped 0"].map(value => [`          rg '^# ${value}$' build/wit-owned-transfers.log\n`, ""])
		, ["          test -s build/owned-wit-transfers/reviewed-package.json\n", ""]
		, ["            build/owned-wit-transfers/ordinary.json\n", ""]
		, ["      - name: Preserve consuming WIT execution\n        if: always()", "      - name: Preserve consuming WIT execution\n        if: false"]
		, ["steps.owned_wit_transfers.outcome == 'success'", "true"]
		, ["steps.owned_wit_transfers.outcome != 'success'", "false"]
	]) {
		const changed = workflow.replace(before, after); assert.notEqual(changed, workflow);
		assert.throws(() => assertOwnedWitTransferCi(changed, manifest), before);
	}
	for(const script of [ownedWitTransferScript.replace("=1", "=0"), ownedWitTransferScript.replace(" tests/wit-owned-transfer-packaging.test.mjs", "")])
		assert.throws(() => assertOwnedWitTransferCi(workflow, { ...manifest, scripts: { ...manifest.scripts, "test:owned-wit-transfers": script } }));
});
