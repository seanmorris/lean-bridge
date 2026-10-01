/**
 * Reject incomplete PHP-Wasm receiver execution and preserve source history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { classifyRepositoryTest } from "../src/adoption/test-profiles.mjs";
import { assertOwnedPhpWasmReceiverExecution } from "./helpers/owned-php-wasm-receiver-evidence.mjs";
import { beforeOwnedJavaScriptReceiver, ownedJavaScriptReceiverHistoricalBytes } from "./helpers/owned-javascript-receiver-history.mjs";
import { ownedPhpWasmReceiverPath, ownedPhpWasmReceiverBaseline, ownedPhpWasmReceiverPrevious
	, ownedPhpWasmReceiverChangedPaths, ownedPhpWasmReceiverAddedPaths
	, beforeOwnedPhpWasmReceiver, reverseOwnedPhpWasmReceiverUpdate } from "./helpers/owned-php-wasm-receiver-history.mjs";

const read = async () => JSON.parse(await readFile(ownedPhpWasmReceiverPath, "utf8"));

test("PHP-Wasm receiver history authenticates exact sources and preserves prior support", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-php-wasm-receivers");
	assert.equal(record.planNode, 1219); assert.equal(record.baselineRevision, ownedPhpWasmReceiverBaseline);
	assert.deepEqual(record.previous, ownedPhpWasmReceiverPrevious);
	const bytes = await readFile(record.previous.path), previous = JSON.parse(bytes);
	assert.equal(sha256(bytes), record.previous.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), [...Object.keys(previous.sources), ...ownedPhpWasmReceiverAddedPaths].sort());
	for(const [path, digest] of Object.entries(record.sources)) assert.equal(sha256(ownedJavaScriptReceiverHistoricalBytes(path, await readFile(path), digest)), digest, path);
	assert.deepEqual(record.updates.map(update => update.path), ownedPhpWasmReceiverChangedPaths);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, previous.sources[update.path]);
		assert.equal(update.currentSha256, record.sources[update.path]);
		const source = beforeOwnedJavaScriptReceiver(update.path, await readFile(update.path, "utf8"), update.currentSha256), prior = beforeOwnedPhpWasmReceiver(update.path, source);
		assert.equal(sha256(prior), update.previousSha256);
		assert.equal(beforeOwnedPhpWasmReceiver(update.path, prior), prior);
		assert.equal(beforeOwnedPhpWasmReceiver(update.path, source, update.currentSha256), source);
		const unknown = source + "\n/* unrelated edit */\n";
		assert.equal(beforeOwnedPhpWasmReceiver(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedPhpWasmReceiverUpdate(unknown, update));
		for(const changed of [{ ...update, previousSha256: "0".repeat(64) }
			, { ...update, edits: [...update.edits, update.edits[0]] }
			, { ...update, path: "unknown.mjs" }])
			assert.throws(() => reverseOwnedPhpWasmReceiverUpdate(source, changed));
	}
	const path = "docs/type-surface.v1.json", current = beforeOwnedJavaScriptReceiver(path, await readFile(path, "utf8"), record.sources[path]);
	const prior = JSON.parse(beforeOwnedPhpWasmReceiver(path, current));
	for(const evidence of prior.evidence) for(const file of evidence.files) file.sha256 = sha256(ownedJavaScriptReceiverHistoricalBytes(file.path, await readFile(file.path), record.sources[file.path]));
	assert.deepEqual(JSON.parse(current), prior);
	for(const name of ["model", "resource", "packaging", "resource-packaging", "documentation", "ci", "evidence"])
		assert.equal(classifyRepositoryTest(`tests/owned-php-wasm-receiver-${name}.test.mjs`), "contract");
	assert.equal(classifyRepositoryTest("tests/owned-php-wasm-receivers.test.mjs"), "contract");
});

test("PHP-Wasm receiver evidence reconstructs both runtime and installed source paths", async () => {
	await assertOwnedPhpWasmReceiverExecution(await read());
});

test("PHP-Wasm receiver evidence rejects partial runs and overstated lifetime claims", async () => {
	const record = await read();
	await assertOwnedPhpWasmReceiverExecution(record);
	for(const mutate of [
		value => { value.acceptance = "pending"; }
		, value => { value.scope.callbackResultAnchors = true; }
		, value => { value.scope.wasmFiberExecution = true; }
		, value => { value.scope.docker = true; }
		, value => { value.scope.installedSupportPromotions = 1; }
		, value => { value.run.exitCode = 1; }
		, value => { value.run.text += "unrecorded"; }
		, value => { value.run.text = value.run.text.replace("# skipped 0", "# skipped 1"); value.run.sha256 = sha256(value.run.text); }
		, value => { value.runtime.pop(); }
		, value => { value.runtime[0].restoredAfterMutations = false; }
		, value => { value.runtime[0].sourceSha256 = "0".repeat(64); }
		, value => { value.runtime[0].files["src/Api.php"] = "0".repeat(64); }
		, value => { value.runtime[1].observations[1].live++; }
		, value => { value.runtime[0].observations[0].heldErrors = 0; }
		, value => { value.runtime[0].observations[1].faults.move.php.after = 0; }
		, value => { value.runtime[1].mutants.pop(); }
		, value => { value.runtime[0].mutants[6].parsed = false; }
		, value => { value.runtime[1].mutants[7].semanticRejection = false; }
		, value => { value.runtime[0].bailouts.pop(); }
		, value => { value.runtime[1].bailouts[2].after.nativeLive++; }
		, value => { value.resources.pop(); }
		, value => { value.resources[0].installedPackage = true; }
		, value => { value.resources[1].observations[1].cleaned.liveIdentities++; }
		, value => { value.resources[2].unanchored = false; }
		, value => { value.resources[3].model.ownedGraph.receiverExports.exports.pop(); }
		, value => { value.resources[4].consumerSha256 = "0".repeat(64); }
		, value => { value.resources[5].observations.pop(); }
		, value => { value.nativeFibers.wasm32 = true; }
		, value => { value.nativeFibers.observations[1].checks--; }
		, value => { value.nativeFibers.observations[0].forkExecution = false; }
		, value => { value.packages.observations.pop(); }
		, value => { value.packages.observations[0].sourceFreeInstallation = false; }
		, value => { value.packages.observations[1].model.ownedGraph.receiverExports.exports.pop(); }
		, value => { value.packages.observations[0].rejected.pop(); }
		, value => { value.packages.observations[1].executions.pop(); }
		, value => { value.packages.observations[0].browser.observations.pop(); }
		, value => { value.packages.observations[1].executions[3].observed.checks--; }
		, value => { value.resourcePackages.pop(); }
		, value => { value.resourcePackages[0].installedCli = true; }
		, value => { value.resourcePackages[1].hostCallbacks = true; }
		, value => { value.resourcePackages[0].receiptVerifiedWithoutProducer = false; }
		, value => { value.resourcePackages[1].independentBuild = false; }
		, value => { value.resourcePackages[0].executions[0].invalidStayedCold = false; }
		, value => { value.resourcePackages[1].browser.observations[0].executions[1].refreshed.liveIdentities++; }
		, value => { value.documentation.observations.pop(); }
		, value => { value.documentation.consumerSha256 = "0".repeat(64); }
		, value => { value.documentation.sourceFreeInstallation = false; }
		, value => { value.documentation.handoffRemoved = false; }
	]) {
		const changed = structuredClone(record); mutate(changed);
		await assert.rejects(() => assertOwnedPhpWasmReceiverExecution(changed), undefined, mutate.toString());
	}
});
