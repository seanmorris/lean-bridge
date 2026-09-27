/**
 * Reject forged Python ownership, installation and source-history claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertOwnedPythonExecution, assertOwnedPythonIntegration } from "./helpers/owned-python-evidence.mjs";
import { beforeOwnedPython, reverseOwnedPythonUpdate, ownedPythonHistoryPath, ownedPythonExecutionPath } from "./helpers/owned-python-source-history.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));

test("Python ownership evidence requires compiled probes, installed wheels and immutable predecessors", async () => {
	await assertOwnedPythonIntegration(await json(ownedPythonHistoryPath));
});

test("Python ownership evidence rejects altered lifetimes, execution and package claims", async () => {
	const original = await json(ownedPythonExecutionPath);
	for(const change of [
		record => { record.scope.profiles.push("npm"); }
		, record => { record.scope.hostCallbackLifetime = "retained"; }
		, record => { record.scope.transferredInputs = true; }
		, record => { record.scope.anchoredResults = true; }
		, record => { record.scope.wasm = true; }
		, record => { record.runs.core.exitCode = 1; }
		, record => { record.runs.packages.command += " --import substitute.mjs"; }
		, record => { record.runs.packages.text += "changed"; }
		, record => { delete record.sources["src/backends/python/owned-runtime.mjs"]; }
		, record => { record.runtime.ordinary.observations[0].identities++; }
		, record => { record.values.reviewed.observations[0].pythonFaults--; }
		, record => { record.scalars.ordinary.observations[0].nativeFaults--; }
		, record => { record.packages.ordinary.observations[0].checks--; }
		, record => { record.packages.reviewed.companions.rust--; }
		, record => { record.packages.reviewed.dependencies.lockSha256 = "0".repeat(64); }
		, record => { record.packages.reviewed.dependencies.packages[0].checksum = "0".repeat(64); }
		, record => { record.packages.reviewed.sourceFreeInstallation = false; }
		, record => { record.packages.ordinary.observations[0].loaderRejected.pop(); }
		, record => { record.packages.ordinary.observations[0].loader.liveIdentities++; }
		, record => { record.packages.reviewed.observations[2].loader.forkWithHeldLockRejected = false; }
		, record => { record.packages.reviewed.documentationSha256 = "0".repeat(64); }
		, record => { record.packages.reviewed.componentReceipt.callbackSourceSha256 = "0".repeat(64); }
		, record => { record.packages.reviewed.adapterReceipt.pythonValues.callbackLifetime = "retained"; }
		, record => { record.packages.ordinary.observations[0].manifest.files["lean_owned_aggregates/_assets.py"].sha256 = "0".repeat(64); }
		, record => { record.packages.reviewed.observations[1].installation.resolvedOffline = false; }
		, record => { record.packages.reviewed.observations[1].manifest.ownedValues.loader = "manual"; }
		, record => { record.packages.reviewed.packageSetReceipt.packages[0].target = "npm"; }
		, record => { record.scalarPackages.reviewed.observations[1].result.primitives--; }
		, record => { record.scalarPackages.ordinary.observations[0].relocatedChecks--; }
	]) {
		const changed = structuredClone(original); change(changed);
		await assert.rejects(() => assertOwnedPythonExecution(changed), change.toString());
	}
});

test("Python source history preserves exact predecessors and rejects unrecorded edits", async () => {
	for(const update of (await json(ownedPythonHistoryPath)).updates)
	{
		const source = await readFile(update.path, "utf8");
		assert.equal(sha256(reverseOwnedPythonUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeOwnedPython(update.path, source)), update.previousSha256);
		assert.equal(beforeOwnedPython(update.path, source, update.currentSha256), source);
		const unknown = source + "\n/* unrecorded */\n";
		assert.equal(beforeOwnedPython(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedPythonUpdate(unknown, update));
		assert.throws(() => reverseOwnedPythonUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
		assert.throws(() => reverseOwnedPythonUpdate(source, { ...update, edits: [...update.edits, update.edits[0]] }));
	}
});
