/**
 * Authenticate owned callback packages without claiming unfinished projections.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertOwnedHostExecution, assertOwnedHostIntegration } from "./helpers/owned-host-evidence.mjs";
import { beforeOwnedHost, reverseOwnedHostUpdate, ownedHostHistoryPath, ownedHostExecutionPath } from "./helpers/owned-host-source-history.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));

test("owned callback packages retain fault checks, installed execution and source history", async () => {
	await assertOwnedHostIntegration(await json(ownedHostHistoryPath));
});

test("owned callback evidence rejects altered runs, recovery, lifetimes and coverage", async () => {
	const original = await json(ownedHostExecutionPath);
	for(const change of [
		record => { record.scope.profiles.push("cpp"); }
		, record => { record.scope.hostCallbackLifetime = "retained"; }
		, record => { record.scope.transferredInputs = true; }
		, record => { record.scope.wasm = true; }
		, record => { record.runs.core.exitCode = 1; }
		, record => { record.runs.packages.command += " --import substitute.mjs"; }
		, record => { record.runs.packageRegressions.text += "changed"; }
		, record => { record.runs.nixBoundary.exitCode = 1; }
		, record => { delete record.sources["src/backends/c/owned-callbacks.mjs"]; }
		, record => { record.core.ordinary.result.failures--; }
		, record => { record.core.reviewed.result.identities++; }
		, record => { record.core.reviewed.noLeanGlobalCopyRelocation = false; }
		, record => { record.core.reviewed.startupLeakBaseline = "suppression"; }
		, record => { record.core.reviewed.hostCallbacks[0].automaticRecovery = !record.core.reviewed.hostCallbacks[0].automaticRecovery; }
		, record => { record.packages.ordinary.checks.pkgConfig--; }
		, record => { record.packages.reviewed.sourceFreeInstallation = false; }
		, record => { record.packages.reviewed.forgedCapabilityRejected = false; }
		, record => { record.packages.reviewed.forgedTrampolineRejected = false; }
		, record => { record.packages.reviewed.adapterReceipt.ownedValues.hostCallbacks.lifetime = "retained"; }
		, record => { record.packages.reviewed.componentReceipt.callbackSourceSha256 = "0".repeat(64); }
		, record => { record.packages.reviewed.manifest.schemaVersion = 2; }
		, record => { record.packageRegressions.reviewed.packageSetReceipt.packages[0].target = "cpp"; }
	]) {
		const changed = structuredClone(original); change(changed);
		await assert.rejects(() => assertOwnedHostExecution(changed), change.toString());
	}
});

test("owned callback source history rejects unknown text and overlapping edits", async () => {
	for(const update of (await json(ownedHostHistoryPath)).updates)
	{
		const source = await readFile(update.path, "utf8");
		assert.equal(sha256(reverseOwnedHostUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeOwnedHost(update.path, source)), update.previousSha256);
		assert.equal(beforeOwnedHost(update.path, source, update.currentSha256), source);
		const unknown = source + "\n/* unrecorded */\n";
		assert.equal(beforeOwnedHost(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedHostUpdate(unknown, update));
		assert.throws(() => reverseOwnedHostUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
		assert.throws(() => reverseOwnedHostUpdate(source, { ...update, edits: [...update.edits, update.edits[0]] }));
	}
});
