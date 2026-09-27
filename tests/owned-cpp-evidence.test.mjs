/**
 * Reject forged C++ ownership, installation and source-history evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertOwnedCppExecution, assertOwnedCppIntegration } from "./helpers/owned-cpp-evidence.mjs";
import { beforeOwnedCpp, reverseOwnedCppUpdate, ownedCppHistoryPath, ownedCppExecutionPath } from "./helpers/owned-cpp-source-history.mjs";
import { beforeOwnedCppOrder, ownedCppOrderHistoryPath, ownedCppOrderPaths } from "./helpers/owned-cpp-order-history.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));

test("C++ ownership evidence retains compiled probes, source-free installs and predecessors", async () => {
	await assertOwnedCppIntegration(await json(ownedCppHistoryPath));
});

test("C++ ownership evidence rejects changed claims, sources, execution and packages", async () => {
	const original = await json(ownedCppExecutionPath);
	for(const change of [
		record => { record.scope.profiles.push("pypi"); }
		, record => { record.scope.hostCallbackLifetime = "retained"; }
		, record => { record.scope.transferredInputs = true; }
		, record => { record.scope.wasm = true; }
		, record => { record.runs.core.exitCode = 1; }
		, record => { record.runs.packages.command += " --import substitute.mjs"; }
		, record => { record.runs.cPackages.text += "changed"; }
		, record => { record.runs.contracts.exitCode = 1; }
		, record => { delete record.sources["src/backends/cpp/owned-runtime.mjs"]; }
		, record => { record.runtime.ordinary.result.identities++; }
		, record => { record.runtime.reviewed.probeSha256 = "0".repeat(64); }
		, record => { record.callables["owned-aggregates"].ordinary.result.allocationFailures--; }
		, record => { record.callables["owned-host-callbacks"].reviewed.sanitizedResult.live++; }
		, record => { record.callables["owned-aggregates"].reviewed.startupLeakBaseline = "suppression"; }
		, record => { record.packages.ordinary.checks.pkgConfig--; }
		, record => { record.packages.reviewed.sourceFreeInstallation = false; }
		, record => { record.packages.reviewed.forgedLifetimeRejected = false; }
		, record => { record.packages.reviewed.forgedBoostRejected = false; }
		, record => { record.packages.reviewed.componentReceipt.callbackSourceSha256 = "0".repeat(64); }
		, record => { record.packages.reviewed.adapterReceipt.cppValues.callbackLifetime = "retained"; }
		, record => { record.packages.reviewed.manifest.files["include/owned_aggregates.hpp"].sha256 = "0".repeat(64); }
		, record => { record.packages.reviewed.manifest.exactIntegers = "gmp-6.3.0"; }
		, record => { record.packages.reviewed.packageSetReceipt.packages[0].target = "pypi"; }
		, record => { record.cPackages.aggregates.ordinary.checks.cmake--; }
		, record => { record.cPackages.callbacks.reviewed.forgedTrampolineRejected = false; }
	]) {
		const changed = structuredClone(original); change(changed);
		await assert.rejects(() => assertOwnedCppExecution(changed), change.toString());
	}
});

test("C++ ownership source history rejects unknown text and overlapping edits", async () => {
	for(const update of (await json(ownedCppHistoryPath)).updates)
	{
		const source = beforeOwnedCppOrder(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reverseOwnedCppUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeOwnedCpp(update.path, source)), update.previousSha256);
		assert.equal(beforeOwnedCpp(update.path, source, update.currentSha256), source);
		const unknown = source + "\n/* unrecorded */\n";
		assert.equal(beforeOwnedCpp(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedCppUpdate(unknown, update));
		assert.throws(() => reverseOwnedCppUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
		assert.throws(() => reverseOwnedCppUpdate(source, { ...update, edits: [...update.edits, update.edits[0]] }));
	}
});

test("C++ inventory repair preserves membership, original receipts and exact source predecessors", async () => {
	const record = await json(ownedCppOrderHistoryPath);
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "owned-cpp-inventory-order");
	assert.deepEqual(record.updates.map(update => update.path), ownedCppOrderPaths);
	for(const update of record.updates)
	{
		const source = await readFile(update.path, "utf8");
		assert.equal(sha256(source), update.currentSha256);
		const previous = beforeOwnedCppOrder(update.path, source);
		assert.equal(sha256(previous), update.previousSha256);
		assert.equal(beforeOwnedCppOrder(update.path, source, update.currentSha256), source);
		assert.equal(beforeOwnedCppOrder(update.path, previous), previous);
		const unknown = source + "\n/* unrecorded */\n";
		assert.equal(beforeOwnedCppOrder(update.path, unknown), unknown);
		if(update.path === "package.json" || update.path === "config/cli-package.v1.json")
		{
			const oldManifest = JSON.parse(previous), currentManifest = JSON.parse(source);
			assert.deepEqual(currentManifest, { ...oldManifest, files: [...oldManifest.files].sort() });
			assert.equal(new Set(currentManifest.files).size, currentManifest.files.length);
		}
	}
	assert.deepEqual(Object.keys(record.receipts).sort(), [ownedCppExecutionPath, ownedCppHistoryPath].sort());
	for(const [path, digest] of Object.entries(record.receipts)) assert.equal(sha256(await readFile(path)), digest);
	assert.deepEqual(Object.keys(record.additions), ["tests/helpers/owned-cpp-order-history.mjs"]);
	for(const [path, digest] of Object.entries(record.additions)) assert.equal(sha256(await readFile(path)), digest);
	assert.equal(beforeOwnedCppOrder("src/build/native-project.mjs", "unrecorded"), "unrecorded");
});
