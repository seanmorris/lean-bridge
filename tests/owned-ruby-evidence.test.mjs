/**
 * Reject forged Ruby ownership, installed execution and source-history claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertOwnedRubyExecution, assertOwnedRubyIntegration } from "./helpers/owned-ruby-evidence.mjs";
import { beforeOwnedRuby, reverseOwnedRubyUpdate, ownedRubyHistoryPath, ownedRubyExecutionPath, ownedRubyHistoricalBytes } from "./helpers/owned-ruby-source-history.mjs";
import { beforeOwnedDotnet } from "./helpers/owned-dotnet-source-history.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));

test("Ruby ownership evidence requires installed gems and exact immutable predecessors", async () => {
	await assertOwnedRubyIntegration(await json(ownedRubyHistoryPath));
});

test("Ruby ownership evidence rejects altered lifetime, package and execution claims", async () => {
	const original = await json(ownedRubyExecutionPath);
	for(const change of [
		record => { record.scope.profiles.push("npm"); }
		, record => { record.scope.hostCallbackLifetime = "retained"; }
		, record => { record.scope.transferredInputs = true; }
		, record => { record.scope.anchoredResults = true; }
		, record => { record.scope.wasm = true; }
		, record => { record.runs.packages.exitCode = 1; }
		, record => { record.runs.packages.command += " --import substitute.mjs"; }
		, record => { record.runs.copied.text += "changed"; }
		, record => { delete record.sources["src/backends/ruby/verified-assets.mjs"]; }
		, record => { record.references[0].sha256 = "0".repeat(64); }
		, record => { record.packages.ordinary.sourceFreeInstallation = false; }
		, record => { record.packages.reviewed.sourceFreeRelocatedExecution = false; }
		, record => { record.packages.ordinary.deterministicReassembly = false; }
		, record => { record.packages.ordinary.observation.checks--; }
		, record => { record.packages.ordinary.loader.liveIdentities++; }
		, record => { record.packages.reviewed.loader.privateGmp = false; }
		, record => { record.packages.reviewed.loader.forkBeforeLock = false; }
		, record => { record.packages.reviewed.companions.python--; }
		, record => { record.packages.reviewed.dependencies.lockSha256 = "0".repeat(64); }
		, record => { record.packages.ordinary.tamperRejected.pop(); }
		, record => { record.packages.ordinary.loaderRejected.pop(); }
		, record => { record.packages.reviewed.documentation.sha256 = "0".repeat(64); }
		, record => { record.packages.reviewed.componentReceipt.callbackSourceSha256 = "0".repeat(64); }
		, record => { record.packages.reviewed.adapterReceipt.rubyValues.callbackLifetime = "retained"; }
		, record => { record.packages.reviewed.adapterReceipt.gmp.binding = "global-symbols"; }
		, record => { record.packages.reviewed.adapterReceipt.files["unexpected.txt"] = { bytes: 0, sha256: sha256("") }; }
		, record => { record.packages.ordinary.manifest.files["lib/lean_bridge/owned_aggregates/native.rb"].sha256 = "0".repeat(64); }
		, record => { record.scalarPackages.reviewed.observation.primitives--; }
		, record => { record.scalarPackages.ordinary.relocatedObservation.checks--; }
		, record => { record.coexistence.observations.pop(); }
		, record => { record.coexistence.observations[0].runtimeInitializations++; }
		, record => { record.coexistence.observations[3].rejectedCalls--; }
		, record => { record.regressions.copied.observations[0].installed.faults.inputFailures--; }
		, record => { record.regressions.recursive.reports[1].installation.faults.identities++; }
		, record => { record.regressions.structured.reports[0].installation.offlineInstall = false; }
		, record => { record.regressions.structured.reports[0].installation.faults.faults--; }
		, record => { record.regressions.recursive.reports[0].installation.lifetimes.finalization_released = false; }
	]) {
		const changed = structuredClone(original); change(changed);
		await assert.rejects(() => assertOwnedRubyExecution(changed), change.toString());
	}
});

test("Ruby source history restores only whole recorded identities and preserves binary files", async () => {
	for(const update of (await json(ownedRubyHistoryPath)).updates)
	{
		const source = beforeOwnedDotnet(update.path, await readFile(update.path, "utf8"), update.currentSha256);
		assert.equal(sha256(reverseOwnedRubyUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeOwnedRuby(update.path, source)), update.previousSha256);
		assert.equal(beforeOwnedRuby(update.path, source, update.currentSha256), source);
		const unknown = source + "\n/* unrecorded */\n";
		assert.equal(beforeOwnedRuby(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedRubyUpdate(unknown, update));
		assert.throws(() => reverseOwnedRubyUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
		assert.throws(() => reverseOwnedRubyUpdate(source, { ...update, edits: [...update.edits, update.edits[0]] }));
	}
	const binary = Buffer.from([0xff, 0xfe, 0, 0x80]);
	assert.equal(ownedRubyHistoricalBytes("unrecorded.bin", binary), binary);
});
