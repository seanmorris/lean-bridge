/**
 * Reject partial WIT receiver acceptance and preserve exact source history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { classifyRepositoryTest } from "../src/adoption/test-profiles.mjs";
import { assertOwnedWitReceiverExecution } from "./helpers/wit-owned-receiver-evidence.mjs";
import { beforeOwnedJvmReceiverGc, ownedJvmReceiverGcHistoricalBytes } from "./helpers/owned-jvm-receiver-gc-history.mjs";
import { ownedWitReceiverPath, ownedWitReceiverBaseline, ownedWitReceiverPrevious
	, ownedWitReceiverChangedPaths, ownedWitReceiverAddedPaths
	, beforeOwnedWitReceiver, reverseOwnedWitReceiverUpdate } from "./helpers/wit-owned-receiver-history.mjs";

const read = async () => JSON.parse(await readFile(ownedWitReceiverPath, "utf8"));

test("WIT receiver history authenticates sources without inflating support", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "wit-owned-receivers");
	assert.equal(record.planNode, 1219); assert.equal(record.baselineRevision, ownedWitReceiverBaseline);
	assert.deepEqual(record.previous, ownedWitReceiverPrevious);
	const bytes = await readFile(record.previous.path), previous = JSON.parse(bytes);
	assert.equal(sha256(bytes), record.previous.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), [...Object.keys(previous.sources), ...ownedWitReceiverAddedPaths].sort());
	for(const [path, digest] of Object.entries(record.sources)) assert.equal(sha256(ownedJvmReceiverGcHistoricalBytes(path, await readFile(path), digest)), digest, path);
	assert.deepEqual(record.updates.map(update => update.path), ownedWitReceiverChangedPaths);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, previous.sources[update.path]);
		assert.equal(update.currentSha256, record.sources[update.path]);
		const source = beforeOwnedJvmReceiverGc(update.path, await readFile(update.path, "utf8"), update.currentSha256);
		const prior = beforeOwnedWitReceiver(update.path, source);
		assert.equal(sha256(prior), update.previousSha256);
		assert.equal(beforeOwnedWitReceiver(update.path, prior), prior);
		assert.equal(beforeOwnedWitReceiver(update.path, source, update.currentSha256), source);
		const unknown = source + "\n/* unrecorded edit */\n";
		assert.equal(beforeOwnedWitReceiver(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedWitReceiverUpdate(unknown, update));
		for(const changed of [{ ...update, previousSha256: "0".repeat(64) }
			, { ...update, edits: [...update.edits, update.edits[0]] }
			, { ...update, path: "unknown.mjs" }])
			assert.throws(() => reverseOwnedWitReceiverUpdate(source, changed));
	}
	const path = "docs/type-surface.v1.json", current = beforeOwnedJvmReceiverGc(path, await readFile(path, "utf8"), record.sources[path]);
	const prior = JSON.parse(beforeOwnedWitReceiver(path, current));
	for(const evidence of prior.evidence) for(const file of evidence.files) file.sha256 = sha256(ownedJvmReceiverGcHistoricalBytes(file.path, await readFile(file.path), record.sources[file.path]));
	assert.deepEqual(JSON.parse(current), prior);
	for(const name of ["model", "resource", "packaging", "resource-packaging", "ci", "evidence"])
		assert.equal(classifyRepositoryTest(`tests/wit-owned-receiver-${name}.test.mjs`), "contract");
	assert.equal(classifyRepositoryTest("tests/wit-owned-receivers.test.mjs"), "contract");
});

test("WIT receiver evidence reconstructs compiled and installed configurations", async () => {
	await assertOwnedWitReceiverExecution(await read());
});

test("WIT receiver evidence rejects missing execution and overstated guarantees", async () => {
	const record = await read();
	await assertOwnedWitReceiverExecution(record);
	for(const mutate of [
		value => { value.acceptance = "pending"; }
		, value => { value.scope.callbackResultAnchors = true; }
		, value => { value.scope.callerOwnedStores = true; }
		, value => { value.scope.standaloneWasi = true; }
		, value => { value.scope.docker = true; }
		, value => { value.scope.installedSupportPromotions = 1; }
		, value => { value.run.exitCode = 1; }
		, value => { value.run.text += "unrecorded"; }
		, value => { value.run.text = value.run.text.replace("# skipped 0", "# skipped 1"); value.run.sha256 = sha256(value.run.text); }
		, value => { value.runtime.pop(); }
		, value => { value.runtime[0].input.receiverExports = false; }
		, value => { value.runtime[0].native.ownedGraph.receiverExports.exports.pop(); }
		, value => { value.runtime[0].manifest.graph.receiverExports.pop(); }
		, value => { value.runtime[1].manifest.graph.resultAnchors[0].parameter++; }
		, value => { value.runtime[0].sourceSha256 = "0".repeat(64); }
		, value => { value.runtime[1].counts.exports--; }
		, value => { value.runtime[1].counts.nativeImports--; }
		, value => { value.runtime[1].result.afterFailures = 0; }
		, value => { value.runtime[0].result.identities++; }
		, value => { value.runtime[0].mutations.pop(); }
		, value => { value.runtime[1].mutations[9].compiled = false; }
		, value => { value.resources.pop(); }
		, value => { value.resources[0].input.hostCallbacks = true; }
		, value => { value.resources[1].input.transferredInputs = false; }
		, value => { value.resources[2].input.anchoredResults = true; }
		, value => { value.resources[3].result.live++; }
		, value => { value.packages.pop(); }
		, value => { value.packages[0].sourceRemovedBeforeInstall = false; }
		, value => { value.packages[0].cliRemovedBeforeConsumerInstall = false; }
		, value => { value.packages[1].installedCli.filesVerified--; }
		, value => { value.packages[1].installedCli.offlineInstall = false; }
		, value => { value.packages[1].installedCli.report.files[0].sha256 = "0".repeat(64); }
		, value => { value.packages[1].cliBuilds.pop(); }
		, value => { value.packages[1].cliVerification.status = "failed"; }
		, value => { value.packages[1].independentRebuild = false; }
		, value => { value.packages[1].documentation.stdout = "42\n"; }
		, value => { value.packages[0].model.ownedGraph.receiverExports.exports.pop(); }
		, value => { value.packages[0].receipt.ownedValues.receiverExports.exports.pop(); }
		, value => { value.packages[0].rejected = 0; }
		, value => { value.packages[0].loader.reports.pop(); }
		, value => { value.packages[0].installed.consumerSha256 = "0".repeat(64); }
		, value => { value.resourcePackages.pop(); }
		, value => { value.resourcePackages[0].inputs.hostCallbacks = false; }
		, value => { value.resourcePackages[1].inputs.transferredInputs = false; }
		, value => { value.resourcePackages[2].inputs.anchoredResults = true; }
		, value => { value.resourcePackages[3].relocated = false; }
		, value => { value.resourcePackages[4].installed.checks--; }
		, value => { value.resourcePackages[5].probeSha256 = "0".repeat(64); }
	]) {
		const changed = structuredClone(record); mutate(changed);
		await assert.rejects(() => assertOwnedWitReceiverExecution(changed), undefined, mutate.toString());
	}
});
