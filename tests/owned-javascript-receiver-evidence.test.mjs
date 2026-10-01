/**
 * Reject incomplete receiver acceptance and preserve exact predecessor history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { classifyRepositoryTest } from "../src/adoption/test-profiles.mjs";
import { assertOwnedJavaScriptReceiverExecution } from "./helpers/owned-javascript-receiver-evidence.mjs";
import { ownedJavaScriptReceiverPath, ownedJavaScriptReceiverBaseline, ownedJavaScriptReceiverPrevious
	, ownedJavaScriptReceiverChangedPaths, ownedJavaScriptReceiverAddedPaths
	, beforeOwnedJavaScriptReceiver, reverseOwnedJavaScriptReceiverUpdate } from "./helpers/owned-javascript-receiver-history.mjs";

const read = async () => JSON.parse(await readFile(ownedJavaScriptReceiverPath, "utf8"));

test("JavaScript receiver history authenticates exact sources without inflating support", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-javascript-receivers");
	assert.equal(record.planNode, 1219); assert.equal(record.baselineRevision, ownedJavaScriptReceiverBaseline);
	assert.deepEqual(record.previous, ownedJavaScriptReceiverPrevious);
	const bytes = await readFile(record.previous.path), previous = JSON.parse(bytes);
	assert.equal(sha256(bytes), record.previous.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), [...Object.keys(previous.sources), ...ownedJavaScriptReceiverAddedPaths].sort());
	for(const [path, digest] of Object.entries(record.sources)) assert.equal(sha256(await readFile(path)), digest, path);
	assert.deepEqual(record.updates.map(update => update.path), ownedJavaScriptReceiverChangedPaths);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, previous.sources[update.path]);
		assert.equal(update.currentSha256, record.sources[update.path]);
		const source = await readFile(update.path, "utf8"), prior = beforeOwnedJavaScriptReceiver(update.path, source);
		assert.equal(sha256(prior), update.previousSha256);
		assert.equal(beforeOwnedJavaScriptReceiver(update.path, prior), prior);
		assert.equal(beforeOwnedJavaScriptReceiver(update.path, source, update.currentSha256), source);
		const unknown = source + "\n/* unrelated edit */\n";
		assert.equal(beforeOwnedJavaScriptReceiver(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedJavaScriptReceiverUpdate(unknown, update));
		for(const changed of [{ ...update, previousSha256: "0".repeat(64) }
			, { ...update, edits: [...update.edits, update.edits[0]] }
			, { ...update, path: "unknown.mjs" }])
			assert.throws(() => reverseOwnedJavaScriptReceiverUpdate(source, changed));
	}
	const path = "docs/type-surface.v1.json", current = await readFile(path, "utf8");
	const prior = JSON.parse(beforeOwnedJavaScriptReceiver(path, current));
	for(const evidence of prior.evidence) for(const file of evidence.files) file.sha256 = sha256(await readFile(file.path));
	assert.deepEqual(JSON.parse(current), prior);
	for(const name of ["model", "package", "packaging", "resource-packaging", "unanchored", "gc", "mutants", "coexistence", "ci", "evidence"])
		assert.equal(classifyRepositoryTest(`tests/owned-javascript-receiver-${name}.test.mjs`), "contract");
	assert.equal(classifyRepositoryTest("tests/owned-javascript-receivers.test.mjs"), "contract");
});

test("JavaScript receiver evidence reconstructs all compiled and installed configurations", async () => {
	await assertOwnedJavaScriptReceiverExecution(await read());
});

test("JavaScript receiver evidence rejects partial execution and overstated guarantees", async () => {
	const record = await read();
	await assertOwnedJavaScriptReceiverExecution(record);
	for(const mutate of [
		value => { value.acceptance = "pending"; }
		, value => { value.scope.callbackResultAnchors = true; }
		, value => { value.scope.docker = true; }
		, value => { value.scope.installedSupportPromotions = 1; }
		, value => { value.run.exitCode = 1; }
		, value => { value.run.text += "unrecorded"; }
		, value => { value.run.text = value.run.text.replace("# skipped 0", "# skipped 1"); value.run.sha256 = sha256(value.run.text); }
		, value => { value.runtime.pop(); }
		, value => { value.runtime[0].privateAbi.receiverExports.exports.pop(); }
		, value => { value.runtime[1].privateAbi.resultAnchors.exports[0].parameter++; }
		, value => { value.runtime[0].sourceSha256 = "0".repeat(64); }
		, value => { value.runtime[1].members.members--; }
		, value => { value.runtime[0].identities++; }
		, value => { value.runtime[0].failureCleanup.retainedErrors = 0; }
		, value => { value.runtime[1].failureCleanup.counts["host:move"].after = 0; }
		, value => { value.runtime[1].failureCleanup.hostWrappers++; }
		, value => { value.resources.pop(); }
		, value => { value.resources[0].installedPackage = true; }
		, value => { value.resources[1].consuming = false; }
		, value => { value.resources[2].observed.resultAnchors = true; }
		, value => { value.resources[4].callbacks++; }
		, value => { value.gc.pop(); }
		, value => { value.gc[0].actualGc = false; }
		, value => { value.gc[1].cycleCollected = false; }
		, value => { value.gc[0].retainedMethodPinsReceiver = false; }
		, value => { value.gc[1].owners++; }
		, value => { value.mutants[0].observations.pop(); }
		, value => { value.mutants[1].observations[8].parsed = false; }
		, value => { value.mutants[0].observations[9].semanticRejection = false; }
		, value => { value.coexistence.pop(); }
		, value => { value.coexistence[1].runtimeInitializations++; }
		, value => { value.coexistence[2].legacyHandles++; }
		, value => { value.packages.reports.pop(); }
		, value => { value.packages.reports[0].sourceRemovedBeforeInstall = false; }
		, value => { value.packages.reports[1].installedCli = false; }
		, value => { value.packages.reports[0].independentRebuild = false; }
		, value => { value.packages.reports[1].documentation.output = "42n\n"; }
		, value => { value.packages.reports[1].model.ownedGraph.receiverExports.exports.pop(); }
		, value => { value.packages.reports[0].inventory["@lean-bridge/runtime/internal/owned-wasm-borrow-registry.mjs"].sha256 = "0".repeat(64); }
		, value => { value.packages.reports[1].inventory["@lean-bridge/runtime/internal/component-runtime.mjs"].sha256 = "0".repeat(64); }
		, value => { value.packages.reports[0].browser.executions.pop(); }
		, value => { value.packages.reports[1].browser.executions[0].checks--; }
		, value => { value.packages.reports[0].rejected = 0; }
		, value => { value.resourcePackages.pop(); }
		, value => { value.resourcePackages[0].producerInterface = "installed-cli"; }
		, value => { value.resourcePackages[1].consuming = false; }
		, value => { value.resourcePackages[2].unanchored = false; }
		, value => { value.resourcePackages[3].browser.executions[0].assets.pop(); }
		, value => { value.resourcePackages[4].receipt.ownedGraph.receiverExports.exports.pop(); }
		, value => { value.resourcePackages[5].consumerSha256 = "0".repeat(64); }
	]) {
		const changed = structuredClone(record); mutate(changed);
		await assert.rejects(() => assertOwnedJavaScriptReceiverExecution(changed), undefined, mutate.toString());
	}
});
