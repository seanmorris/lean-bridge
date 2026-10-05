/**
 * Reject forged C# ownership, installed package and source-history claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertOwnedDotnetExecution, assertOwnedDotnetIntegration } from "./helpers/owned-dotnet-evidence.mjs";
import { beforeOwnedDotnet, reverseOwnedDotnetUpdate, ownedDotnetHistoryPath, ownedDotnetExecutionPath, ownedDotnetHistoricalBytes } from "./helpers/owned-dotnet-source-history.mjs";
import { beforeOwnedDotnetProcess } from "./helpers/owned-dotnet-process-history.mjs";

const json = async path => JSON.parse(await readFile(path, "utf8"));

test("C# ownership evidence requires installed NuGet archives and exact predecessors", async () => {
	await assertOwnedDotnetIntegration(await json(ownedDotnetHistoryPath));
});

test("C# ownership evidence rejects altered lifetime, package and execution claims", async () => {
	const original = await json(ownedDotnetExecutionPath);
	for(const change of [
		record => { record.scope.profiles.push("npm"); }
		, record => { record.scope.hostCallbackLifetime = "retained"; }
		, record => { record.scope.transferredInputs = true; }
		, record => { record.scope.anchoredResults = true; }
		, record => { record.scope.wasm = true; }
		, record => { record.scope.defaultClrProtections = false; }
		, record => { record.runs.packages.exitCode = 1; }
		, record => { record.runs.packages.command += " --import substitute.mjs"; }
		, record => { record.runs.coexistence.text += "changed"; }
		, record => { delete record.sources["src/backends/dotnet/verified-assets.mjs"]; }
		, record => { record.references[0].sha256 = "0".repeat(64); }
		, record => { record.packages.ordinary.sourceFreeInstallation = false; }
		, record => { record.packages.reviewed.sourceFreeRelocatedExecution = false; }
		, record => { record.packages.ordinary.sdkFreeExecution = false; }
		, record => { record.packages.ordinary.safePublicApi = false; }
		, record => { record.packages.ordinary.deterministicReassembly = false; }
		, record => { record.packages.ordinary.observation.checks--; }
		, record => { record.packages.reviewed.adapterReceipt.dotnetValues.guardSha256 = "0".repeat(64); }
		, record => { record.packages.reviewed.adapterReceipt.gmp.binding = "global-symbols"; }
		, record => { record.packages.ordinary.tamperRejected.pop(); }
		, record => { record.packages.ordinary.rejectedConsumers.pop(); }
		, record => { record.packages.reviewed.documentation.sourceSha256 = "0".repeat(64); }
		, record => { record.packages.reviewed.componentReceipt.callbackSourceSha256 = "0".repeat(64); }
		, record => { record.packages.reviewed.adapterReceipt.files["unexpected.txt"] = { bytes: 0, sha256: sha256("") }; }
		, record => { record.packages.ordinary.compiledProjection.evidence.runtimeIdentity = "0".repeat(64); }
		, record => { record.packages.ordinary.consumerSha256 = "0".repeat(64); }
		, record => { record.scalarPackages.reviewed.observation.primitives--; }
		, record => { record.coexistence.observations.pop(); }
		, record => { record.coexistence.observations[0].runtimeInitializations++; }
		, record => { record.coexistence.observations[3].rejectedCalls--; }
		, record => { record.coexistence.observations[5].liveIdentities++; }
		, record => { record.coexistence.observations[7].forkChecks--; }
		, record => { record.regressions.recursive.reports[1].probes.faults.identities++; }
		, record => { record.regressions.structured.reports[0].installation.offlineInstall = false; }
		, record => { record.regressions.structured.reports[0].installation.faults.faults--; }
		, record => { record.regressions.recursive.mixedReports.pop(); }
	]) {
		const changed = structuredClone(original); change(changed);
		await assert.rejects(() => assertOwnedDotnetExecution(changed), change.toString());
	}
});

test("C# source history restores only recorded identities and preserves binary files", async () => {
	for(const update of (await json(ownedDotnetHistoryPath)).updates)
	{
		const source = beforeOwnedDotnetProcess(update.path, await readFile(update.path, "utf8"), update.currentSha256);
		assert.equal(sha256(reverseOwnedDotnetUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeOwnedDotnet(update.path, source)), update.previousSha256);
		assert.equal(beforeOwnedDotnet(update.path, source, update.currentSha256), source);
		const unknown = source + "\n/* unrecorded */\n";
		assert.equal(beforeOwnedDotnet(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedDotnetUpdate(unknown, update));
		assert.throws(() => reverseOwnedDotnetUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
		assert.throws(() => reverseOwnedDotnetUpdate(source, { ...update, edits: [...update.edits, update.edits[0]] }));
	}
	const binary = Buffer.from([0xff, 0xfe, 0, 0x80]);
	assert.equal(ownedDotnetHistoricalBytes("unrecorded.bin", binary), binary);
});
